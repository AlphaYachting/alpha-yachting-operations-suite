/**
 * EMAIL ENGINE — Auto-Retry Empty Bodies
 *
 * Triggered by automation: EmailMessageSandbox created with processing_status='fetched'
 * Calls emailRetryAndProcess for each record that has no body yet.
 * 
 * This is the safety net: if the initial fetch in emailEngineFetchMessages
 * fails to get a body (IMAP timeout, server quirk), this runs automatically
 * and retries via the raw TLS approach.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Support entity automation payload: single record
    let sandboxRecordId = body.sandbox_record_id || body.entity_id;
    if (body.event?.entity_id) sandboxRecordId = body.event.entity_id;
    if (body.data?.id) sandboxRecordId = body.data.id;

    if (!sandboxRecordId) {
      return Response.json({ success: false, error: 'No sandbox_record_id provided' }, { status: 400 });
    }

    // Verify the record actually needs retry (has no body)
    const records = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ id: sandboxRecordId });
    const record = records?.[0];
    if (!record) {
      return Response.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    if (record.body_text?.trim()) {
      return Response.json({ success: true, message: 'Body already present — skipping retry', skipped: true });
    }

    if (record.direction !== 'inbound') {
      return Response.json({ success: true, message: 'Not an inbound message — skipping', skipped: true });
    }

    if (!record.message_id) {
      return Response.json({ success: true, message: 'No Message-ID — cannot retry', skipped: true });
    }

    // Delegate to emailRetryAndProcess
    const result = await base44.asServiceRole.functions.invoke('emailRetryAndProcess', {
      sandbox_record_id: sandboxRecordId,
      create_lead: false, // Lead creation handled by emailEngineAutoCreateLead automation
    });

    return Response.json({
      success: true,
      record_id: sandboxRecordId,
      retry_result: result,
      execution_time_ms: Date.now() - startTime,
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      execution_time_ms: Date.now() - startTime,
    }, { status: 500 });
  }
});