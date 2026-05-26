// EMAIL ENGINE - Fetch & Store Inbound Messages
// Uses imapflow for reliable IMAP parsing (edis.at compatible).
// v2: batch-fetches all bodies in one IMAP call to avoid sequential roundtrip timeouts.
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

  // Prefer plain text part [1]
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

  // Fallback: HTML part [2]
  const html = bodyParts['2'];
  if (html && html.length > 0) {
    const text = html.toString('utf-8');
    return htmlToText(decodeQuotedPrintable(text)).substring(0, 10000);
  }

  return '';
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

    // Load existing message IDs from DB for deduplication (limit to recent 200)
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

    // Connect with imapflow — tighter timeouts to fail fast instead of hanging
    const client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 20000,
      disableAutoIdle: true,
    });

    await client.connect();
    log.push({ step: 'connected', ts: Date.now() - startTime });

    const lock = await client.getMailboxLock('INBOX');
    const total = client.mailbox?.exists || 0;
    log.push({ step: 'inbox', total, ts: Date.now() - startTime });

    try {
      if (total > 0) {
        const startSeq = Math.max(1, total - batchSize + 1);
        const range = `${startSeq}:${total}`;

        // Phase 1: Fetch envelopes only (fast, no body)
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

        if (toFetch.length > 0) {
          // Phase 2: Batch-fetch ALL bodies in one IMAP round-trip using UID set
          // This avoids N sequential fetchOne calls which was causing timeouts
          const uidSet = toFetch.map(m => m.uid).join(',');
          const bodyMap = new Map(); // uid -> bodyParts

          try {
            for await (const msg of client.fetch(uidSet, { bodyParts: ['1', '2'], uid: true }, { uid: true })) {
              if (msg.bodyParts) bodyMap.set(msg.uid, msg.bodyParts);
            }
            log.push({ step: 'bodies_batch_done', fetched: bodyMap.size, ts: Date.now() - startTime });
          } catch (batchBodyErr) {
            log.push({ step: 'bodies_batch_failed', error: safeErr(batchBodyErr), ts: Date.now() - startTime });
            // Continue — bodyMap will be empty, messages stored without body
          }

          // Phase 3: Store each new message (DB writes only, no more IMAP calls)
          for (const info of toFetch) {
            // Hard cutoff — leave 10s for cleanup and response
            if (Date.now() - startTime > 50000) {
              log.push({ step: 'time_limit', ts: Date.now() - startTime });
              break;
            }

            const bodyText = extractBodyText(bodyMap.get(info.uid));

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
    log.push({ step: 'top_level_error', error: safeErr(error), ts: Date.now() - startTime });
    return Response.json({
      success: false,
      error: safeErr(error),
      execution_time_ms: Date.now() - startTime,
      connection_log: log,
    }, { status: 500 });
  }
});