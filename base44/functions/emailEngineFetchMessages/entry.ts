/**
 * EMAIL ENGINE — Fetch & Store Inbound Messages
 *
 * ARCHITECTURE:
 * Phase 1: IMAP ENVELOPE FETCH (fast) — get metadata, deduplicate
 * Phase 2: RAW TLS BODY FETCH (reliable) — same approach as emailRetryAndProcess
 *          Uses Deno.connectTls directly, multiple IMAP strategies, proper UTF-8 QP decoding.
 *          If body fetch fails/times out, stores the record with empty body (status=fetched)
 *          so the auto-retry automation can pick it up later.
 *
 * ROOT CAUSE OF PREVIOUS FAILURES:
 * - imapflow.fetchOne() was silently returning empty bodyParts on Dovecot/edis.at
 * - decodeQuotedPrintable was using String.fromCharCode (latin-1) instead of TextDecoder (utf-8)
 * - No retry mechanism for empty-body records
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ImapFlow } from 'npm:imapflow@1.0.167';

const HARD_LIMIT_MS = 42000;
const IMAP_CONNECT_TIMEOUT = 10000;
const IMAP_SOCKET_TIMEOUT = 12000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSubject(subject) {
  if (!subject) return '';
  return subject.replace(/^((Re|Fwd?|AW|WG|SV|VS|FWD?|R|I)(\[\d+\])?:\s*)+/gi, '').trim().toLowerCase();
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

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Proper QP decode: collects raw bytes, then TextDecoder('utf-8')
 * This is the CORRECT approach — String.fromCharCode causes latin-1 corruption for multi-byte chars.
 */
function decodeQuotedPrintable(str) {
  const withoutSoftBreaks = str.replace(/=\r?\n/g, '');
  const bytes = [];
  let i = 0;
  while (i < withoutSoftBreaks.length) {
    if (withoutSoftBreaks[i] === '=' && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
    i++;
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch (_) {
    return bytes.map(b => String.fromCharCode(b)).join('');
  }
}

/**
 * Decode a MIME body part — handles:
 * 1. Pure base64 (Content-Transfer-Encoding: base64)
 * 2. Quoted-Printable
 * 3. Multipart MIME — extracts the first text/plain part (or text/html as fallback)
 * 4. Plain text (no encoding)
 */
function decodeMimeBody(raw) {
  if (!raw || !raw.trim()) return '';

  // Check if this looks like a full MIME multipart message
  // (contains MIME boundary markers and Content-Type headers)
  const hasMultipart = /--[^\r\n]{10,}/m.test(raw) && /Content-Type:\s*text\//im.test(raw);

  if (hasMultipart) {
    // Extract boundary
    const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1].trim() : null;

    if (boundary) {
      // Split by boundary, find text/plain part first
      const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
      let plainText = '';
      let htmlText = '';

      for (const part of parts) {
        if (!part.trim() || part.startsWith('--')) continue;

        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headers = part.substring(0, headerEnd);
        const body = part.substring(headerEnd + 4);

        const isPlain = /Content-Type:\s*text\/plain/i.test(headers);
        const isHtmlPart = /Content-Type:\s*text\/html/i.test(headers);
        const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(headers);
        const isQPPart = /Content-Transfer-Encoding:\s*quoted-printable/i.test(headers);

        if (isPlain || isHtmlPart) {
          let decoded = body.trim();
          if (isBase64) {
            try {
              const b64 = decoded.replace(/\r?\n/g, '');
              const binStr = atob(b64);
              const bytes = new Uint8Array(binStr.length);
              for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
              decoded = new TextDecoder('utf-8').decode(bytes);
            } catch (_) { /* keep raw */ }
          } else if (isQPPart) {
            decoded = decodeQuotedPrintable(decoded);
          }
          if (isPlain && !plainText) plainText = decoded;
          if (isHtmlPart && !htmlText) htmlText = decoded;
        }
      }

      // Prefer plain text; fall back to HTML
      if (plainText.trim()) return plainText.trim();
      if (htmlText.trim()) return htmlToText(htmlText.trim());
    }
  }

  // Not multipart — check if the whole thing is base64
  const stripped = raw.replace(/\r?\n/g, '');
  if (/^[A-Za-z0-9+/]+=*$/.test(stripped) && stripped.length > 50) {
    try {
      const binStr = atob(stripped);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) { /* not valid base64 */ }
  }

  // Check if QP
  if (/=[0-9A-F]{2}/i.test(raw)) {
    return decodeQuotedPrintable(raw);
  }

  return raw;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms))
  ]);
}

