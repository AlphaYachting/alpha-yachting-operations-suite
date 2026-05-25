// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
// FIX SUMMARY:
// 1. Multi-line ENVELOPE buffering (edis.at splits FETCH response across lines)
// 2. UTF-8 decoder instead of latin1 (fixes Mojibake for German/Croatian chars)
// 3. HTML body auto-converted to plain text
// 4. Phantom messages (null message_id) deduplicated by seq-based fingerprint
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
  return (err?.message || 'Unknown error')
    .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
    .substring(0, 500);
}

function decodeQuotedPrintable(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeImapString(s) {
  if (!s) return '';
  // Handle encoded words: =?charset?B/Q?text?=
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') {
        // Base64 decode with charset awareness
        const binStr = atob(text);
        if (charset.toLowerCase().startsWith('utf')) {
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          return new TextDecoder('utf-8').decode(bytes);
        }
        return binStr;
      }
      if (enc.toUpperCase() === 'Q') {
        const qp = decodeQuotedPrintable(text.replace(/_/g, ' '));
        if (charset.toLowerCase().startsWith('utf')) {
          const bytes = new Uint8Array(qp.length);
          for (let i = 0; i < qp.length; i++) bytes[i] = qp.charCodeAt(i);
          return new TextDecoder('utf-8').decode(bytes);
        }
        return qp;
      }
    } catch (_) {}
    return text;
  });
}

// IMAP ENVELOPE parser — handles quoted strings, literals {n}, nested parens, NIL
function parseImapEnvelope(str) {
  let i = 0;
  const s = str.trim();

  function skipSpace() { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; }

  function readToken() {
    skipSpace();
    if (i >= s.length) return null;
    if (s[i] === '{') {
      const end = s.indexOf('}', i);
      const len = parseInt(s.substring(i + 1, end));
      i = end + 1;
      if (s[i] === '\r') i++;
      if (s[i] === '\n') i++;
      const val = s.substring(i, i + len);
      i += len;
      return val;
    }
    if (s[i] === '(') {
      let depth = 0, start = i;
      while (i < s.length) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') { depth--; if (depth === 0) { i++; return s.substring(start, i); } }
        i++;
      }
      return null;
    }
    if (s[i] === '"') {
      let j = i + 1, out = '';
      while (j < s.length) {
        if (s[j] === '\\') { out += s[j + 1]; j += 2; }
        else if (s[j] === '"') { j++; i = j; return out; }
        else { out += s[j]; j++; }
      }
      return null;
    }
    if (s.substring(i, i + 3).toUpperCase() === 'NIL') { i += 3; return null; }
    let j = i;
    while (j < s.length && s[j] !== ' ' && s[j] !== ')' && s[j] !== '(') j++;
    const tok = s.substring(i, j); i = j; return tok;
  }

  if (s[i] === '(') i++;
  const tokens = [];
  for (let n = 0; n < 10; n++) tokens.push(readToken());

  const date = tokens[0];
  const subject = tokens[1] ? decodeImapString(tokens[1]) : '(no subject)';
  const fromList = parseAddressList(tokens[2]);
  const toList = parseAddressList(tokens[5]);
  const messageId = tokens[9] ? tokens[9].replace(/[<>]/g, '').trim() : null;

  return {
    date: date ? new Date(date) : new Date(),
    subject,
    from: fromList,
    to: toList,
    messageId,
  };
}

