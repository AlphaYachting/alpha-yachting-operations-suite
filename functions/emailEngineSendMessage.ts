// EMAIL ENGINE SANDBOX - Manual Send Approved Outbound Message
// Phase 1: Secure isolated module.
// STRICT: Only sends messages with approval_status = 'approved_to_send'.
// NO auto-send, NO auto-reply, NO agent-triggered sending.
// ISOLATION: Writes ONLY to EmailOutboundQueueSandbox and EmailMessageSandbox.
// Never writes to Lead, Customer, Boat, Job, WorkOrder, Task, or any production entity.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import nodemailer from 'npm:nodemailer@6.9.16';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { outbound_id } = body;
    if (!outbound_id) return Response.json({ success: false, error: 'outbound_id is required' }, { status: 400 });

    // Load the outbound draft
    const all = await base44.asServiceRole.entities.EmailOutboundQueueSandbox.list();
    const item = all?.find(i => i.id === outbound_id);
    if (!item) return Response.json({ success: false, error: 'Draft not found' }, { status: 404 });

    // STRICT APPROVAL GATE — only approved_to_send may proceed
    if (item.approval_status !== 'approved_to_send') {
      return Response.json({
        success: false,
        error: `Send blocked. Required status: "approved_to_send". Current: "${item.approval_status}". Use the Approve button first.`,
      }, { status: 403 });
    }

    const host = Deno.env.get('EMAIL_ENGINE_SMTP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('EMAIL_ENGINE_SMTP_USER');
    const smtpPass = Deno.env.get('EMAIL_ENGINE_SMTP_PASSWORD');
    const fromAddr = Deno.env.get('EMAIL_ENGINE_FROM_ADDRESS');
    const fromName = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

    if (!host || !smtpUser || !smtpPass || !fromAddr) {
      return Response.json({ success: false, error: 'SMTP secrets not fully configured' });
    }

    const transporter = nodemailer.createTransport({
      host, port,
      secure: false,
      requireTLS: true,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 20000,
      socketTimeout: 30000,
    });

    const toList = Array.isArray(item.to_email) ? item.to_email : [item.to_email].filter(Boolean);
    const ccList = Array.isArray(item.cc_emails) ? item.cc_emails : [];

    let sentMessageId = null;
    let sendError = null;

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddr}>`,
        to: toList.join(', '),
        cc: ccList.length > 0 ? ccList.join(', ') : undefined,
        subject: item.draft_subject,
        text: item.draft_body_text,
        // Phase 1: plain text only for security
      });
      sentMessageId = info.messageId || `sent-${Date.now()}`;
    } catch (smtpErr) {
      sendError = (smtpErr.message || 'SMTP error')
        .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
        .replace(/password[^\s]*/gi, '[REDACTED]')
        .substring(0, 500);
    }

    const now = new Date().toISOString();

    if (sendError) {
      // NEVER delete draft on failure
      await base44.asServiceRole.entities.EmailOutboundQueueSandbox.update(item.id, {
        approval_status: 'failed',
        send_error_log: sendError,
        sent_at: now,
      });
      return Response.json({ success: false, error: sendError, draft_preserved: true, draft_id: item.id });
    }

    // Mark as sent
    await base44.asServiceRole.entities.EmailOutboundQueueSandbox.update(item.id, {
      approval_status: 'sent',
      sent_at: now,
      send_result: sentMessageId,
    });

    // Store outbound record in sandbox only
    const convKey = item.conversation_key || `manual-out:${Date.now()}`;
    const normalSubj = (item.draft_subject || '').replace(/^(Re|Fwd?):\s*/gi, '').trim().toLowerCase();

    await base44.asServiceRole.entities.EmailMessageSandbox.create({
      mailbox_name: smtpUser,
      direction: 'outbound',
      message_id: sentMessageId,
      conversation_key: convKey,
      linked_conversation_key: convKey,
      from_name: fromName,
      from_email: fromAddr,
      to_email: toList,
      cc_emails: ccList,
      bcc_emails: [],
      subject: item.draft_subject,
      normalized_subject: normalSubj,
      sent_at: now,
      body_text: item.draft_body_text || '',
      body_html_sanitized: '',
      body_preview: (item.draft_body_text || '').substring(0, 300),
      has_attachments: false,
      attachment_count: 0,
      attachments_meta_json: [],
      raw_headers_json: {},
      duplicate_status: 'original',
      processing_status: 'sent',
      security_flag: 'normal',
      smtp_delivery_status: 'sent',
      reviewed_manually: true,
      future_agent_access_allowed: false,
      future_agent_processing_status: 'disabled',
    });

    // Update conversation
    const convs = await base44.asServiceRole.entities.EmailConversationSandbox.filter({ conversation_key: convKey });
    if (convs?.length > 0) {
      await base44.asServiceRole.entities.EmailConversationSandbox.update(convs[0].id, {
        last_message_at: now,
        message_count: (convs[0].message_count || 0) + 1,
        latest_direction: 'outbound',
        latest_from_email: fromAddr,
        latest_preview: (item.draft_body_text || '').substring(0, 200),
      });
    }

    return Response.json({ success: true, message: 'Email sent successfully', sent_message_id: sentMessageId });

  } catch (error) {
    const safeErr = (error.message || 'Send failed')
      .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
      .replace(/password[^\s]*/gi, '[REDACTED]')
      .substring(0, 400);
    return Response.json({ success: false, error: safeErr }, { status: 500 });
  }
});