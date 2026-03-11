// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
// Phase 1: Secure isolated module.
// ISOLATION: Writes ONLY to EmailMessageSandbox and EmailConversationSandbox.
// Never writes to Lead, Customer, Boat, Job, WorkOrder, Task, or any production entity.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { simpleParser } from 'npm:mailparser@3.7.2';

const MAX_BODY_SIZE_BYTES = 300 * 1024; // 300 KB hard limit
const MAX_BATCH = 30;
const SAFE_HEADERS = ['date', 'subject', 'from', 'to', 'cc', 'message-id', 'content-type', 'x-mailer', 'mime-version', 'list-unsubscribe'];

function normalizeSubject(subject) {
  if (!subject) return '';
  return subject
    .replace(/^((Re|Fwd?|AW|WG|SV|VS|FWD?|R|I)(\[\d+\])?:\s*)+/gi, '')
    .trim()
    .toLowerCase();
}

function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(iframe|embed|object|applet|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '[BLOCKED]')
    .replace(/<(iframe|embed|object|applet|form|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*`[^`]*`/gi, '')
    .replace(/\son\w+\s*=[^\s>]*/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#BLOCKED"')
    .replace(/src\s*=\s*["'](?:https?:|data:|\/\/)[^"']*["']/gi, 'src="#BLOCKED_REMOTE"')
    .substring(0, 150000);
}

function detectSecurityFlag(subject, bodyText, bodyHtml) {
  const combined = `${subject} ${bodyText} ${bodyHtml || ''}`;
  if (/<script|javascript:\s|on(?:load|click|error|mouseover)\s*=/i.test(combined)) return 'script_detected';
  if (/src\s*=\s*["']https?:/i.test(bodyHtml || '')) return 'remote_content_detected';
  if (bodyText && bodyText.length < 5 && !bodyHtml) return 'suspicious';
  return 'normal';
}

function buildConversationKey(messageId, inReplyTo, references, fromEmail, toEmails, normalizedSubject) {
  const cleanId = (id) => id ? id.replace(/[<>\s]/g, '') : null;
  if (inReplyTo && cleanId(inReplyTo)) return `chain:${cleanId(inReplyTo)}`;
  if (references && references.length > 0 && cleanId(references[0])) return `chain:${cleanId(references[0])}`;
  if (messageId && cleanId(messageId)) return `chain:${cleanId(messageId)}`;
  // Fallback: hash of subject + sorted participants
  const participants = [fromEmail, ...(toEmails || [])].sort().join(',').toLowerCase();
  const raw = `${normalizedSubject}:${participants}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return `subj:${Math.abs(hash).toString(36)}`;
}

