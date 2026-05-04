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

function decodeQuotedPrintable(str) {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64Body(str) {
  try {
    return atob(str.replace(/\s/g, ''));
  } catch (_) {
    return str;
  }
}

function extractBodyFromParts(bodyParts) {
  if (!bodyParts) return '';
  
  // Try plain text first
  const textPart = bodyParts['1'] || bodyParts['TEXT'] || null;
  if (textPart) {
    const raw = textPart.toString('utf-8');
    return raw.substring(0, 10000);
  }
  
  // Try HTML fallback
  const htmlPart = bodyParts['2'] || null;
  if (htmlPart) {
    return htmlToText(htmlPart.toString('utf-8')).substring(0, 10000);
  }
  
  return '';
}

function makeClient(host, port, user, pass, log, startTime) {
  const c = new ImapFlow({
    host, port,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,  // short — prevents 120s hangs on bad Dovecot responses
    disableAutoIdle: true,
  });
  c.on('error', (err) => log.push({ step: 'imap_error_event', error: safeErr(err), ts: Date.now() - startTime }));
  return c;
}

// Determine which body part numbers to fetch based on bodyStructure
// Returns { partNums, isHtml } — prefer plain text, fallback to HTML
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
  // Single-part (no childNodes, type is on root)
  if (bodyStructure.type === 'text/html') return { partNums: ['1'], isHtml: true };
  return { partNums: ['1'], isHtml: false };
}

// Fetch body text for a single UID using fetchOne (avoids for-await hang on Dovecot)
async function fetchBodyForUID(host, port, user, pass, uid, bodyStructure, log, startTime) {
  const client = makeClient(host, port, user, pass, log, startTime);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let bodyText = '';
    try {
      const { partNums, isHtml } = getBestPartNums(bodyStructure);
      log.push({ step: 'fetch_parts', uid, parts: partNums, isHtml, ts: Date.now() - startTime });

      const msg = await Promise.race([
        client.fetchOne(`${uid}`, { bodyParts: partNums }, { uid: true }),
        new Promise((_, r) => setTimeout(() => r(new Error('fetchOne_timeout')), 15000)),
      ]);

      if (msg?.bodyParts) {
        for (const pn of partNums) {
          const buf = msg.bodyParts[pn];
          if (buf && buf.length > 0) {
            const raw = buf.toString('utf-8');
            bodyText = isHtml ? htmlToText(raw).substring(0, 10000) : raw.substring(0, 10000);
            break;
          }
        }
      }

    } finally {
      lock.release();
      client.close(); // close() instead of logout() — avoids Dovecot 120s hang on connection teardown
    }
    return bodyText;
  } catch (err) {
    client.close();
    throw err;
  }
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
      new Promise((_, r) => setTimeout(() => r(new Error('lock_timeout')), 15000)),
    ]);
    try {
      total = client1.mailbox.exists || 0;
      log.push({ step: 'p1_inbox', total, ts: Date.now() - startTime });

      if (total > 0) {
        // Fetch more messages to catch up — look at last batchSize messages
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
          new Promise((_, r) => setTimeout(() => r(new Error('envelope_fetch_timeout')), 30000)),
        ]);
        log.push({ step: 'p1_done', new_count: newEnvelopes.length, ts: Date.now() - startTime });
      }
    } finally {
      lock1.release();
      client1.close();
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

    // === PHASE 2: Fetch body per UID using bodyParts (faster than source) ===
    for (const info of newEnvelopes) {
      if (Date.now() - startTime > 55000) {
        log.push({ step: 'time_limit', ts: Date.now() - startTime });
        break;
      }

      let bodyText = '';
      let sourceFailed = false;

      try {
        log.push({ step: 'p2_fetching_body', uid: info.uid, ts: Date.now() - startTime });
        bodyText = await fetchBodyForUID(host, port, imapUser, imapPass, info.uid, info.bodyStructure, log, startTime);
        log.push({ step: 'p2_body_ok', uid: info.uid, body_len: bodyText.length, ts: Date.now() - startTime });
      } catch (srcErr) {
        sourceFailed = true;
        log.push({ step: 'p2_body_failed', uid: info.uid, error: safeErr(srcErr), ts: Date.now() - startTime });
      }

      // Store the message
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