function parseAddressList(token) {
  if (!token || token === 'NIL') return [];
  const results = [];
  let i = 0;
  const s = token.trim();

  function skipSpace() { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; }

  function readField() {
    skipSpace();
    if (i >= s.length) return null;
    if (s.substring(i, i + 3).toUpperCase() === 'NIL') { i += 3; return null; }
    if (s[i] === '"') {
      let j = i + 1, out = '';
      while (j < s.length) {
        if (s[j] === '\\') { out += s[j + 1]; j += 2; }
        else if (s[j] === '"') { j++; i = j; return out; }
        else { out += s[j]; j++; }
      }
      return null;
    }
    let j = i;
    while (j < s.length && s[j] !== ' ' && s[j] !== ')' && s[j] !== '(') j++;
    const tok = s.substring(i, j); i = j;
    return tok || null;
  }

  while (i < s.length) {
    skipSpace();
    if (i >= s.length) break;
    if (s[i] !== '(') { i++; continue; }
    i++;
    const name = readField();
    const _route = readField();
    const mailbox = readField();
    const host = readField();
    while (i < s.length && s[i] !== ')') i++;
    if (i < s.length) i++;
    if (mailbox && host) {
      const decodedName = name ? decodeImapString(name) : '';
      results.push({ name: decodedName, address: `${mailbox}@${host}` });
    }
  }
  return results;
}

