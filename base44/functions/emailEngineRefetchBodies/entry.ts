/**
 * emailEngineRefetchBodies
 *
 * Re-fetches the email body (source) for EmailMessageSandbox records that
 * have an empty body_text and a processing_status of 'fetched'.
 * After updating the body, it deletes any failed/blocked EmailLeadBridgeSandbox
 * records for the same message so the auto-create-lead automation can re-process them.
 *
 * Designed to fix messages where the original IMAP source-fetch timed out.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

function parseBodyFromSource(source) {
  if (!source) return '';
  const raw = source.toString('utf-8');
  const splitIdx = raw.indexOf('\r\n\r\n');
  const bodyRaw = splitIdx >= 0 ? raw.substring(splitIdx + 4) : raw;
  const plainMatch = bodyRaw.match(/Content-Type:\s*text\/plain[^\r\n]*(?:\r\n[^\r\n]+)*\r\n\r\n([\s\S]*?)(?=\r\n--)/i);
  if (plainMatch) return plainMatch[1].replace(/=\r\n/g, '').trim().substring(0, 10000);
  const htmlMatch = bodyRaw.match(/Content-Type:\s*text\/html[^\r\n]*(?:\r\n[^\r\n]+)*\r\n\r\n([\s\S]*?)(?=\r\n--)/i);
  if (htmlMatch) return htmlToText(htmlMatch[1]).substring(0, 10000);
  return htmlToText(bodyRaw).substring(0, 10000);
}

function safeErr(err) {
  return (err?.message || 'Unknown error').replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]').substring(0, 300);
}

function makeClient(host, port, user, pass) {
  return new ImapFlow({
    host, port, secure: true,
    auth: { user, pass },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 60000,
    disableAutoIdle: true,
  });
}

function decodeQP(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractFromParts(bodyParts) {
  if (!bodyParts) return '';
  const keys = ['1', 'TEXT', '1.1', '1.2', '2', '2.1'];
  for (const k of keys) {
    const p = bodyParts[k];
    if (!p || p.length < 5) continue;
    const raw = p.toString('utf-8');
    const qp = decodeQP(raw);
    if (/<html|<body|<div|<table/i.test(qp)) {
      const t = htmlToText(qp).trim();
      if (t.length > 5) return t.substring(0, 10000);
    } else if (qp.trim().length > 5) {
      return qp.trim().substring(0, 10000);
    }
  }
  // fallback: try any part
  for (const [, p] of Object.entries(bodyParts)) {
    if (!p || p.length < 5) continue;
    const raw = p.toString('utf-8');
    const qp = decodeQP(raw);
    const t = /<html|<body/i.test(qp) ? htmlToText(qp) : qp;
    if (t.trim().length > 5) return t.trim().substring(0, 10000);
  }
  return '';
}

async function fetchBodyForUID(host, port, user, pass, uid) {
  const client = makeClient(host, port, user, pass);
  try {
    await client.connect();
    const lock = await Promise.race([
      client.getMailboxLock('INBOX'),
      new Promise((_, r) => setTimeout(() => r(new Error('lock timeout')), 12000)),
    ]);
    let bodyText = '';
    try {
      // Strategy 1: bodyParts (faster, targeted) — avoids full source download hang
      const msgWithParts = await Promise.race([
        client.fetchOne(String(uid), { bodyParts: ['1', '2', '1.1', '1.2', 'TEXT'] }, { uid: true }),
        new Promise((_, r) => setTimeout(() => r(new Error('parts timeout')), 20000)),
      ]);
      bodyText = extractFromParts(msgWithParts?.bodyParts);

      // Strategy 2: full source fallback if parts gave nothing
      if (!bodyText) {
        let srcMsg = null;
        const fetchOp = (async () => {
          for await (const m of client.fetch({ uid: `${uid}` }, { source: true }, { uid: true })) {
            srcMsg = m; break;
          }
        })();
        await Promise.race([fetchOp, new Promise((_, r) => setTimeout(() => r(new Error('source timeout')), 20000))]);
        if (srcMsg?.source) bodyText = parseBodyFromSource(srcMsg.source);
      }
    } finally {
      lock.release();
      await Promise.race([client.logout(), new Promise(r => setTimeout(r, 2000))]).catch(() => {});
    }
    return { success: true, bodyText };
  } catch (err) {
    try { await Promise.race([client.logout(), new Promise(r => setTimeout(r, 1000))]).catch(() => {}); } catch (_) {}
    return { success: false, error: safeErr(err) };
  }
}

// Search INBOX by Message-ID — try header search first, fall back to envelope scan
async function findUIDByMessageId(host, port, user, pass, messageId) {
  const client = makeClient(host, port, user, pass);
  try {
    await client.connect();
    const lock = await Promise.race([
      client.getMailboxLock('INBOX'),
      new Promise((_, r) => setTimeout(() => r(new Error('lock timeout')), 12000)),
    ]);
    let uid = null;
    try {
      const clean = messageId.replace(/[<>]/g, '').trim();
      // Try header search first (fast)
      try {
        const uids = await Promise.race([
          client.search({ header: ['Message-ID', clean] }, { uid: true }),
          new Promise((_, r) => setTimeout(() => r(new Error('search timeout')), 8000)),
        ]);
        if (uids && uids.length > 0) uid = uids[uids.length - 1];
      } catch (_) {}

      // Fallback: scan envelopes of last 50 messages
      if (!uid) {
        const total = client.mailbox?.exists || 0;
        if (total > 0) {
          const start = Math.max(1, total - 49);
          for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, uid: true })) {
            if (msg.envelope?.messageId && msg.envelope.messageId.replace(/[<>]/g, '').trim() === clean) {
              uid = msg.uid;
              break;
            }
          }
        }
      }
    } finally {
      lock.release();
      await Promise.race([client.logout(), new Promise(r => setTimeout(r, 2000))]).catch(() => {});
    }
    return uid;
  } catch (err) {
    try { await Promise.race([client.logout(), new Promise(r => setTimeout(r, 1000))]).catch(() => {}); } catch (_) {}
    return null;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured' });
    }

    // Find all EmailMessageSandbox records with empty body that failed source fetch
    const allMessages = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ direction: 'inbound' });
    const emptyBodyMessages = (allMessages || []).filter(m =>
      (!m.body_text || m.body_text.trim() === '') &&
      m.message_id
    );

    log.push({ step: 'found_empty_body', count: emptyBodyMessages.length });

    if (emptyBodyMessages.length === 0) {
      return Response.json({ success: true, message: 'No messages with empty body found', log });
    }

    // Load all bridge records to clean up failed ones
    const allBridges = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 500);

    const results = [];

    for (const msg of emptyBodyMessages) {
      if (Date.now() - startTime > 50000) {
        log.push({ step: 'time_limit_reached' });
        break;
      }

      const result = { id: msg.id, subject: msg.subject, message_id: msg.message_id };

      // Step 1: Find UID in IMAP via Message-ID search
      log.push({ step: 'searching_uid', message_id: msg.message_id });
      const uid = await findUIDByMessageId(host, port, imapUser, imapPass, msg.message_id);

      if (!uid) {
        result.status = 'uid_not_found';
        log.push({ step: 'uid_not_found', message_id: msg.message_id });
        results.push(result);
        continue;
      }

      log.push({ step: 'uid_found', uid, message_id: msg.message_id });

      // Step 2: Fetch source by UID
      const fetchResult = await fetchBodyForUID(host, port, imapUser, imapPass, uid);

      if (!fetchResult.success || !fetchResult.bodyText) {
        result.status = 'source_fetch_failed';
        result.error = fetchResult.error;
        log.push({ step: 'source_fetch_failed', uid, error: fetchResult.error });
        results.push(result);
        continue;
      }

      log.push({ step: 'source_fetched', uid, body_len: fetchResult.bodyText.length });

      // Step 3: Update the EmailMessageSandbox record with the body
      await base44.asServiceRole.entities.EmailMessageSandbox.update(msg.id, {
        body_text: fetchResult.bodyText,
        body_preview: fetchResult.bodyText.substring(0, 300),
        processing_status: 'stored',
      });

      // Step 4: Delete failed/blocked bridge records for this message so lead-creator can re-run
      const failedBridges = allBridges.filter(b =>
        b.source_sandbox_record_id === msg.id &&
        b.lead_created === false
      );

      for (const bridge of failedBridges) {
        await base44.asServiceRole.entities.EmailLeadBridgeSandbox.delete(bridge.id);
        log.push({ step: 'bridge_deleted', bridge_id: bridge.id, reason: bridge.creation_error_log });
      }

      result.status = 'body_restored';
      result.body_len = fetchResult.bodyText.length;
      result.bridges_cleared = failedBridges.length;
      log.push({ step: 'done', id: msg.id, bridges_cleared: failedBridges.length });
      results.push(result);
    }

    return Response.json({
      success: true,
      summary: {
        checked: emptyBodyMessages.length,
        restored: results.filter(r => r.status === 'body_restored').length,
        failed: results.filter(r => r.status !== 'body_restored').length,
        execution_time_ms: Date.now() - startTime,
      },
      results,
      log,
    });

  } catch (error) {
    return Response.json({ success: false, error: safeErr(error), log }, { status: 500 });
  }
});