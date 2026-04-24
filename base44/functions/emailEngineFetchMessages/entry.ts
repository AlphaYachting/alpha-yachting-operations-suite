// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { Buffer } from 'node:buffer';

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
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function mimeType(struct) {
  if (!struct) return '';
  if (struct.type && struct.type.includes('/')) return struct.type.toLowerCase();
  if (struct.type && struct.subtype) return `${struct.type}/${struct.subtype}`.toLowerCase();
  return (struct.type || '').toLowerCase();
}

function findTextPartInfo(struct, parentNum = '') {
  if (!struct) return null;
  const mt = mimeType(struct);
  if (mt === 'text/plain') return { num: parentNum || '1', isHtml: false };
  if (mt === 'text/html') return { num: parentNum || '1', isHtml: true };
  if (mt.startsWith('multipart') && struct.childNodes?.length > 0) {
    for (let i = 0; i < struct.childNodes.length; i++) {
      const childNum = parentNum ? `${parentNum}.${i + 1}` : `${i + 1}`;
      if (mimeType(struct.childNodes[i]) === 'text/plain') return { num: childNum, isHtml: false };
    }
    for (let i = 0; i < struct.childNodes.length; i++) {
      const childNum = parentNum ? `${parentNum}.${i + 1}` : `${i + 1}`;
      if (mimeType(struct.childNodes[i]).startsWith('multipart')) {
        const result = findTextPartInfo(struct.childNodes[i], childNum);
        if (result) return result;
      }
    }
    for (let i = 0; i < struct.childNodes.length; i++) {
      const childNum = parentNum ? `${parentNum}.${i + 1}` : `${i + 1}`;
      if (mimeType(struct.childNodes[i]) === 'text/html') return { num: childNum, isHtml: true };
    }
  }
  return null;
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

// Fetch a single value from a UID-based fetch with a timeout
async function fetchOneUID(client, uid, query, timeoutMs = 15000) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`fetch UID ${uid} timeout ${timeoutMs}ms`)), timeoutMs);
    try {
      let result = null;
      for await (const msg of client.fetch(`${uid}`, query, { uid: true })) {
        result = msg;
        break;
      }
      clearTimeout(timer);
      resolve(result);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function runImapFetch(client, batchSize, existingMsgIds, convMap, base44, imapUser, startTime, log) {
  const MAX_EXECUTION_TIME = 40000;
  const results = { fetched: 0, stored: 0, duplicates: 0, errors: 0, messages: [] };

  log.push({ step: 'imap_connect_start', ts: Date.now() - startTime });
  await client.connect();
  log.push({ step: 'imap_connect_ok', ts: Date.now() - startTime });

  const lock = await client.getMailboxLock('INBOX');
  log.push({ step: 'imap_inbox_locked', ts: Date.now() - startTime, exists: client.mailbox.exists });

  try {
    const total = client.mailbox.exists || 0;

    if (total === 0) {
      results.messages.push({ info: 'Inbox is empty' });
      return results;
    }

    // Use sequence numbers directly (1..total) — avoid UID SEARCH which stalls on this server
    // We'll fetch envelope for each individually and skip known message_ids
    const start = Math.max(1, total - Math.max(batchSize, 20) + 1);
    // Build sequence-number based candidate list (newest first)
    const candidateUids = Array.from({ length: total - start + 1 }, (_, i) => total - i);
    log.push({ step: 'candidate_seqs', count: candidateUids.length, range: `${start}:${total}`, ts: Date.now() - startTime });
    log.push({ step: 'candidate_uids', count: candidateUids.length, uids: candidateUids, ts: Date.now() - startTime });

    // Step 2+3 combined: fetch envelope + source in one pass over the sequence range
    // This avoids "Connection not available" errors caused by multiple sequential fetches
    const msgInfos = []; // collect new messages to process

    await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('bulk fetch timeout')), 40000);
      try {
        for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, bodyStructure: true, source: true, uid: true })) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME) break;

          results.fetched++;
          const messageId = msg.envelope?.messageId || null;
          if (messageId && existingMsgIds.has(messageId)) {
            results.duplicates++;
            continue;
          }

          const env = msg.envelope;
          const bodyStructure = msg.bodyStructure || null;

          // Parse body from source
          let bodyText = '';
          if (msg.source) {
            const raw = msg.source.toString('utf-8');
            const splitIdx = raw.indexOf('\r\n\r\n');
            const bodyRaw = splitIdx >= 0 ? raw.substring(splitIdx + 4) : raw;

            const plainMatch = bodyRaw.match(/Content-Type:\s*text\/plain[^\r\n]*(?:\r\n[^\r\n]+)*\r\n\r\n([\s\S]*?)(?=\r\n--)/i);
            if (plainMatch) {
              bodyText = plainMatch[1].replace(/=\r\n/g, '').trim().substring(0, 10000);
            } else {
              const htmlMatch = bodyRaw.match(/Content-Type:\s*text\/html[^\r\n]*(?:\r\n[^\r\n]+)*\r\n\r\n([\s\S]*?)(?=\r\n--)/i);
              if (htmlMatch) {
                bodyText = htmlToText(htmlMatch[1]).substring(0, 10000);
              } else {
                bodyText = htmlToText(bodyRaw).substring(0, 10000);
              }
            }
          }

          log.push({ step: 'msg_parsed', uid: msg.uid, body_len: bodyText.length, preview: bodyText.substring(0, 100), ts: Date.now() - startTime });
          msgInfos.push({ uid: msg.uid, envelope: env, bodyStructure, bodyText });
        }
        clearTimeout(timer);
        resolve();
      } catch (e) { clearTimeout(timer); reject(e); }
    });

    log.push({ step: 'bulk_fetch_done', new_messages: msgInfos.length, duplicates: results.duplicates, ts: Date.now() - startTime });

    // Step 3: Store each new message
    for (const info of msgInfos) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        results.messages.push({ status: 'timeout', info: `Stopped after ${results.stored} messages` });
        break;
      }

      try {
        const env = info.envelope;
        const bodyStructure = info.bodyStructure;
        const bodyText = info.bodyText;
        const messageId = env?.messageId || null;
        const fromEmail = env?.from?.[0]?.address || 'unknown@unknown';
        const fromName = env?.from?.[0]?.name || fromEmail;
        const toEmails = (env?.to || []).map(a => a.address).filter(Boolean);
        const ccEmails = (env?.cc || []).map(a => a.address).filter(Boolean);
        const subject = env?.subject || '(no subject)';
        const normalizedSubj = normalizeSubject(subject);
        const receivedAt = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();
        const conversationKey = buildConversationKey(messageId, fromEmail, normalizedSubj);
        const hasAttachments = !!(bodyStructure?.childNodes?.some(n => n.disposition === 'attachment'));
        const attachmentCount = bodyStructure?.childNodes?.filter(n => n.disposition === 'attachment').length || 0;

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
          has_attachments: hasAttachments,
          attachment_count: attachmentCount,
          attachments_meta_json: [],
          raw_headers_json: {},
          duplicate_status: 'original',
          processing_status: 'stored',
          security_flag: 'normal',
          reviewed_manually: false,
          future_agent_access_allowed: false,
          future_agent_processing_status: 'disabled',
        });

        if (messageId) existingMsgIds.add(messageId);

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

      } catch (msgErr) {
        results.errors++;
        results.messages.push({ status: 'error', uid: info.uid, error: safeErr(msgErr) });
      }
    }

  } finally {
    lock.release();
    await client.logout().catch(() => {});
    log.push({ step: 'imap_logout', ts: Date.now() - startTime });
  }

  return results;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];

  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(body.batch_size) || 5, 10);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    log.push({
      step: 'config_loaded',
      host,
      port,
      user: imapUser,
      pass_set: !!imapPass,
      ts: Date.now() - startTime,
    });

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured', log });
    }

    // DNS resolution check
    log.push({ step: 'dns_lookup_start', host, ts: Date.now() - startTime });
    try {
      const dnsResult = await Deno.resolveDns(host, 'A');
      log.push({ step: 'dns_lookup_ok', resolved: dnsResult, ts: Date.now() - startTime });
    } catch (dnsErr) {
      log.push({ step: 'dns_lookup_failed', error: safeErr(dnsErr), ts: Date.now() - startTime });
    }

    log.push({ step: 'loading_db_state', ts: Date.now() - startTime });
    const existingMessages = await base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 200);
    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));
    const existingConversations = await base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 200);
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));
    log.push({ step: 'db_state_loaded', existing_msg_ids: existingMsgIds.size, existing_convs: convMap.size, ts: Date.now() - startTime });

    const imapLogger = {
      debug: (obj) => { if (obj?.msg) log.push({ level: 'imap_debug', msg: obj.msg, ts: Date.now() - startTime }); },
      info:  (obj) => { log.push({ level: 'imap_info',  msg: obj?.msg || JSON.stringify(obj), ts: Date.now() - startTime }); },
      warn:  (obj) => { log.push({ level: 'imap_warn',  msg: obj?.msg || JSON.stringify(obj), ts: Date.now() - startTime }); },
      error: (obj) => { log.push({ level: 'imap_error', msg: safeErr(obj?.err || new Error(obj?.msg || 'imap error')), ts: Date.now() - startTime }); },
    };

    const client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: imapLogger,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,   // reduced from 30s — fail fast, don't wait 30s per stall
      disableAutoIdle: true,
    });

    client.on('error', (err) => {
      log.push({ step: 'imap_client_error_event', error: safeErr(err), ts: Date.now() - startTime });
    });

    const results = await Promise.race([
      runImapFetch(client, batchSize, existingMsgIds, convMap, base44, imapUser, startTime, log),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IMAP hard timeout after 50s')), 50000)),
    ]);

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