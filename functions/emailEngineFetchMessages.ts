// EMAIL ENGINE SANDBOX - Fetch & Store Inbound Messages
// OPTIMIZED: Fetches only UNSEEN messages, uses lightweight header parsing.
// ISOLATION: Writes ONLY to EmailMessageSandbox and EmailConversationSandbox.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
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

function buildConversationKey(messageId, inReplyTo, fromEmail, normalizedSubject) {
  const clean = (id) => id ? id.replace(/[<>\s]/g, '') : null;
  if (inReplyTo && clean(inReplyTo)) return `chain:${clean(inReplyTo)}`;
  if (messageId && clean(messageId)) return `chain:${clean(messageId)}`;
  const raw = `${normalizedSubject}:${fromEmail}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return `subj:${Math.abs(hash).toString(36)}`;
}

function safeErr(err) {
  return (err?.message || 'Unknown error')
    .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
    .substring(0, 300);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(body.batch_size) || 10, 10);

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({ success: false, error: 'IMAP secrets not configured' });
    }

    // Pre-load existing message IDs (only most recent 200 for speed)
    const existingMessages = await base44.asServiceRole.entities.EmailMessageSandbox.list('-received_at', 200);
    const existingMsgIds = new Set((existingMessages || []).map(m => m.message_id).filter(Boolean));

    const existingConversations = await base44.asServiceRole.entities.EmailConversationSandbox.list('-last_message_at', 200);
    const convMap = new Map((existingConversations || []).map(c => [c.conversation_key, c]));

    const client = new ImapFlow({
      host, port,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
      connectionTimeout: 10000,
      greetingTimeout: 6000,
      socketTimeout: 15000,
    });

    await client.connect();

    const results = { fetched: 0, stored: 0, duplicates: 0, errors: 0, messages: [] };

    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox.exists || 0;

      if (total === 0) {
        results.messages.push({ info: 'Inbox is empty' });
      } else {
        // Fetch only the most recent N messages by sequence number
        const start = Math.max(1, total - batchSize + 1);
        const range = `${start}:${total}`;

        for await (const msg of client.fetch(range, {
          envelope: true,
          bodyText: true,
          bodyStructure: true,
        })) {
          results.fetched++;

          try {
            const env = msg.envelope;
            const messageId = env?.messageId || null;

            // Skip duplicates using pre-loaded Set
            if (messageId && existingMsgIds.has(messageId)) {
              results.duplicates++;
              results.messages.push({ status: 'duplicate', message_id: messageId });
              continue;
            }

            const fromEmail = env?.from?.[0]?.address || 'unknown@unknown';
            const fromName = env?.from?.[0]?.name || fromEmail;
            const toEmails = (env?.to || []).map(a => a.address).filter(Boolean);
            const ccEmails = (env?.cc || []).map(a => a.address).filter(Boolean);
            const subject = env?.subject || '(no subject)';
            const normalizedSubj = normalizeSubject(subject);
            const receivedAt = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();

            // Get body text from bodyParts map (key 'TEXT' or 'text')
            let bodyText = '';
            if (msg.bodyParts) {
              const raw = msg.bodyParts.get('TEXT') || msg.bodyParts.get('text') || '';
              bodyText = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
            }
            bodyText = sanitizeText(bodyText).substring(0, 10000);

            const inReplyTo = null; // from envelope, not headers
            const conversationKey = buildConversationKey(messageId, inReplyTo, fromEmail, normalizedSubj);

            // Attachment detection from body structure
            const hasAttachments = !!(msg.bodyStructure?.childNodes?.some(n => n.disposition === 'attachment'));
            const attachmentCount = msg.bodyStructure?.childNodes?.filter(n => n.disposition === 'attachment').length || 0;

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
      summary: {
        fetched: results.fetched,
        stored: results.stored,
        duplicates: results.duplicates,
        errors: results.errors,
      },
      message_log: results.messages,
    });

  } catch (error) {
    return Response.json({ success: false, error: safeErr(error) }, { status: 500 });
  }
});