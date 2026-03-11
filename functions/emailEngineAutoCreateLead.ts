/**
 * EMAIL ENGINE — Auto Create Lead from Inbound Email
 *
 * Called automatically via entity automation when a new EmailMessageSandbox record is created,
 * OR manually from the UI with a specific sandbox_record_id.
 *
 * ISOLATION: Only writes to Lead and EmailLeadBridgeSandbox.
 * Does NOT create Customer, Boat, Job, WorkOrder, Task, or send any email.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// --- Helpers ---

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function normalizeSubject(subject) {
  return (subject || '')
    .replace(/^((Re|Fwd?|AW|WG|FWD?):\s*)+/gi, '')
    .trim()
    .toLowerCase();
}

function dateBucket(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildFingerprint(fromEmail, subject, receivedAt) {
  return `${normalizeEmail(fromEmail)}::${normalizeSubject(subject)}::${dateBucket(receivedAt)}`;
}

function extractPhone(text) {
  if (!text) return null;
  const match = text.match(/(\+?[\d\s\-().]{7,20})/);
  if (!match) return null;
  const candidate = match[1].replace(/\s+/g, ' ').trim();
  const digits = candidate.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return candidate;
  return null;
}

function extractBoatDetails(text) {
  if (!text) return {};
  const details = {};
  
  // Boat length
  const lengthMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?:eter|etre)?(?:\s|,|\.|\b)/i);
  if (lengthMatch) details.boat_length = lengthMatch[1];

  // Boat type keywords
  const types = ['sailboat', 'motorboat', 'yacht', 'catamaran', 'rib', 'motorjacht', 'segelyacht', 'segelboot', 'motoryacht', 'katamaran'];
  for (const t of types) {
    if (text.toLowerCase().includes(t)) {
      details.boat_type = t;
      break;
    }
  }

  // Boat brand/manufacturer (common ones)
  const brands = ['beneteau', 'jeanneau', 'Bavaria', 'hanse', 'dufour', 'sun odyssey', 'oceanis', 'elan', 'lagoon', 'fountaine pajot', 'nautitech', 'princess', 'azimut', 'fairline'];
  for (const b of brands) {
    if (text.toLowerCase().includes(b.toLowerCase())) {
      details.boat_brand = b;
      break;
    }
  }

  return details;
}

function classifyInquiryType(text, subject) {
  const combined = `${subject || ''} ${text || ''}`.toLowerCase();
  if (combined.match(/notr|emergency|notfall|urgent|dringend/)) return 'Emergency';
  if (combined.match(/part|ersatzteil|teile|spare/)) return 'Parts Request';
  if (combined.match(/service|wartung|maintenance|inspektion|inspection|winter|antifoul|osmose/)) return 'Maintenance';
  return 'Service Inquiry';
}

function classifyPriority(text, subject) {
  const combined = `${subject || ''} ${text || ''}`.toLowerCase();
  if (combined.match(/urgent|dringend|sofort|emergency|notfall|asap/)) return 'Urgent';
  if (combined.match(/soon|bald|quickly|schnell/)) return 'High';
  return 'Medium';
}

function extractLeadPayload(sandboxRecord) {
  const body = sandboxRecord.body_text || '';
  const subject = sandboxRecord.subject || '(no subject)';
  const fromName = sandboxRecord.from_name || sandboxRecord.from_email || 'Unknown';
  const fromEmail = sandboxRecord.from_email || '';

  // Extract phone
  const phone = extractPhone(body) || extractPhone(subject) || '';

  // Boat details
  const boatDetails = extractBoatDetails(body);
  const boatDetailsStr = Object.entries(boatDetails)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  // Inquiry type and priority
  const inquiryType = classifyInquiryType(body, subject);
  const priority = classifyPriority(body, subject);

  // Structured notes
  const structuredNotes = [
    `[Auto-created from website inquiry email]`,
    `Source: ${sandboxRecord.mailbox_name}`,
    `Message-ID: ${sandboxRecord.message_id || 'n/a'}`,
    `Received: ${sandboxRecord.received_at || 'n/a'}`,
    `Subject: ${subject}`,
    boatDetailsStr ? `Detected boat info: ${boatDetailsStr}` : null,
    `Conversation key: ${sandboxRecord.conversation_key || 'n/a'}`,
  ].filter(Boolean).join('\n');

  const leadPayload = {
    name: fromName,
    email: fromEmail,
    phone: phone || '+0',          // Lead.phone is required; fallback placeholder
    contact_method: 'Website',
    inquiry_type: inquiryType,
    priority: priority,
    status: 'Pending',
    description: body.substring(0, 5000),
    notes: structuredNotes,
  };

  // Optional fields
  if (boatDetails.boat_type || boatDetails.boat_brand || boatDetails.boat_length) {
    leadPayload.boat_details = boatDetailsStr;
  }

  return {
    payload: leadPayload,
    extractionStatus: (fromName && fromEmail) ? 'extracted' : 'partial',
  };
}

// --- Main Handler ---

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Accept both direct call (with sandbox_record_id) and entity automation payload
    const body = await req.json().catch(() => ({}));
    
    // Support entity automation event format
    let sandboxRecordId = body.sandbox_record_id || body.entity_id;
    if (body.event?.entity_id) sandboxRecordId = body.event.entity_id;
    if (body.data?.id) sandboxRecordId = body.data.id;

    // If called with a specific record, process only that one
    // If called without a record ID (manual bulk run), process all unprocessed inbound messages
    let recordsToProcess = [];

    if (sandboxRecordId) {
      // Single record mode
      const records = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ id: sandboxRecordId });
      recordsToProcess = records || [];
    } else {
      // Bulk mode: fetch all inbound, non-duplicate messages not yet bridged
      const allInbound = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ direction: 'inbound' });
      const allBridges = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 500);
      
      const processedMessageIds = new Set((allBridges || []).map(b => b.source_sandbox_record_id).filter(Boolean));
      
      recordsToProcess = (allInbound || []).filter(r =>
        r.duplicate_status !== 'duplicate' &&
        (r.processing_status === 'stored' || r.processing_status === 'parsed' || r.processing_status === 'sanitized') &&
        !processedMessageIds.has(r.id)
      );
    }

    if (recordsToProcess.length === 0) {
      return Response.json({ success: true, message: 'No new records to process', processed: 0 });
    }

    // Load all existing bridges once for duplicate checking
    const allBridges = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 500);
    const existingMessageIds = new Set((allBridges || []).map(b => b.source_email_message_id).filter(Boolean));
    const existingFingerprints = new Set((allBridges || []).map(b => b.internal_notes).filter(n => n?.startsWith('fingerprint:')));

    const results = [];

    for (const record of recordsToProcess) {
      const result = { record_id: record.id, subject: record.subject };

      try {
        // --- DUPLICATE CHECK ---
        const messageId = record.message_id;
        const fingerprint = `fingerprint:${buildFingerprint(record.from_email, record.subject, record.received_at)}`;

        // Check 1: Already bridged by sandbox record ID
        const alreadyBridged = allBridges.find(b => b.source_sandbox_record_id === record.id);
        if (alreadyBridged) {
          result.status = 'skipped_already_bridged';
          result.bridge_id = alreadyBridged.id;
          results.push(result);
          continue;
        }

        // Check 2: Duplicate by message_id
        if (messageId && existingMessageIds.has(messageId)) {
          await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
            source_email_message_id: messageId,
            source_sandbox_record_id: record.id,
            source_conversation_key: record.conversation_key,
            source_from_email: record.from_email,
            source_from_name: record.from_name,
            source_subject: record.subject,
            source_received_at: record.received_at,
            lead_created: false,
            duplicate_check_status: 'duplicate_by_message_id',
            extraction_status: 'partial',
            creation_status: 'duplicate_blocked',
            auto_created_at: new Date().toISOString(),
            internal_notes: fingerprint,
          });
          result.status = 'duplicate_blocked_message_id';
          results.push(result);
          continue;
        }

        // Check 3: Duplicate by fingerprint
        if (existingFingerprints.has(fingerprint)) {
          await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
            source_email_message_id: messageId,
            source_sandbox_record_id: record.id,
            source_conversation_key: record.conversation_key,
            source_from_email: record.from_email,
            source_from_name: record.from_name,
            source_subject: record.subject,
            source_received_at: record.received_at,
            lead_created: false,
            duplicate_check_status: 'duplicate_by_fingerprint',
            extraction_status: 'partial',
            creation_status: 'duplicate_blocked',
            auto_created_at: new Date().toISOString(),
            internal_notes: fingerprint,
          });
          result.status = 'duplicate_blocked_fingerprint';
          results.push(result);
          continue;
        }

        // --- EXTRACT ---
        const { payload: leadPayload, extractionStatus } = extractLeadPayload(record);

        // --- CREATE LEAD ---
        const createdLead = await base44.asServiceRole.entities.Lead.create(leadPayload);

        // --- CREATE BRIDGE RECORD ---
        await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
          source_email_message_id: messageId,
          source_sandbox_record_id: record.id,
          source_conversation_key: record.conversation_key,
          source_from_email: record.from_email,
          source_from_name: record.from_name,
          source_subject: record.subject,
          source_received_at: record.received_at,
          lead_created: true,
          created_lead_id: createdLead.id,
          duplicate_check_status: 'unique',
          extraction_status: extractionStatus,
          creation_status: 'created',
          extracted_lead_payload_json: leadPayload,
          auto_created_at: new Date().toISOString(),
          internal_notes: fingerprint,
        });

        // Update sets for remaining iterations in bulk mode
        if (messageId) existingMessageIds.add(messageId);
        existingFingerprints.add(fingerprint);

        result.status = 'created';
        result.lead_id = createdLead.id;
        results.push(result);

      } catch (err) {
        // Log failure to bridge, but do not crash the entire batch
        await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
          source_email_message_id: record.message_id,
          source_sandbox_record_id: record.id,
          source_from_email: record.from_email || 'unknown',
          source_subject: record.subject || '(no subject)',
          source_received_at: record.received_at,
          lead_created: false,
          duplicate_check_status: 'pending',
          extraction_status: 'error',
          creation_status: 'failed',
          creation_error_log: err.message?.substring(0, 500),
          auto_created_at: new Date().toISOString(),
        }).catch(() => {}); // silent — don't let bridge write failure break response

        result.status = 'error';
        result.error = err.message;
        results.push(result);
      }
    }

    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return Response.json({
      success: true,
      processed: results.length,
      summary,
      results,
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});