// ---------------------------------------------------------------------------
// Raw TLS IMAP body fetch — bypasses imapflow entirely
// Same approach as emailRetryAndProcess (proven to work)
// ---------------------------------------------------------------------------

async function rawImapFetchBody(host, port, user, pass, uid) {
  const TIMEOUT_MS = 12000;

  const strategies = [
    `FETCH ${uid} BODY.PEEK[1]`,
    `UID FETCH ${uid} BODY.PEEK[1]`,
    `FETCH ${uid} BODY.PEEK[TEXT]`,
    `UID FETCH ${uid} BODY.PEEK[TEXT]`,
    `FETCH ${uid} (RFC822.TEXT)`,
  ];

  for (const fetchCmd of strategies) {
    let conn;
    try {
      const enc = new TextEncoder();
      const dec = new TextDecoder('latin1');

      conn = await withTimeout(
        Deno.connectTls({ hostname: host, port, alpnProtocols: [] }),
        6000, 'tls_connect'
      );

      let readBuf = new Uint8Array(0);
      let tag = 1;

      const send = async (cmd) => {
        await conn.write(enc.encode(`A${tag++} ${cmd}\r\n`));
      };

      const readLine = async () => {
        while (true) {
          const str = dec.decode(readBuf);
          const idx = str.indexOf('\r\n');
          if (idx !== -1) {
            const line = str.substring(0, idx);
            readBuf = enc.encode(str.substring(idx + 2));
            return line;
          }
          const chunk = new Uint8Array(4096);
          const n = await withTimeout(conn.read(chunk), TIMEOUT_MS, 'readline');
          if (n === null) throw new Error('connection_closed');
          const combined = new Uint8Array(readBuf.length + n);
          combined.set(readBuf);
          combined.set(chunk.subarray(0, n), readBuf.length);
          readBuf = combined;
        }
      };

      const readBytes = async (n) => {
        while (readBuf.length < n) {
          const chunk = new Uint8Array(Math.max(4096, n - readBuf.length));
          const read = await withTimeout(conn.read(chunk), TIMEOUT_MS, 'readbytes');
          if (read === null) throw new Error('connection_closed_literal');
          const combined = new Uint8Array(readBuf.length + read);
          combined.set(readBuf);
          combined.set(chunk.subarray(0, read), readBuf.length);
          readBuf = combined;
        }
        const result = readBuf.subarray(0, n);
        readBuf = readBuf.subarray(n);
        return result; // return Uint8Array, not string — preserve bytes for UTF-8 decode
      };

      // Greeting
      const greeting = await readLine();
      if (!greeting.startsWith('* OK')) throw new Error(`bad_greeting`);

      // Auth
      await send(`LOGIN "${user}" "${pass}"`);
      let line;
      do { line = await readLine(); } while (!line.match(/^A\d+ (OK|NO|BAD)/));
      if (!line.match(/^A\d+ OK/)) throw new Error('auth_failed');

      // Select
      await send('SELECT INBOX');
      do { line = await readLine(); } while (!line.match(/^A\d+ (OK|NO|BAD)/));
      if (!line.match(/^A\d+ OK/)) throw new Error('select_failed');

      // Fetch
      await send(fetchCmd);

      let bodyBytes = null;
      while (true) {
        line = await readLine();
        const litMatch = line.match(/\{(\d+)\}$/);
        if (litMatch) {
          const size = parseInt(litMatch[1]);
          bodyBytes = await readBytes(size);
          await readLine(); // trailing CRLF
          break;
        }
        if (line.match(/^A\d+ (OK|NO|BAD)/)) break;
      }

      try { await send('LOGOUT'); } catch (_) {}
      try { conn.close(); } catch (_) {}

      if (bodyBytes && bodyBytes.length > 0) {
        // Decode as UTF-8 first, fall back to latin-1
        let raw;
        try {
          raw = new TextDecoder('utf-8').decode(bodyBytes);
        } catch (_) {
          raw = new TextDecoder('latin1').decode(bodyBytes);
        }

        const decoded = decodeMimeBody(raw);

        // Detect HTML
        const isHtml = /<html|<body|<div|<table/i.test(decoded);
        const text = isHtml ? htmlToText(decoded) : decoded;

        if (text.trim().length > 5) {
          return text.substring(0, 10000);
        }
      }
    } catch (_err) {
      try { if (conn) conn.close(); } catch (_) {}
      // Try next strategy
    }
  }

  return ''; // All strategies failed
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];
  let client = null;

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(parseInt(body.batch_size) || 4, 2), 8);

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

    const results = { fetched: 0, stored: 0, stored_without_body: 0, duplicates: 0, errors: 0, messages: [] };

    // --- Phase 1: Envelope fetch via imapflow (fast, reliable) ---
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

    const toFetch = [];
    try {
      if (total > 0) {
        const startSeq = Math.max(1, total - batchSize + 1);
        const range = `${startSeq}:${total}`;

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
      }
    } finally {
      lock.release();
      // Close imapflow — we'll use raw TLS for body fetch
      await client.logout().catch(() => {});
      client = null;
    }

    // --- Phase 2: Per-message raw TLS body fetch + store ---
    for (const info of toFetch) {
      if (Date.now() - startTime > HARD_LIMIT_MS) {
        log.push({ step: 'hard_limit_reached', remaining: toFetch.length, ts: Date.now() - startTime });
        break;
      }

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
      const replyToEmails = (env?.replyTo || []).map(a => a.address).filter(Boolean);
      const replyToHeader = replyToEmails.length > 0 ? replyToEmails[0] : null;

      // Raw TLS body fetch — proven reliable on Dovecot/edis.at
      let bodyText = '';
      try {
        bodyText = await withTimeout(
          rawImapFetchBody(host, port, imapUser, imapPass, info.uid),
          18000,
          `body_uid=${info.uid}`
        );
        log.push({ step: 'body_fetched', uid: info.uid, bodyLen: bodyText.length, ts: Date.now() - startTime });
      } catch (bodyErr) {
        log.push({ step: 'body_skip', uid: info.uid, reason: safeErr(bodyErr), ts: Date.now() - startTime });
        // Store without body — auto-retry automation will pick it up
      }

      try {
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
          raw_headers_json: replyToHeader ? { reply_to: replyToHeader } : {},
          duplicate_status: 'original',
          // 'stored' = has body, 'fetched' = no body yet (auto-retry will handle)
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

        if (bodyText) {
          results.stored++;
        } else {
          results.stored_without_body++;
        }
        results.messages.push({ status: bodyText ? 'stored' : 'stored_no_body', message_id: messageId, from: fromEmail, subject });

      } catch (storeErr) {
        results.errors++;
        results.messages.push({ status: 'store_error', uid: info.uid, error: safeErr(storeErr) });
      }
    }

    log.push({ step: 'done', ts: Date.now() - startTime });

    return Response.json({
      success: true,
      summary: {
        fetched: results.fetched,
        stored: results.stored,
        stored_without_body: results.stored_without_body,
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