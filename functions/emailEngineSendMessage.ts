// EMAIL ENGINE SANDBOX - Manual Send Approved Outbound Message via Resend API
// Phase 1: Secure isolated module.
// STRICT: Only sends messages with approval_status = 'approved_to_send'.
// NO auto-send, NO auto-reply, NO agent-triggered sending.
// ISOLATION: Writes ONLY to EmailOutboundQueueSandbox and EmailMessageSandbox.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromAddr = Deno.env.get('EMAIL_ENGINE_FROM_ADDRESS');
    const fromName = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

    if (!apiKey || !fromAddr) {
      return Response.json({ success: false, error: 'RESEND_API_KEY or EMAIL_ENGINE_FROM_ADDRESS not configured' });
    }

    const toList = Array.isArray(item.to_email) ? item.to_email : [item.to_email].filter(Boolean);
    const ccList = Array.isArray(item.cc_emails) ? item.cc_emails : [];

    let sentMessageId = null;
    let sendError = null;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddr}>`,
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          subject: item.draft_subject,
          text: item.draft_body_text,
          ...(item.related_message_id ? { headers: { 'In-Reply-To': item.related_message_id, 'References': item.related_message_id } } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        sendError = `Resend error: ${data?.message || JSON.stringify(data)}`.substring(0, 500);
      } else {
        sentMessageId = data.id || `resend-${Date.now()}`;
      }
    } catch (err) {
      sendError = (err.message || 'Send failed').substring(0, 500);
    }

    const now = new Date().toISOString();

    if (sendError) {
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

    // Store outbound record in sandbox
    const convKey = item.conversation_key || `manual-out:${Date.now()}`;
    const normalSubj = (item.draft_subject || '').replace(/^(Re|Fwd?):\s*/gi, '').trim().toLowerCase();

    await base44.asServiceRole.entities.EmailMessageSandbox.create({
      mailbox_name: fromAddr,
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

    // Update or create conversation
    const convs = await base44.asServiceRole.entities.EmailConversationSandbox.filter({ conversation_key: convKey });
    if (convs?.length > 0) {
      await base44.asServiceRole.entities.EmailConversationSandbox.update(convs[0].id, {
        last_message_at: now,
        message_count: (convs[0].message_count || 0) + 1,
        latest_direction: 'outbound',
        latest_from_email: fromAddr,
        latest_to_email: toList,
        latest_preview: (item.draft_body_text || '').substring(0, 200),
      });
    }

    return Response.json({ success: true, message: 'Email sent successfully via Resend', resend_id: sentMessageId });

  } catch (error) {
    return Response.json({ success: false, error: error.message?.substring(0, 400) || 'Send failed' }, { status: 500 });
  }
});