// Raw IMAP connection — UTF-8 decoder (FIX #2)
async function rawImapConnection(host, port, user, pass) {
  const CONNECT_TIMEOUT = 12000;
  const READ_TIMEOUT = 25000;
  const enc = new TextEncoder();
  // FIX #2: Use UTF-8 instead of latin1 — edis.at sends UTF-8 encoded emails
  const dec = new TextDecoder('utf-8');
  let tagNum = 1;

  const withTimeout = (p, ms, label) =>
    Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout_${label}`)), ms))]);

  const conn = await withTimeout(Deno.connectTls({ hostname: host, port, alpnProtocols: [] }), CONNECT_TIMEOUT, 'connect');
  let readBuf = new Uint8Array(0);

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
      const n = await withTimeout(conn.read(chunk), READ_TIMEOUT, 'read');
      if (n === null) throw new Error('connection_closed');
      const combined = new Uint8Array(readBuf.length + n);
      combined.set(readBuf); combined.set(chunk.subarray(0, n), readBuf.length);
      readBuf = combined;
    }
  };

  const readBytes = async (n) => {
    while (readBuf.length < n) {
      const chunk = new Uint8Array(Math.max(4096, n - readBuf.length));
      const read = await withTimeout(conn.read(chunk), READ_TIMEOUT, 'read_literal');
      if (read === null) throw new Error('connection_closed_in_literal');
      const combined = new Uint8Array(readBuf.length + read);
      combined.set(readBuf); combined.set(chunk.subarray(0, read), readBuf.length);
      readBuf = combined;
    }
    const result = dec.decode(readBuf.subarray(0, n));
    readBuf = readBuf.subarray(n);
    return result;
  };

  const sendCmd = async (cmd) => {
    const t = `A${tagNum++}`;
    await conn.write(enc.encode(`${t} ${cmd}\r\n`));
    return t;
  };

  const waitForTag = async (t) => {
    let line;
    do { line = await readLine(); } while (!line.startsWith(`${t} `));
    return line;
  };

  const close = () => { try { conn.close(); } catch (_) {} };

  const greeting = await readLine();
  if (!greeting.startsWith('* OK')) throw new Error('bad_greeting');
  const loginTag = await sendCmd(`LOGIN "${user}" "${pass}"`);
  const loginResp = await waitForTag(loginTag);
  if (!loginResp.includes(' OK')) throw new Error('auth_failed');
  const selTag = await sendCmd('SELECT INBOX');
  let existsCount = 0;
  const untaggedLines = [];
  let selLine;
  while (true) {
    selLine = await readLine();
    if (selLine.startsWith(`${selTag} `)) break;
    untaggedLines.push(selLine);
  }
  if (!selLine.includes(' OK')) throw new Error('select_failed');
  for (const l of untaggedLines) {
    const m = l.match(/^\* (\d+) EXISTS/);
    if (m) existsCount = parseInt(m[1]);
  }

  return { sendCmd, waitForTag, readLine, readBytes, close, existsCount };
}

// FIX #1: Buffer ALL lines for a FETCH response until the tagged end,
// then join them before parsing ENVELOPE.
// edis.at splits multi-line FETCH responses — previous code only read 1 line.
async function fetchEnvelopesOnConn(conn, start, end, log, startTime) {
  const envelopes = [];
  const ENVELOPE_TIMEOUT = 8000;
  log.push({ step: 'p1_fetch_envelopes', range: `${start}:${end}`, ts: Date.now() - startTime });

  for (let seq = start; seq <= end; seq++) {
    const result = await Promise.race([
      (async () => {
        const fetchTag = await conn.sendCmd(`FETCH ${seq} (UID ENVELOPE)`);
        // Collect ALL lines until the tagged response (edis.at may split across lines)
        const allLines = [];
        while (true) {
          const line = await conn.readLine();
          if (line.startsWith(`${fetchTag} `)) break;
          allLines.push(line);
        }
        // Join all lines — handles multi-line ENVELOPE responses
        const combined = allLines.join(' ');
        
        const uidMatch = combined.match(/UID (\d+)/i);
        const uid = uidMatch ? parseInt(uidMatch[1]) : seq;
        
        const envIdx = combined.toUpperCase().indexOf('ENVELOPE (');
        let envelope = null;
        if (envIdx !== -1) {
          envelope = parseImapEnvelope(combined.substring(envIdx + 9));
        }
        return { uid, seqNum: seq, envelope };
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('envelope_msg_timeout')), ENVELOPE_TIMEOUT)),
    ]).catch(err => {
      log.push({ step: 'p1_envelope_skip', seq, error: err.message, ts: Date.now() - startTime });
      return null;
    });

    if (result) envelopes.push(result);
  }

  log.push({ step: 'p1_envelopes_done', count: envelopes.length, ts: Date.now() - startTime });
  return envelopes;
}

// FIX #3: HTML body detection and conversion
function processBodyText(rawBody, isHtml) {
  if (!rawBody || !rawBody.trim()) return '';
  const decoded = decodeQuotedPrintable(rawBody);
  // Auto-detect HTML even if isHtml flag not set
  const looksLikeHtml = isHtml || /<html|<body|<div|<table/i.test(decoded);
  const text = looksLikeHtml ? htmlToText(decoded) : decoded;
  return text.substring(0, 10000);
}

// Fetch body for a single UID — opens its own connection
async function fetchBodyForUID(host, port, user, pass, uid, log, startTime) {
  log.push({ step: 'fetch_body', uid, ts: Date.now() - startTime });
  const conn = await rawImapConnection(host, port, user, pass);
  let body = '';
  let isHtml = false;
  try {
    const fetchTag = await conn.sendCmd(`UID FETCH ${uid} BODY.PEEK[1]`);
    let fetchedEmpty = false;
    while (true) {
      const line = await conn.readLine();
      if (line.startsWith(`${fetchTag} `)) break;
      const litMatch = line.match(/\{(\d+)\}$/);
      if (litMatch) {
        body = await conn.readBytes(parseInt(litMatch[1]));
        await conn.readLine();
      }
      if (line.includes('* 0 FETCH') || line.includes('NIL')) fetchedEmpty = true;
    }
    // If empty, try HTML part 2
    if (!body.trim() && !fetchedEmpty) {
      const fetchTag2 = await conn.sendCmd(`UID FETCH ${uid} BODY.PEEK[2]`);
      while (true) {
        const line = await conn.readLine();
        if (line.startsWith(`${fetchTag2} `)) break;
        const litMatch = line.match(/\{(\d+)\}$/);
        if (litMatch) {
          body = await conn.readBytes(parseInt(litMatch[1]));
          await conn.readLine();
          isHtml = true;
        }
      }
    }
  } finally {
    try { await conn.sendCmd('LOGOUT'); } catch (_) {}
    conn.close();
  }
  return processBodyText(body, isHtml);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(parseInt(body.batch_size) || 10, 5), 20);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    log.push({ step: 'config', host, port, user: imapUser, batch: batchSize, ts: 0 });
    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured', log });
    }

    // Load existing message IDs and conversations from DB
    const [existingMessages, existingConversations] = await Promise.all([
      base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 500),
      base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 200),
    ]);
    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));
    // FIX #4: Also track null-message_id phantom duplicates by seq fingerprint
    const existingSeqFingerprints = new Set(
      (existingMessages || [])
        .filter(m => !m.message_id)
        .map(m => `${m.normalized_subject}::${m.received_at?.substring(0, 10)}`)
        .filter(Boolean)
    );
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));
    log.push({ step: 'db_loaded', known_ids: existingMsgIds.size, convs: convMap.size, ts: Date.now() - startTime });

    const results = { fetched: 0, stored: 0, duplicates: 0, errors: 0, messages: [] };

    const newEnvelopes = [];
    const p1Conn = await rawImapConnection(host, port, imapUser, imapPass);
    const total = p1Conn.existsCount;
    log.push({ step: 'p1_inbox', total, ts: Date.now() - startTime });

    try {
      if (total > 0) {
        const startSeq = Math.max(1, total - batchSize + 1);
        const rawEnvs = await fetchEnvelopesOnConn(p1Conn, startSeq, total, log, startTime);
        for (const e of rawEnvs) {
          results.fetched++;
          const msgId = e.envelope?.messageId || null;
          
          if (msgId && existingMsgIds.has(msgId)) { results.duplicates++; continue; }
          
          // FIX #4: Deduplicate null-message_id phantoms by subject+date fingerprint
          if (!msgId) {
            const subj = normalizeSubject(e.envelope?.subject || '');
            const dateStr = e.envelope?.date ? new Date(e.envelope.date).toISOString().substring(0, 10) : '';
            const seqFp = `${subj}::${dateStr}`;
            if (existingSeqFingerprints.has(seqFp)) { results.duplicates++; continue; }
            existingSeqFingerprints.add(seqFp);
          }
          
          newEnvelopes.push(e);
        }
        log.push({ step: 'p1_done', new_count: newEnvelopes.length, ts: Date.now() - startTime });
      }
    } finally {
      try { await p1Conn.sendCmd('LOGOUT'); } catch (_) {}
      p1Conn.close();
    }

    if (newEnvelopes.length === 0) {
      log.push({ step: 'no_new_messages', ts: Date.now() - startTime });
      return Response.json({
        success: true,
        summary: { fetched: results.fetched, stored: 0, duplicates: results.duplicates, errors: 0, execution_time_ms: Date.now() - startTime },
        message_log: results.messages,
        connection_log: log,
      });
    }

    // === PHASE 2: Fetch body per UID ===
    for (const info of newEnvelopes) {
      if (Date.now() - startTime > 55000) {
        log.push({ step: 'time_limit', ts: Date.now() - startTime });
        break;
      }

      let bodyText = '';
      let sourceFailed = false;

      try {
        log.push({ step: 'p2_fetching_body', uid: info.uid, ts: Date.now() - startTime });
        bodyText = await fetchBodyForUID(host, port, imapUser, imapPass, info.uid, log, startTime);
        log.push({ step: 'p2_body_ok', uid: info.uid, body_len: bodyText.length, ts: Date.now() - startTime });
      } catch (srcErr) {
        sourceFailed = true;
        log.push({ step: 'p2_body_failed', uid: info.uid, error: safeErr(srcErr), ts: Date.now() - startTime });
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
          in_reply_to: null,
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
          processing_status: sourceFailed ? 'fetched' : 'stored',
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
        results.messages.push({ status: sourceFailed ? 'stored_no_body' : 'stored', message_id: messageId, from: fromEmail, subject });

      } catch (storeErr) {
        results.errors++;
        results.messages.push({ status: 'store_error', uid: info.uid, error: safeErr(storeErr) });
      }
    }

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
    log.push({ step: 'top_level_error', error: safeErr(error), ts: Date.now() - startTime });
    return Response.json({
      success: false,
      error: safeErr(error),
      execution_time_ms: Date.now() - startTime,
      connection_log: log,
    }, { status: 500 });
  }
});