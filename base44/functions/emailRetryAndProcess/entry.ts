/**
 * EMAIL ENGINE — Retry body fetch for a single message + optionally create Lead
 *
 * Connects directly to IMAP, fetches the body for the given Message-ID (or DB record ID),
 * saves it to EmailMessageSandbox, then (if requested) runs lead extraction.
 *
 * Usage:
 *   { sandbox_record_id: "...", create_lead: true }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ')
    .trim();
}

function decodeQuotedPrintable(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function safeErr(err) {
  return (err?.message || String(err) || 'Unknown error')
    .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
    .substring(0, 500);
}

function extractBodyFromParts(bodyParts) {
  if (!bodyParts) return '';
  for (const key of ['TEXT', '1', '1.1', '1.2']) {
    const part = bodyParts[key];
    if (part && part.length > 0) {
      return part.toString('utf-8').substring(0, 15000);
    }
  }
  for (const key of ['2', '1.2', 'HTML']) {
    const part = bodyParts[key];
    if (part && part.length > 0) {
      return htmlToText(part.toString('utf-8')).substring(0, 15000);
    }
  }
  return '';
}

function extractBodyFromSource(sourceBuffer) {
  const raw = sourceBuffer.toString('utf-8');
  const splitIdx = raw.indexOf('\r\n\r\n');
  const bodyRaw = splitIdx >= 0 ? raw.substring(splitIdx + 4) : raw;

  // Try plain/text first
  const plainMatch = bodyRaw.match(/Content-Type:\s*text\/plain[^\r\n]*(?:\r\n[^\r\n:]+)*\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n--|$)/i);
  if (plainMatch) {
    return decodeQuotedPrintable(plainMatch[1]).substring(0, 15000);
  }

  // HTML fallback
  const htmlMatch = bodyRaw.match(/Content-Type:\s*text\/html[^\r\n]*(?:\r\n[^\r\n:]+)*\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n--|$)/i);
  if (htmlMatch) return htmlToText(htmlMatch[1]).substring(0, 15000);

  // Whole body as fallback
  return htmlToText(bodyRaw).substring(0, 15000);
}

// ---------------------------------------------------------------------------
// IMAP body fetch — tries bodyParts, falls back to source
// ---------------------------------------------------------------------------

async function fetchBodyFromImap(host, port, user, pass, messageId) {
  const log = [];
  const client = new ImapFlow({
    host, port,
    secure: true,
    auth: { user, pass },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 90000,
    disableAutoIdle: true,
  });

  try {
    await client.connect();
    const lock = await Promise.race([
      client.getMailboxLock('INBOX'),
      new Promise((_, r) => setTimeout(() => r(new Error('lock_timeout')), 15000)),
    ]);

    let bodyText = '';
    let uid = null;

    try {
      // Step 1: find UID by Message-ID header search
      const cleanMsgId = messageId.replace(/[<>]/g, '').trim();
      const searchResults = await Promise.race([
        client.search({ header: ['Message-ID', cleanMsgId] }),
        new Promise((_, r) => setTimeout(() => r(new Error('search_timeout')), 15000)),
      ]);

      if (searchResults && searchResults.length > 0) {
        uid = searchResults[searchResults.length - 1];
        log.push({ step: 'uid_found', uid });
      } else {
        // Fallback: scan envelope list
        log.push({ step: 'search_miss_scanning_envelopes' });
        const total = client.mailbox.exists || 0;
        if (total > 0) {
          const start = Math.max(1, total - 100);
          for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, uid: true })) {
            if (msg.envelope?.messageId?.replace(/[<>]/g, '').trim() === cleanMsgId) {
              uid = msg.uid;
              log.push({ step: 'uid_found_via_scan', uid });
              break;
            }
          }
        }
      }

      if (!uid) throw new Error('message_not_found_on_server');

      // Step 2: fetch bodyParts (TEXT section only — fastest)
      log.push({ step: 'fetching_bodyparts', uid });
      let fetched = null;
      const bpOp = (async () => {
        for await (const m of client.fetch({ uid: `${uid}` }, { bodyParts: ['TEXT', '1', '1.1', '1.2', '2'], uid: true })) {
          fetched = m;
          break;
        }
      })();
      await Promise.race([bpOp, new Promise((_, r) => setTimeout(() => r(new Error('bodyparts_timeout')), 50000))]);

      if (fetched?.bodyParts) {
        bodyText = extractBodyFromParts(fetched.bodyParts);
        log.push({ step: 'bodyparts_ok', length: bodyText.length });
      }

      // Step 3: fallback to full source if bodyParts gave nothing
      if (!bodyText) {
        log.push({ step: 'bodyparts_empty_fallback_source' });
        let srcMsg = null;
        const srcOp = (async () => {
          for await (const m of client.fetch({ uid: `${uid}` }, { source: true }, { uid: true })) {
            srcMsg = m;
            break;
          }
        })();
        await Promise.race([srcOp, new Promise((_, r) => setTimeout(() => r(new Error('source_timeout')), 50000))]);

        if (srcMsg?.source) {
          bodyText = extractBodyFromSource(srcMsg.source);
          log.push({ step: 'source_ok', length: bodyText.length });
        }
      }

    } finally {
      lock.release();
      await Promise.race([client.logout(), new Promise(r => setTimeout(r, 3000))]).catch(() => {});
    }

    return { bodyText, log };
  } catch (err) {
    try { await client.logout().catch(() => {}); } catch (_) {}
    throw Object.assign(new Error(safeErr(err)), { log });
  }
}

// ---------------------------------------------------------------------------
// Lead extraction (inline — no dependency on external function)
// ---------------------------------------------------------------------------

const INTERNAL_DOMAINS = ['alpha-yachting.hr', 'alphayachting.hr', 'alpha-yachting.at', 'alphayachting.at', 'alpha-yachting.com', 'alpha-yachting.eu'];

function isInternal(email) {
  const domain = (email?.split('@')[1] || '').toLowerCase();
  return INTERNAL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
}

function extractLeadFromBody(record) {
  const body = record.body_text || '';
  const subject = record.subject || '(no subject)';
  let name = record.from_name || record.from_email || '';
  let email = record.from_email || '';

  // If internal sender, try to find real customer in body
  if (isInternal(email)) {
    const fwdMatch = body.match(/(?:Von|From):\s*([^<\n]{0,80})<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i);
    if (fwdMatch && !isInternal(fwdMatch[2])) {
      name = fwdMatch[1].replace(/["']/g, '').trim();
      email = fwdMatch[2].toLowerCase().trim();
    } else {
      const emailMatch = body.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g);
      const ext = (emailMatch || []).find(e => !isInternal(e.toLowerCase()));
      if (ext) { email = ext.toLowerCase(); name = ext; }
      else return { blocked: true, reason: 'internal_sender' };
    }
  }

  // Extract phone
  const phoneMatch = body.match(/(\+?[\d\s\-().]{7,25})/);
  const digits = (phoneMatch?.[1] || '').replace(/\D/g, '');
  const phone = (digits.length >= 7 && digits.length <= 15) ? phoneMatch[1].trim() : '+0';

  // Classify
  const c = `${subject} ${body}`.toLowerCase();
  const inquiryType = c.match(/notfall|emergency|urgent/) ? 'Emergency'
    : c.match(/part|ersatzteil|spare/) ? 'Parts Request'
    : c.match(/service|wartung|maintenance|winter|antifoul/) ? 'Maintenance'
    : 'Service Inquiry';

  return {
    blocked: false,
    payload: {
      name, email, phone,
      contact_method: 'Email',
      inquiry_type: inquiryType,
      priority: c.match(/urgent|dringend|sofort|emergency/) ? 'Urgent' : 'Medium',
      status: 'New Incoming',
      description: body.substring(0, 5000),
      notes: `[Auto-created via manual retry]\nFrom: ${record.from_email}\nSubject: ${subject}\nMessage-ID: ${record.message_id || 'n/a'}`,
    }
  };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { sandbox_record_id, create_lead = false } = body;

    if (!sandbox_record_id) {
      return Response.json({ success: false, error: 'sandbox_record_id required' }, { status: 400 });
    }

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured' }, { status: 500 });
    }

    // Load the sandbox record
    const records = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ id: sandbox_record_id });
    const record = records?.[0];
    if (!record) return Response.json({ success: false, error: 'Record not found' }, { status: 404 });

    if (!record.message_id) {
      return Response.json({ success: false, error: 'No Message-ID on record — cannot locate on IMAP server' }, { status: 400 });
    }

    // Fetch body from IMAP
    let bodyText = '';
    let fetchLog = [];
    let fetchError = null;

    try {
      const result = await fetchBodyFromImap(host, port, imapUser, imapPass, record.message_id);
      bodyText = result.bodyText;
      fetchLog = result.log;
    } catch (err) {
      fetchError = safeErr(err);
      fetchLog = err.log || [];
    }

    if (fetchError && !bodyText) {
      return Response.json({
        success: false,
        error: `IMAP fetch failed: ${fetchError}`,
        fetch_log: fetchLog,
        execution_time_ms: Date.now() - startTime,
      }, { status: 502 });
    }

    // Save body back to DB
    const newStatus = bodyText ? 'stored' : 'fetched';
    await base44.asServiceRole.entities.EmailMessageSandbox.update(record.id, {
      body_text: bodyText,
      body_preview: bodyText.substring(0, 300),
      processing_status: newStatus,
      imap_fetch_log: JSON.stringify(fetchLog).substring(0, 2000),
    });

    const updatedRecord = { ...record, body_text: bodyText, processing_status: newStatus };

    // Optionally create Lead
    let leadResult = null;
    if (create_lead && bodyText) {
      // Check if already bridged
      const bridges = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.filter({ source_sandbox_record_id: record.id });
      if (bridges && bridges.length > 0) {
        leadResult = { skipped: true, reason: 'already_bridged', bridge_id: bridges[0].id };
      } else {
        const extracted = extractLeadFromBody(updatedRecord);
        if (extracted.blocked) {
          leadResult = { skipped: true, reason: extracted.reason };
        } else {
          const lead = await base44.asServiceRole.entities.Lead.create(extracted.payload);
          await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
            source_email_message_id: record.message_id,
            source_sandbox_record_id: record.id,
            source_conversation_key: record.conversation_key,
            source_from_email: extracted.payload.email,
            source_from_name: extracted.payload.name,
            source_subject: record.subject,
            source_received_at: record.received_at,
            lead_created: true,
            created_lead_id: lead.id,
            duplicate_check_status: 'unique',
            extraction_status: 'extracted',
            creation_status: 'created',
            extracted_lead_payload_json: extracted.payload,
            auto_created_at: new Date().toISOString(),
          });
          leadResult = { created: true, lead_id: lead.id, name: extracted.payload.name, email: extracted.payload.email };
        }
      }
    }

    return Response.json({
      success: true,
      body_fetched: !!bodyText,
      body_length: bodyText.length,
      processing_status: newStatus,
      lead_result: leadResult,
      fetch_log: fetchLog,
      execution_time_ms: Date.now() - startTime,
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: safeErr(error),
      execution_time_ms: Date.now() - startTime,
    }, { status: 500 });
  }
});