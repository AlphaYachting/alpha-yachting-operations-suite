/**
 * EMAIL ENGINE — Retry body fetch for a single message + optionally create Lead
 *
 * Uses a raw TLS IMAP implementation to bypass imapflow's issues with this Dovecot server.
 * Connects directly, runs minimal IMAP commands, and reads the raw body with a hard socket timeout.
 *
 * Usage:
 *   { sandbox_record_id: "...", create_lead: true }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { connect as tlsConnect } from 'node:tls';

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

function getBestPartNums(bodyStructure) {
  if (!bodyStructure) return { partNums: ['1'], isHtml: false };
  const plain = [], html = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'text/plain' && node.part) { plain.push(node.part); return; }
    if (node.type === 'text/html' && node.part) { html.push(node.part); return; }
    if (node.childNodes) node.childNodes.forEach(walk);
  };
  walk(bodyStructure);
  if (plain.length > 0) return { partNums: plain, isHtml: false };
  if (html.length > 0) return { partNums: html, isHtml: true };
  if (bodyStructure.type === 'text/html') return { partNums: ['1'], isHtml: true };
  return { partNums: ['1'], isHtml: false };
}

// ---------------------------------------------------------------------------
// Raw TLS IMAP — bypasses imapflow entirely for body fetch
// Sends: LOGIN → SELECT INBOX → UID FETCH <uid> (BODYSTRUCTURE) → UID FETCH <uid> BODY.PEEK[<part>] → LOGOUT
// Uses a hard socket timeout so we never hang > 15s
// ---------------------------------------------------------------------------

function rawImapFetch(host, port, user, pass, uid, partNum) {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 15000;
    let buffer = '';
    let tag = 1;
    let phase = 'greeting'; // greeting → login → select → fetch → done
    let fetchBody = '';
    let inFetch = false;
    let fetchSize = 0;
    let fetchReceived = 0;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`raw_imap_timeout_in_phase_${phase}`));
    }, TIMEOUT_MS);

    const socket = tlsConnect({ host, port, rejectUnauthorized: false });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`socket_error: ${err.message}`));
    });

    const send = (cmd) => {
      const line = `A${tag++} ${cmd}\r\n`;
      socket.write(line);
    };

    const finish = (result) => {
      clearTimeout(timer);
      try { socket.write(`A${tag} LOGOUT\r\n`); } catch (_) {}
      setTimeout(() => socket.destroy(), 500);
      resolve(result);
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('binary');

      // If we're in a fetch literal, accumulate bytes
      if (inFetch) {
        fetchReceived += chunk.length;
        if (fetchReceived >= fetchSize) {
          inFetch = false;
          finish({ body: Buffer.from(fetchBody + buffer, 'binary').toString('utf-8').substring(0, 15000) });
          return;
        }
        fetchBody += chunk.toString('binary');
        return;
      }

      const lines = buffer.split('\r\n');
      buffer = lines.pop() || ''; // keep incomplete line

      for (const line of lines) {
        // Detect fetch literal: * <seq> FETCH ... {<size>}
        const litMatch = line.match(/\* \d+ FETCH .*\{(\d+)\}/);
        if (litMatch) {
          fetchSize = parseInt(litMatch[1]);
          fetchReceived = 0;
          fetchBody = '';
          inFetch = true;
          continue;
        }

        if (phase === 'greeting' && line.startsWith('* OK')) {
          phase = 'login';
          send(`LOGIN "${user}" "${pass}"`);
          continue;
        }

        if (phase === 'login' && line.match(/^A\d+ OK/)) {
          phase = 'select';
          send('SELECT INBOX');
          continue;
        }

        if (phase === 'select' && line.match(/^A\d+ OK/)) {
          phase = 'fetch';
          send(`UID FETCH ${uid} BODY.PEEK[${partNum}]`);
          continue;
        }

        if (phase === 'fetch' && line.match(/^A\d+ OK/)) {
          // fetch done but we didn't get a literal — empty body
          finish({ body: '' });
          return;
        }

        if (line.match(/^A\d+ (NO|BAD)/)) {
          if (phase === 'login') { clearTimeout(timer); socket.destroy(); reject(new Error('auth_failed')); return; }
          finish({ body: '' });
          return;
        }
      }
    });
  });
}

async function fetchBodyFromImap(host, port, user, pass, messageId) {
  const log = [];
  const client = new ImapFlow({
    host, port,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,  // short — prevents 120s hangs on bad Dovecot responses
    disableAutoIdle: true,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let bodyText = '';
    let uid = null;

    try {
      // Step 1: find UID by Message-ID header search
      const cleanMsgId = messageId.replace(/[<>]/g, '').trim();
      const searchResults = await Promise.race([
        client.search({ header: ['Message-ID', cleanMsgId] }),
        new Promise((_, r) => setTimeout(() => r(new Error('search_timeout')), 10000)),
      ]);

      if (searchResults && searchResults.length > 0) {
        uid = searchResults[searchResults.length - 1];
        log.push({ step: 'uid_found', uid });
      } else {
        // Fallback: scan last 100 envelopes
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
      log.push({ step: 'uid_resolved', uid });

    } finally {
      lock.release();
      client.close(); // close search connection before opening body-fetch connection
    }

    // --- Phase 2: get bodyStructure via imapflow (fast — no body data) ---
    const client2 = new ImapFlow({
      host, port, secure: true, auth: { user, pass },
      logger: false,
      connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
      disableAutoIdle: true,
    });

    let partNum = '1';
    let isHtml = false;

    try {
      await client2.connect();
      const lock2 = await client2.getMailboxLock('INBOX');
      try {
        log.push({ step: 'fetching_structure', uid });
        const structMsg = await Promise.race([
          client2.fetchOne(`${uid}`, { bodyStructure: true }, { uid: true }),
          new Promise((_, r) => setTimeout(() => r(new Error('structure_timeout')), 12000)),
        ]);
        const best = getBestPartNums(structMsg?.bodyStructure);
        partNum = best.partNums[0] || '1';
        isHtml = best.isHtml;
        log.push({ step: 'structure_ok', partNum, isHtml });
      } finally {
        lock2.release();
        client2.close();
      }
    } catch (_structErr) {
      log.push({ step: 'structure_failed_using_part1' });
      // proceed with default partNum = '1'
    }

    // --- Phase 3: raw TLS fetch — bypasses imapflow for body content ---
    log.push({ step: 'raw_fetch_start', uid, partNum });
    const rawResult = await rawImapFetch(host, port, user, pass, uid, partNum);
    log.push({ step: 'raw_fetch_done', body_len: rawResult.body?.length || 0 });

    if (rawResult.body && rawResult.body.trim().length > 0) {
      const raw = rawResult.body;
      // Decode QP if needed (quoted-printable), then convert HTML if needed
      const decoded = decodeQuotedPrintable(raw);
      bodyText = isHtml ? htmlToText(decoded).substring(0, 10000) : decoded.substring(0, 10000);
      log.push({ step: 'body_decoded', length: bodyText.length });
    }

    return { bodyText, log };
  } catch (err) {
    client.close();
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