function buildFingerprint(fromEmail, subject, dateStr, bodyExcerpt) {
  const raw = `${fromEmail?.toLowerCase()}|${normalizeSubject(subject)}|${dateStr?.substring(0, 13)}|${bodyExcerpt?.substring(0, 80)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return `fp:${Math.abs(hash).toString(36)}`;
}

function safeError(err) {
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
    const batchSize = Math.min(parseInt(body.batch_size) || 20, MAX_BATCH);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured' });
    }

    const client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
      connectionTimeout: 20000,
      greetingTimeout: 8000,
      socketTimeout: 30000,
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
            // Oversized check before parsing
            if (msg.source && msg.source.length > MAX_BODY_SIZE_BYTES) {
              const env = msg.envelope;
              const mid = env?.messageId || null;
              if (mid) {
                const dup = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ message_id: mid });
                if (dup?.length > 0) { results.duplicates++; continue; }
              }
              await base44.asServiceRole.entities.EmailMessageSandbox.create({
                mailbox_name: imapUser,
                direction: 'inbound',
                message_id: mid,
                from_email: env?.from?.[0]?.address || 'unknown',
                from_name: env?.from?.[0]?.name || '',
                to_email: (env?.to || []).map(a => a.address).filter(Boolean),
                cc_emails: [],
                bcc_emails: [],
                subject: env?.subject || '(no subject)',
                normalized_subject: normalizeSubject(env?.subject),
                conversation_key: 'oversized',
                linked_conversation_key: 'oversized',
                in_reply_to: null,
                references_header: [],
                received_at: env?.date ? new Date(env.date).toISOString() : new Date().toISOString(),
                body_text: '[OVERSIZED MESSAGE — BODY NOT STORED FOR SECURITY]',
                body_preview: '[OVERSIZED]',
                body_html_sanitized: '',
                has_attachments: false,
                attachment_count: 0,
                attachments_meta_json: [],
                raw_headers_json: {},
                normalized_fingerprint: null,
                duplicate_status: 'original',
                processing_status: 'stored',
                security_flag: 'oversized',
                reviewed_manually: false,
                future_agent_access_allowed: false,
                future_agent_processing_status: 'disabled',
              });
              results.skipped_oversized++;
              results.stored++;
              continue;
            }

            // Parse with mailparser
            const parsed = await simpleParser(msg.source);

            const messageId = parsed.messageId || null;
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

            // Duplicate check by Message-ID (primary)
            if (messageId) {
              const existing = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ message_id: messageId });
              if (existing?.length > 0) {
                results.duplicates++;
                results.messages.push({ status: 'duplicate', message_id: messageId });
                continue;
              }
            }

            const bodyText = parsed.text || '';
            const bodyHtmlRaw = parsed.html || '';
            const bodyHtmlSanitized = sanitizeHtml(bodyHtmlRaw);

            // Attachments: metadata ONLY, no content
            const attachmentsMeta = (parsed.attachments || []).map(att => ({
              filename: att.filename || 'unknown',
              content_type: att.contentType || 'application/octet-stream',
              size: att.size || att.content?.length || 0,
            }));

            const securityFlag = detectSecurityFlag(subject, bodyText, bodyHtmlRaw);
            const conversationKey = buildConversationKey(messageId, inReplyTo, references, fromEmail, toEmails, normalizedSubj);

            // Fingerprint fallback for messages without Message-ID
            const fingerprint = messageId ? null : buildFingerprint(fromEmail, subject, receivedAt, bodyText);
            if (!messageId && fingerprint) {
              const fpDup = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ normalized_fingerprint: fingerprint });
              if (fpDup?.length > 0) {
                results.duplicates++;
                continue;
              }
            }

            // Safe headers subset — never store authentication headers
            const safeHeaders = {};
            if (parsed.headers) {
              parsed.headers.forEach((value, key) => {
                if (SAFE_HEADERS.includes(key.toLowerCase())) {
                  safeHeaders[key] = String(value).substring(0, 500);
                }
              });
            }

            // SANDBOX WRITE ONLY — never writes to production entities
            await base44.asServiceRole.entities.EmailMessageSandbox.create({
              mailbox_name: imapUser,
              direction: 'inbound',
              message_id: messageId,
              conversation_key: conversationKey,
              linked_conversation_key: conversationKey,
              in_reply_to: inReplyTo,
              references_header: references,
              from_name: fromName,
              from_email: fromEmail,
              to_email: toEmails,
              cc_emails: ccEmails,
              bcc_emails: [],
              subject,
              normalized_subject: normalizedSubj,
              received_at: receivedAt,
              body_text: bodyText.substring(0, 50000),
              body_html_sanitized: bodyHtmlSanitized,
              body_preview: bodyText.substring(0, 300) || bodyHtmlSanitized.replace(/<[^>]+>/g, '').substring(0, 300),
              has_attachments: attachmentsMeta.length > 0,
              attachment_count: attachmentsMeta.length,
              attachments_meta_json: attachmentsMeta,
              raw_headers_json: safeHeaders,
              normalized_fingerprint: fingerprint,
              duplicate_status: 'original',
              processing_status: 'stored',
              security_flag: securityFlag,
              reviewed_manually: false,
              future_agent_access_allowed: false,
              future_agent_processing_status: 'disabled',
            });

            // Update conversation record
            const existingConvs = await base44.asServiceRole.entities.EmailConversationSandbox.filter({ conversation_key: conversationKey });
            const allParticipants = Array.from(new Set([fromEmail, ...toEmails, ...ccEmails]));

            if (existingConvs?.length > 0) {
              const conv = existingConvs[0];
              await base44.asServiceRole.entities.EmailConversationSandbox.update(conv.id, {
                last_message_at: receivedAt,
                message_count: (conv.message_count || 0) + 1,
                latest_direction: 'inbound',
                latest_from_email: fromEmail,
                latest_to_email: toEmails,
                latest_preview: bodyText.substring(0, 200),
                participant_summary: Array.from(new Set([...(conv.participant_summary || []), ...allParticipants])),
              });
            } else {
              await base44.asServiceRole.entities.EmailConversationSandbox.create({
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
            }

            results.stored++;
            results.messages.push({ status: 'stored', message_id: messageId, security_flag: securityFlag, has_attachments: attachmentsMeta.length > 0 });

          } catch (msgErr) {
            // ISOLATION: one bad message NEVER breaks the entire batch
            results.errors++;
            results.messages.push({ status: 'error', error: safeError(msgErr) });
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return Response.json({
      success: true,
      summary: {
        fetched: results.fetched,
        stored: results.stored,
        duplicates: results.duplicates,
        skipped_oversized: results.skipped_oversized,
        errors: results.errors,
      },
      message_log: results.messages,
    });

  } catch (error) {
    return Response.json({ success: false, error: safeError(error) }, { status: 500 });
  }

  function safeError(err) {
    return (err?.message || 'Unknown error')
      .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
      .replace(/password[^\s]*/gi, '[REDACTED]')
      .substring(0, 300);
  }
});