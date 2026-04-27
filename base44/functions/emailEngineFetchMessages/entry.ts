// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.167';

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

function makeClient(host, port, user, pass, log, startTime) {
  const c = new ImapFlow({
    host, port,
    secure: true,
    auth: { user, pass },
    logger: {
      debug: () => {},
      info:  (obj) => log.push({ level: 'imap_info',  msg: obj?.msg, ts: Date.now() - startTime }),
      warn:  (obj) => log.push({ level: 'imap_warn',  msg: obj?.msg || JSON.stringify(obj), ts: Date.now() - startTime }),
      error: (obj) => log.push({ level: 'imap_error', msg: safeErr(obj?.err || new Error(obj?.msg || 'err')), ts: Date.now() - startTime }),
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    disableAutoIdle: true,
  });
  c.on('error', (err) => log.push({ step: 'imap_error_event', error: safeErr(err), ts: Date.now() - startTime }));
  return c;
}

// Fetch source for a single UID with its own fresh connection
async function fetchSourceForUID(host, port, user, pass, uid, log, startTime) {
  const client = makeClient(host, port, user, pass, log, startTime);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      let source = null;
      const fetchOp = (async () => {
        for await (const m of client.fetch({ uid: `${uid}` }, { source: true }, { uid: true })) {
          source = m.source;
          break;
        }
      })();
      await Promise.race([
        fetchOp,
        new Promise((_, reject) => setTimeout(() => reject(new Error('source_timeout')), 20000)),
      ]);
      return source;
    } finally {
      lock.release();
      await Promise.race([client.logout(), new Promise(r => setTimeout(r, 2000))]).catch(() => {});
    }
  } catch (err) {
    try { await client.logout().catch(() => {}); } catch (_) {}
    throw err;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(parseInt(body.batch_size) || 5, 3), 10);

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
      base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 200),
      base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 200),
    ]);
    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));
    log.push({ step: 'db_loaded', known_ids: existingMsgIds.size, convs: convMap.size, ts: Date.now() - startTime });

    const results = { fetched: 0, stored: 0, duplicates: 0, errors: 0, messages: [] };

    // === PHASE 1: Envelope-only fetch (fast, no body) on one connection ===
    const client1 = makeClient(host, port, imapUser, imapPass, log, startTime);
    let total = 0;
    const newEnvelopes = []; // [{uid, envelope, bodyStructure}]

    await client1.connect();
    log.push({ step: 'p1_connected', ts: Date.now() - startTime });
    const lock1 = await Promise.race([
      client1.getMailboxLock('INBOX'),
      new Promise((_, r) => setTimeout(() => r(new Error('lock_timeout')), 12000)),
    ]);
    try {
      total = client1.mailbox.exists || 0;
      log.push({ step: 'p1_inbox', total, ts: Date.now() - startTime });

      if (total > 0) {
        const start = Math.max(1, total - batchSize + 1);
        const range = `${start}:${total}`;
        log.push({ step: 'p1_fetch_envelopes', range, ts: Date.now() - startTime });

        const envFetch = (async () => {
          for await (const msg of client1.fetch(range, { envelope: true, bodyStructure: true, uid: true })) {
            results.fetched++;
            const msgId = msg.envelope?.messageId || null;
            if (msgId && existingMsgIds.has(msgId)) {
              results.duplicates++;
              continue;
            }
            newEnvelopes.push({ uid: msg.uid, envelope: msg.envelope, bodyStructure: msg.bodyStructure || null });
          }
        })();
        await Promise.race([
          envFetch,
          new Promise((_, r) => setTimeout(() => r(new Error('envelope_fetch_timeout')), 25000)),
        ]);
        log.push({ step: 'p1_done', new_count: newEnvelopes.length, ts: Date.now() - startTime });
      }
    } finally {
      lock1.release();
      await client1.logout().catch(() => {});
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

    // === PHASE 2: Fetch source per UID — each gets its own fresh connection ===
    // edis.at is slow; each source fetch gets 20s before we give up and store empty body
    for (const info of newEnvelopes) {
      if (Date.now() - startTime > 55000) {
        log.push({ step: 'time_limit', ts: Date.now() - startTime });
        break;
      }

      let bodyText = '';
      let sourceFailed = false;

      try {
        log.push({ step: 'p2_fetching_source', uid: info.uid, ts: Date.now() - startTime });
        const source = await fetchSourceForUID(host, port, imapUser, imapPass, info.uid, log, startTime);
        if (source) {
          bodyText = parseBodyFromSource(source);
        }
        log.push({ step: 'p2_source_ok', uid: info.uid, body_len: bodyText.length, ts: Date.now() - startTime });
      } catch (srcErr) {
        sourceFailed = true;
        log.push({ step: 'p2_source_failed', uid: info.uid, error: safeErr(srcErr), ts: Date.now() - startTime });
      }

      // Store the message (body empty if source failed, will be repaired by refetch function)
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
        const bs = info.bodyStructure;
        const hasAttachments = !!(bs?.childNodes?.some(n => n.disposition === 'attachment'));
        const attachmentCount = bs?.childNodes?.filter(n => n.disposition === 'attachment').length || 0;

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
          processing_status: sourceFailed ? 'fetched' : 'stored',
          security_flag: 'normal',
          reviewed_manually: false,
          future_agent_access_allowed: false,
          future_agent_processing_status: 'disabled',
        });

        if (messageId) existingMsgIds.add(messageId);

        // Update conversation
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