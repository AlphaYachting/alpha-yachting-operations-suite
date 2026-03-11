// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
// OPTIMIZED: Pre-loads existing message IDs and conversation keys upfront (2 calls instead of N×4)
// ISOLATION: Writes ONLY to EmailMessageSandbox and EmailConversationSandbox.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { simpleParser } from 'npm:mailparser@3.7.2';

const MAX_BODY_SIZE_BYTES = 300 * 1024;
const MAX_BATCH = 20;
const SAFE_HEADERS = ['date', 'subject', 'from', 'to', 'cc', 'message-id', 'content-type', 'x-mailer', 'mime-version'];

function normalizeSubject(subject) {
  if (!subject) return '';
  return subject.replace(/^((Re|Fwd?|AW|WG|SV|VS|FWD?|R|I)(\[\d+\])?:\s*)+/gi, '').trim().toLowerCase();
}

function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(iframe|embed|object|applet|form|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#BLOCKED"')
    .replace(/src\s*=\s*["'](?:https?:|data:|\/\/)[^"']*["']/gi, 'src="#BLOCKED_REMOTE"')
    .substring(0, 100000);
}

function detectSecurityFlag(subject, bodyText, bodyHtml) {
  const combined = `${subject} ${bodyText} ${bodyHtml || ''}`;
  if (/<script|javascript:\s|on(?:load|click|error|mouseover)\s*=/i.test(combined)) return 'script_detected';
  if (/src\s*=\s*["']https?:/i.test(bodyHtml || '')) return 'remote_content_detected';
  return 'normal';
}

function buildConversationKey(messageId, inReplyTo, references, fromEmail, toEmails, normalizedSubject) {
  const cleanId = (id) => id ? id.replace(/[<>\s]/g, '') : null;
  if (inReplyTo && cleanId(inReplyTo)) return `chain:${cleanId(inReplyTo)}`;
  if (references && references.length > 0 && cleanId(references[0])) return `chain:${cleanId(references[0])}`;
  if (messageId && cleanId(messageId)) return `chain:${cleanId(messageId)}`;
  const participants = [fromEmail, ...(toEmails || [])].sort().join(',').toLowerCase();
  const raw = `${normalizedSubject}:${participants}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return `subj:${Math.abs(hash).toString(36)}`;
}

function safeErr(err) {
  return (err?.message || 'Unknown error')
    .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
    .replace(/password[^\s]*/gi, '[REDACTED]')
    .substring(0, 300);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(body.batch_size) || 10, MAX_BATCH);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured' });
    }

    // PRE-LOAD existing message IDs and conversations in 2 parallel calls
    // This avoids per-message filter queries (the main timeout culprit)
    const [existingMessages, existingConversations] = await Promise.all([
      base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 500),
      base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 500),
    ]);

    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));

    const client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
      connectionTimeout: 15000,
      greetingTimeout: 8000,
      socketTimeout: 25000,
    });

    await client.connect();

    const results = { fetched: 0, stored: 0, duplicates: 0, skipped_oversized: 0, errors: 0, messages: [] };

    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox.exists;

      if (total === 0) {
        results.messages.push({ info: 'Inbox is empty' });
      } else {
        const start = Math.max(1, total - batchSize + 1);

        for await (const msg of client.fetch(`${start}:*`, { envelope: true, source: true })) {
          results.fetched++;

          try {
            // Oversized — skip body but record metadata
            if (msg.source && msg.source.length > MAX_BODY_SIZE_BYTES) {
              const mid = msg.envelope?.messageId || null;
              if (mid && existingMsgIds.has(mid)) { results.duplicates++; continue; }
              await base44.asServiceRole.entities.EmailMessageSandbox.create({
                mailbox_name: imapUser, direction: 'inbound', message_id: mid,
                from_email: msg.envelope?.from?.[0]?.address || 'unknown',
                from_name: msg.envelope?.from?.[0]?.name || '',
                to_email: (msg.envelope?.to || []).map(a => a.address).filter(Boolean),
                cc_emails: [], bcc_emails: [],
                subject: msg.envelope?.subject || '(no subject)',
                normalized_subject: normalizeSubject(msg.envelope?.subject),
                conversation_key: 'oversized', linked_conversation_key: 'oversized',
                in_reply_to: null, references_header: [],
                received_at: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
                body_text: '[OVERSIZED — BODY NOT STORED]', body_preview: '[OVERSIZED]',
                body_html_sanitized: '', has_attachments: false, attachment_count: 0,
                attachments_meta_json: [], raw_headers_json: {},
                duplicate_status: 'original', processing_status: 'stored', security_flag: 'oversized',
                reviewed_manually: false, future_agent_access_allowed: false, future_agent_processing_status: 'disabled',
              });
              if (mid) existingMsgIds.add(mid);
              results.skipped_oversized++; results.stored++;
              continue;
            }

            const parsed = await simpleParser(msg.source);

            const messageId = parsed.messageId || null;

            // Duplicate check using pre-loaded Set (no API call needed)
            if (messageId && existingMsgIds.has(messageId)) {
              results.duplicates++;
              results.messages.push({ status: 'duplicate', message_id: messageId });
              continue;
            }

            const inReplyTo = parsed.inReplyTo || null;
            const references = parsed.references
              ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
              : [];

            const fromVal = parsed.from?.value?.[0];
            const fromEmail = fromVal?.address || 'unknown@unknown';
            const fromName = fromVal?.name || fromEmail;
            const toEmails = (parsed.to?.value || []).map(a => a.address).filter(Boolean);
            const ccEmails = (parsed.cc?.value || []).map(a => a.address).filter(Boolean);
            const subject = parsed.subject || '(no subject)';
            const normalizedSubj = normalizeSubject(subject);
            const receivedAt = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();

            const bodyText = (parsed.text || '').substring(0, 50000);
            const bodyHtmlSanitized = sanitizeHtml(parsed.html || '');
            const securityFlag = detectSecurityFlag(subject, bodyText, parsed.html || '');
            const conversationKey = buildConversationKey(messageId, inReplyTo, references, fromEmail, toEmails, normalizedSubj);

            const attachmentsMeta = (parsed.attachments || []).map(att => ({
              filename: att.filename || 'unknown',
              content_type: att.contentType || 'application/octet-stream',
              size: att.size || att.content?.length || 0,
            }));

            const safeHeaders = {};
            if (parsed.headers) {
              parsed.headers.forEach((value, key) => {
                if (SAFE_HEADERS.includes(key.toLowerCase())) {
                  safeHeaders[key] = String(value).substring(0, 500);
                }
              });
            }

            // Store message
            await base44.asServiceRole.entities.EmailMessageSandbox.create({
              mailbox_name: imapUser, direction: 'inbound',
              message_id: messageId, conversation_key: conversationKey, linked_conversation_key: conversationKey,
              in_reply_to: inReplyTo, references_header: references,
              from_name: fromName, from_email: fromEmail,
              to_email: toEmails, cc_emails: ccEmails, bcc_emails: [],
              subject, normalized_subject: normalizedSubj, received_at: receivedAt,
              body_text: bodyText, body_html_sanitized: bodyHtmlSanitized,
              body_preview: bodyText.substring(0, 300) || bodyHtmlSanitized.replace(/<[^>]+>/g, '').substring(0, 300),
              has_attachments: attachmentsMeta.length > 0, attachment_count: attachmentsMeta.length,
              attachments_meta_json: attachmentsMeta, raw_headers_json: safeHeaders,
              normalized_fingerprint: null, duplicate_status: 'original',
              processing_status: 'stored', security_flag: securityFlag,
              reviewed_manually: false, future_agent_access_allowed: false, future_agent_processing_status: 'disabled',
            });

            if (messageId) existingMsgIds.add(messageId);

            // Update or create conversation using pre-loaded Map
            const allParticipants = Array.from(new Set([fromEmail, ...toEmails, ...ccEmails]));
            const existingConv = convMap.get(conversationKey);

            if (existingConv) {
              await base44.asServiceRole.entities.EmailConversationSandbox.update(existingConv.id, {
                last_message_at: receivedAt,
                message_count: (existingConv.message_count || 0) + 1,
                latest_direction: 'inbound', latest_from_email: fromEmail,
                latest_to_email: toEmails, latest_preview: bodyText.substring(0, 200),
                participant_summary: Array.from(new Set([...(existingConv.participant_summary || []), ...allParticipants])),
              });
              existingConv.message_count = (existingConv.message_count || 0) + 1;
            } else {
              const newConv = await base44.asServiceRole.entities.EmailConversationSandbox.create({
                conversation_key: conversationKey, primary_subject: subject,
                normalized_subject: normalizedSubj, participant_summary: allParticipants,
                first_message_at: receivedAt, last_message_at: receivedAt, message_count: 1,
                latest_direction: 'inbound', latest_from_email: fromEmail,
                latest_to_email: toEmails, latest_preview: bodyText.substring(0, 200),
                status_internal: 'open', reviewed_manually: false,
                future_agent_access_allowed: false,
              });
              convMap.set(conversationKey, newConv);
            }

            results.stored++;
            results.messages.push({ status: 'stored', message_id: messageId, security_flag: securityFlag });

          } catch (msgErr) {
            results.errors++;
            results.messages.push({ status: 'error', error: safeErr(msgErr) });
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return Response.json({
      success: true,
      summary: { fetched: results.fetched, stored: results.stored, duplicates: results.duplicates, skipped_oversized: results.skipped_oversized, errors: results.errors },
      message_log: results.messages,
    });

  } catch (error) {
    return Response.json({ success: false, error: safeErr(error) }, { status: 500 });
  }
});