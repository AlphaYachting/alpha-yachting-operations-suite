// EMAIL ENGINE - Fetch & Store Inbound Messages
// v3: envelope-first, then fetchOne per message with tight timeouts.
// Avoids bulk bodyParts batch which causes IMAP socket hangs on edis.at.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';

const HARD_LIMIT_MS = 45000; // leave 15s buffer before Deno 60s kill
const IMAP_CONNECT_TIMEOUT = 10000;
const IMAP_SOCKET_TIMEOUT = 15000;

function normalizeSubject(subject) {
  if (!subject) return '';
  return subject.replace(/^((Re|Fwd?|AW|WG|SV|VS|FWD?|R|I)(\[\d+\])?:\s*)+/gi, '').trim().toLowerCase();
}

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' ').replace(/<\/td>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function buildConversationKey(messageId, fromEmail, normalizedSubject) {
  const clean = (id) => id ? id.replace(/[<>\s]/g, '') : null;
  if (messageId && clean(messageId)) return `chain:${clean(messageId)}`;
  const raw = `${normalizedSubject}:${fromEmail}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return `subj:${Math.abs(hash).toString(36)}`;
}

function safeErr(err) {
  return (String(err?.message || err || 'Unknown error'))
    .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
    .substring(0, 500);
}

function decodeQuotedPrintable(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractBodyText(bodyParts) {
  if (!bodyParts) return '';
  const plain = bodyParts['1'];
  if (plain && plain.length > 0) {
    const text = plain.toString('utf-8');
    if (/^[A-Za-z0-9+/\r\n]+=*$/.test(text.trim()) && text.length > 50) {
      try {
        const decoded = atob(text.replace(/\r?\n/g, ''));
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes).substring(0, 10000);
      } catch (_) {}
    }
    const qp = decodeQuotedPrintable(text);
    if (/<html|<body|<div|<table/i.test(qp)) return htmlToText(qp).substring(0, 10000);
    return qp.substring(0, 10000);
  }
  const html = bodyParts['2'];
  if (html && html.length > 0) {
    return htmlToText(decodeQuotedPrintable(html.toString('utf-8'))).substring(0, 10000);
  }
  return '';
}

// Wraps a promise with a hard timeout — rejects after ms milliseconds
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms))
  ]);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];
  let client = null;

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Keep batch small — each fetchOne takes time
    const batchSize = Math.min(Math.max(parseInt(body.batch_size) || 8, 3), 15);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured', log });
    }
    log.push({ step: 'config', host, port, user: imapUser, batch: batchSize, ts: 0 });

    // Load existing message IDs for deduplication
    const [existingMessages, existingConversations] = await Promise.all([
      base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 200),
      base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 200),
    ]);
    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));
    const existingSeqFingerprints = new Set(
      (existingMessages || [])
        .filter(m => !m.message_id)
        .map(m => `${m.normalized_subject}::${m.received_at?.substring(0, 10)}`)
        .filter(Boolean)
    );
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));
    log.push({ step: 'db_loaded', known_ids: existingMsgIds.size, convs: convMap.size, ts: Date.now() - startTime });

    const results = { fetched: 0, stored: 0, duplicates: 0, errors: 0, messages: [] };

    client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
      connectionTimeout: IMAP_CONNECT_TIMEOUT,
      greetingTimeout: 8000,
      socketTimeout: IMAP_SOCKET_TIMEOUT,
      disableAutoIdle: true,
    });

    await withTimeout(client.connect(), IMAP_CONNECT_TIMEOUT, 'IMAP connect');
    log.push({ step: 'connected', ts: Date.now() - startTime });

    const lock = await client.getMailboxLock('INBOX');
    const total = client.mailbox?.exists || 0;
    log.push({ step: 'inbox', total, ts: Date.now() - startTime });

    try {
      if (total > 0) {
        const startSeq = Math.max(1, total - batchSize + 1);
        const range = `${startSeq}:${total}`;

        // Phase 1: Fetch envelopes only — fast, no body
        const toFetch = [];
        for await (const msg of client.fetch(range, { envelope: true, uid: true })) {
          results.fetched++;
          const messageId = msg.envelope?.messageId || null;

          if (messageId && existingMsgIds.has(messageId)) { results.duplicates++; continue; }
          if (!messageId) {
            const subj = normalizeSubject(msg.envelope?.subject || '');
            const dateStr = msg.envelope?.date ? new Date(msg.envelope.date).toISOString().substring(0, 10) : '';
            const seqFp = `${subj}::${dateStr}`;
            if (existingSeqFingerprints.has(seqFp)) { results.duplicates++; continue; }
            existingSeqFingerprints.add(seqFp);
          }
          toFetch.push({ uid: msg.uid, envelope: msg.envelope });
        }
        log.push({ step: 'envelopes_done', new_count: toFetch.length, ts: Date.now() - startTime });

        // Phase 2: Per-message body fetch + store — bail out before hard limit
        for (const info of toFetch) {
          if (Date.now() - startTime > HARD_LIMIT_MS) {
            log.push({ step: 'hard_limit_reached', remaining: toFetch.length, ts: Date.now() - startTime });
            break;
          }

          let bodyText = '';
          try {
            // fetchOne with a 12s timeout — if it hangs, skip body and store without it
            const msgWithBody = await withTimeout(
              client.fetchOne(String(info.uid), { bodyParts: ['1', '2'] }, { uid: true }),
              12000,
              `fetchOne uid=${info.uid}`
            );
            bodyText = extractBodyText(msgWithBody?.bodyParts);
          } catch (bodyErr) {
            log.push({ step: 'body_skip', uid: info.uid, reason: safeErr(bodyErr), ts: Date.now() - startTime });
            // Store message without body — better than dropping it entirely
          }

          try {
            const env = info.envelope;
            const messageId = env?.messageId || null;
            const fromEmail = env?.from?.[0]?.address || 'unknown@unknown';
            const fromName = env?.from?.[0]?.name || fromEmail;
            const toEmails = (env?.to || []).map(a => a.address).filter(Boolean);
            const ccEmails = (env?.cc || []).map(a => a.address).filter(Boolean);
            const subject = env?.subject || '(no subject)';
            const normalizedSubj = normalizeSubject(subject);
            const receivedAt = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();
            const conversationKey = buildConversationKey(messageId, fromEmail, normalizedSubj);

            await base44.asServiceRole.entities.EmailMessageSandbox.create({
              mailbox_name: imapUser,
              direction: 'inbound',
              message_id: messageId,
              conversation_key: conversationKey,
              linked_conversation_key: conversationKey,
              in_reply_to: env?.inReplyTo || null,
              references_header: [],
              from_name: fromName,
              from_email: fromEmail,
              to_email: toEmails,
              cc_emails: ccEmails,
              bcc_emails: [],
              subject,
              normalized_subject: normalizedSubj,
              received_at: receivedAt,
              body_text: bodyText,
              body_html_sanitized: '',
              body_preview: bodyText.substring(0, 300),
              has_attachments: false,
              attachment_count: 0,
              attachments_meta_json: [],
              raw_headers_json: {},
              duplicate_status: 'original',
              processing_status: bodyText ? 'stored' : 'fetched',
              security_flag: 'normal',
              reviewed_manually: false,
              future_agent_access_allowed: false,
              future_agent_processing_status: 'disabled',
            });

            if (messageId) existingMsgIds.add(messageId);

            // Update or create conversation
            const allParticipants = Array.from(new Set([fromEmail, ...toEmails, ...ccEmails]));
            const existingConv = convMap.get(conversationKey);
            if (existingConv) {
              await base44.asServiceRole.entities.EmailConversationSandbox.update(existingConv.id, {
                last_message_at: receivedAt,
                message_count: (existingConv.message_count || 0) + 1,
                latest_direction: 'inbound',
                latest_from_email: fromEmail,
                latest_to_email: toEmails,
                latest_preview: bodyText.substring(0, 200),
                participant_summary: Array.from(new Set([...(existingConv.participant_summary || []), ...allParticipants])),
              });
              existingConv.message_count = (existingConv.message_count || 0) + 1;
            } else {
              const newConv = await base44.asServiceRole.entities.EmailConversationSandbox.create({
                conversation_key: conversationKey,
                primary_subject: subject,
                normalized_subject: normalizedSubj,
                participant_summary: allParticipants,
                first_message_at: receivedAt,
                last_message_at: receivedAt,
                message_count: 1,
                latest_direction: 'inbound',
                latest_from_email: fromEmail,
                latest_to_email: toEmails,
                latest_preview: bodyText.substring(0, 200),
                status_internal: 'open',
                reviewed_manually: false,
                future_agent_access_allowed: false,
              });
              convMap.set(conversationKey, newConv);
            }

            results.stored++;
            results.messages.push({ status: 'stored', message_id: messageId, from: fromEmail, subject });

          } catch (storeErr) {
            results.errors++;
            results.messages.push({ status: 'store_error', uid: info.uid, error: safeErr(storeErr) });
          }
        }
      }
    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }

    log.push({ step: 'done', ts: Date.now() - startTime });

    return Response.json({
      success: true,
      summary: {
        fetched: results.fetched,
        stored: results.stored,
        duplicates: results.duplicates,
        errors: results.errors,
        execution_time_ms: Date.now() - startTime,
      },
      message_log: results.messages,
      connection_log: log,
    });

  } catch (error) {
    if (client) await client.logout().catch(() => {});
    log.push({ step: 'top_level_error', error: safeErr(error), ts: Date.now() - startTime });
    return Response.json({
      success: false,
      error: safeErr(error),
      execution_time_ms: Date.now() - startTime,
      connection_log: log,
    }, { status: 500 });
  }
});