/**
 * EMAIL ENGINE — Auto Create Lead from Inbound Email
 *
 * ISOLATION: Only writes to Lead and EmailLeadBridgeSandbox.
 * Does NOT create Customer, Boat, Job, WorkOrder, Task, or send any email.
 *
 * SENDER GUARD: Never creates a lead if the resolved sender is an internal
 * Alpha Yachting address. For forwarded/contact-form emails arriving from an
 * internal address, the real external sender is extracted from the body first.
 *
 * CONTENT PARSING: Parses both structured contact-form key:value blocks
 * and free-form forwarded email bodies.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ---------------------------------------------------------------------------
// INTERNAL DOMAIN GUARD
// ---------------------------------------------------------------------------

const INTERNAL_DOMAINS = [
  'alphayachting.com',
  'alpha-yachting.com',
  'alphayachting.eu',
  'alpha-yachting.eu',
  'alpha-yachting.at',
  'alphayachting.at',
  'alpha-yachting.hr',
  'alphayachting.hr',
];

function isInternalEmail(email) {
  if (!email) return true;
  const domain = (email.split('@')[1] || '').toLowerCase().trim();
  if (!domain) return true;
  return INTERNAL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
}

// ---------------------------------------------------------------------------
// FORWARDED EMAIL — extract the original customer message body
// Strips the forwarder's signature, the separator line, and the forwarded
// headers (Von/From, Datum/Date, An/To, Betreff/Subject) so that only the
// customer's actual message text is returned.
// ---------------------------------------------------------------------------

function extractForwardedBody(bodyText) {
  if (!bodyText) return null;

  // Match common German/English forwarded separators
  const sepPattern = /[-=*]{5,}\s*(?:Weitergeleitete Nachricht|Forwarded message|Forwarded Message|Original Message|Originaltext|Weitergeleitet)\s*[-=*]{5,}/i;
  const sepMatch = bodyText.match(sepPattern);

  let contentBody = null;

  if (sepMatch) {
    const afterSep = bodyText.substring(sepMatch.index + sepMatch[0].length);
    const lines = afterSep.split(/\r?\n/);
    let i = 0;
    // Skip blank lines before headers
    while (i < lines.length && lines[i].trim() === '') i++;
    // Skip forwarded header lines (Von/From/Datum/Date/An/To/Betreff/Subject/Cc/Reply-To)
    while (i < lines.length && /^(?:Von|From|Datum|Date|An|To|Betreff|Subject|Cc|Bcc|Antwort-An|Reply-To):\s*/i.test(lines[i].trim())) i++;
    // Skip blank lines after headers
    while (i < lines.length && lines[i].trim() === '') i++;

    const cleanedLines = lines.slice(i).map(l => l.replace(/^>\s?/, ''));
    contentBody = cleanedLines.join('\n').trim();
  }

  if (!contentBody) {
    // Fallback: find content after a Von/From block (no separator)
    const fromBlockMatch = bodyText.match(
      /(?:Von|From):\s*[^\n]+\n(?:(?:Datum|Date|An|To|Betreff|Subject|Cc):[^\n]*\n){0,5}\n([\s\S]+)/i
    );
    if (fromBlockMatch) {
      contentBody = fromBlockMatch[1].split(/\r?\n/).map(l => l.replace(/^>\s?/, '')).join('\n').trim();
    }
  }

  return contentBody || null;
}

// ---------------------------------------------------------------------------
// FORWARDED EMAIL — find the original external sender in the body
// e.g.  Von: Max Mustermann <max@example.com>
//       From: "Some Person" <customer@gmail.com>
// ---------------------------------------------------------------------------

function extractForwardedSender(bodyText) {
  if (!bodyText) return null;

  // Match: Von/From: Name <email@domain>
  const withName = bodyText.match(/(?:Von|From):\s*([^<\n]{1,80})<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i);
  if (withName) {
    const email = withName[2].trim().toLowerCase();
    if (!isInternalEmail(email)) {
      return { name: withName[1].replace(/["']/g, '').trim(), email };
    }
  }

  // Match: Von/From: email@domain  (no display name)
  const emailOnly = bodyText.match(/(?:Von|From):\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailOnly) {
    const email = emailOnly[1].trim().toLowerCase();
    if (!isInternalEmail(email)) {
      return { name: email, email };
    }
  }

  // Match: Reply-To: or Antwort an:
  const replyTo = bodyText.match(/(?:Reply-To|Antwort.?an):\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (replyTo) {
    const email = replyTo[1].trim().toLowerCase();
    if (!isInternalEmail(email)) {
      return { name: email, email };
    }
  }

  // Last resort: find ANY external email address in the body (handles contact form submissions)
  const allEmails = bodyText.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g);
  if (allEmails) {
    for (const em of allEmails) {
      const e = em.toLowerCase();
      if (!isInternalEmail(e)) {
        return { name: e, email: e };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// STRUCTURED CONTACT FORM PARSER
// Handles German/English key: value blocks sent by website inquiry forms
// ---------------------------------------------------------------------------

function parseContactFormFields(bodyText) {
  if (!bodyText) return {};
  const fields = {};
  const lines = bodyText.split(/\r?\n/);

  for (const line of lines) {
    const kv = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (!kv) continue;
    const rawKey = kv[1].trim();
    const value  = kv[2].trim();
    if (!value || value.length < 1) continue;
    const key = rawKey.toLowerCase()
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

    // --- Contact ---
    if (/^(name|full.?name|kontakt|contact.?name)$/.test(key))         fields.name       = value;
    if (/^(vorname|first.?name)$/.test(key))                           fields.first_name  = value;
    if (/^(nachname|surname|last.?name|familienname)$/.test(key))       fields.last_name   = value;
    if (/^(e.?mail|email|e-mail.?adresse|mailadresse)$/.test(key))      fields.email       = value.toLowerCase().trim();
    if (/^(telefon|phone|tel|mobile|mobil|handynummer|telefonnummer)$/.test(key)) fields.phone = value;
    if (/^(firma|company|unternehmen|organisation|organization)$/.test(key))      fields.company = value;

    // --- Inquiry content ---
    if (/^(nachricht|message|anfrage|anliegen|request|kommentar|comment|text|inhalt|beschreibung|description|ihr.?anliegen)$/.test(key)) fields.message = value;
    if (/^(service|dienstleistung|leistung|gewunschte.?leistung|art.?der.?anfrage|anfrage.?typ|service.?art)$/.test(key)) fields.service = value;

    // --- Boat ---
    if (/^(boot|boat|bootsname|vessel|schiff|yachtname)$/.test(key))                        fields.boat_name   = value;
    if (/^(bootslange|bootslänge|boat.?length|lange|length|lange.?des.?bootes)$/.test(key)) fields.boat_length = value;
    if (/^(bootshersteller|boat.?brand|marke|hersteller|manufacturer|bootsmarke)$/.test(key)) fields.boat_brand = value;
    if (/^(bootstyp|boat.?type|typ|type|yachttyp|motorboot|segelboot)$/.test(key))           fields.boat_type  = value;
    if (/^(baujahr|year.?built|baujahr.?boot|modelljahr)$/.test(key))                        fields.boat_year  = value;
    if (/^(bootsmodell|model|modell)$/.test(key))                                             fields.boat_model = value;

    // --- Location ---
    if (/^(marina|hafen|liegeplatz|port|standort|location|ort|aktueller.?standort|winterlager)$/.test(key)) fields.location = value;

    // --- Timing ---
    if (/^(termin|wunschtermin|datum|date|zeitraum|zeitpunkt|when|wann|gewunschter.?termin)$/.test(key)) fields.desired_date = value;
  }

  // Merge first + last name if only split parts available
  if (!fields.name && (fields.first_name || fields.last_name)) {
    fields.name = [fields.first_name, fields.last_name].filter(Boolean).join(' ');
  }

  // --- WIDGET/CMS FORM FORMAT ---
  // Handles label-per-line format:  "Email\n aaaaa@aaaa.at\nText\n +43..."
  // where labels are single words and values are on the next line (possibly indented)
  if (!fields.email || !fields.phone || !fields.name) {
    const widgetLines = bodyText.split(/\r?\n/);
    for (let i = 0; i < widgetLines.length - 1; i++) {
      const label = widgetLines[i].trim().toLowerCase();
      const value = widgetLines[i + 1].trim();
      if (!value) continue;
      if (!fields.email && /^e.?mail$/.test(label) && value.includes('@')) {
        fields.email = value.toLowerCase();
      } else if (!fields.phone && /^(text|phone|telefon|tel|mobil|mobile|handy)$/.test(label) && /\+?[\d\s\-()]{6,}/.test(value)) {
        fields.phone = value;
      } else if (!fields.name && /^(name|kontakt|text)$/.test(label) && value.length > 1 && !value.includes('@')) {
        fields.name = value;
      } else if (!fields.message && /^(textarea|nachricht|message|anfrage|anliegen)$/.test(label) && value.length > 1) {
        // For textarea, collect all subsequent lines until next label
        const messageLines = [value];
        for (let j = i + 2; j < widgetLines.length; j++) {
          const nextLine = widgetLines[j].trim();
          // Stop if we hit another label (single word followed by newline with value)
          if (nextLine && j < widgetLines.length - 1 && 
              /^(text|email|name|select|textarea|phone|telefon)$/i.test(nextLine)) {
            break;
          }
          if (nextLine) messageLines.push(nextLine);
        }
        fields.message = messageLines.join('\n');
      } else if (!fields.service && /^(select|service|leistung|dienstleistung)$/.test(label) && value.length > 1) {
        fields.service = value;
      }
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------

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

function extractPhoneFromText(text) {
  if (!text) return null;
  // Try to find a phone number pattern; require at least 7 digits
  const match = text.match(/(\+?[\d\s\-().]{7,25})/);
  if (!match) return null;
  const candidate = match[1].replace(/\s+/g, ' ').trim();
  const digits = candidate.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return candidate;
  return null;
}

function extractBoatDetailsFromText(text) {
  if (!text) return {};
  const details = {};

  const lengthMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m(?:eter|etre)?(?:\s|,|\.|\b)/i);
  if (lengthMatch) details.boat_length = lengthMatch[1].replace(',', '.');

  const types = ['sailboat', 'motorboat', 'catamaran', 'rib', 'motorjacht', 'segelyacht', 'segelboot', 'motoryacht', 'katamaran'];
  for (const t of types) {
    if (text.toLowerCase().includes(t)) { details.boat_type = t; break; }
  }

  const brands = ['beneteau', 'jeanneau', 'bavaria', 'hanse', 'dufour', 'sun odyssey', 'oceanis', 'elan', 'lagoon', 'fountaine pajot', 'nautitech', 'princess', 'azimut', 'fairline', 'hallberg-rassy', 'moody', 'dehler', 'catalina'];
  for (const b of brands) {
    if (text.toLowerCase().includes(b)) { details.boat_brand = b; break; }
  }

  return details;
}

function classifyInquiryType(text, subject) {
  const c = `${subject || ''} ${text || ''}`.toLowerCase();
  if (c.match(/notfall|emergency|urgent|dringend/))                                            return 'Emergency';
  if (c.match(/part|ersatzteil|teile|spare|ersatz/))                                          return 'Parts Request';
  if (c.match(/service|wartung|maintenance|inspektion|inspection|winter|antifoul|osmose|pflege|überwinterung|winterlager/)) return 'Maintenance';
  return 'Service Inquiry';
}

function classifyPriority(text, subject) {
  const c = `${subject || ''} ${text || ''}`.toLowerCase();
  if (c.match(/urgent|dringend|sofort|emergency|notfall|asap/)) return 'Urgent';
  if (c.match(/soon|bald|quickly|schnell/))                     return 'High';
  return 'Medium';
}

// ---------------------------------------------------------------------------
// MAIN LEAD EXTRACTION
// Combines contact-form structured fields + free-text fallbacks
// ---------------------------------------------------------------------------

function extractLeadPayload(record) {
  const body         = record.body_text || '';
  const rawSubject   = record.subject || '(no subject)';
  let   resolvedName  = record.from_name  || '';
  let   resolvedEmail = record.from_email || '';
  let   senderSource  = 'direct';

  // --- SENDER GUARD ---
  // If from_email is internal, try to find the real external sender in the body
  if (isInternalEmail(resolvedEmail)) {
    const fwdSender = extractForwardedSender(body);
    if (fwdSender) {
      resolvedName  = fwdSender.name;
      resolvedEmail = fwdSender.email;
      senderSource  = 'forwarded_body';
    } else {
      // Could not find external sender — block
      return { blocked: true, blockReason: 'internal_sender_no_external_found' };
    }
  }

  // Final safety check: resolved email must be external
  if (isInternalEmail(resolvedEmail)) {
    return { blocked: true, blockReason: 'resolved_sender_still_internal' };
  }

  // --- EXTRACT FORWARDED CUSTOMER BODY (if available) ---
  // For forwarded emails, we only want to parse the *customer's* original message,
  // not the forwarder's signature or their own header block.
  const customerBody = (senderSource === 'forwarded_body')
    ? (extractForwardedBody(body) || body)
    : body;

  // --- STRUCTURED CONTACT FORM FIELDS ---
  // Parse from customer body only
  const formFields = parseContactFormFields(customerBody);

  // Prefer form-extracted values over header values where available
  const finalName  = formFields.name  || resolvedName || resolvedEmail;
  const finalEmail = formFields.email || resolvedEmail;
  // Phone: prefer form fields, then scan ONLY the customer body (not forwarder signature)
  const finalPhone = formFields.phone || extractPhoneFromText(customerBody) || extractPhoneFromText(rawSubject) || '';

  // --- BOAT DETAILS ---
  // Prefer form fields, fall back to free-text scan of customer body only
  const textBoatDetails = extractBoatDetailsFromText(customerBody);
  const boatParts = [
    formFields.boat_name   ? `vessel: ${formFields.boat_name}` : null,
    formFields.boat_brand  || textBoatDetails.boat_brand  ? `brand: ${formFields.boat_brand || textBoatDetails.boat_brand}` : null,
    formFields.boat_model  ? `model: ${formFields.boat_model}` : null,
    formFields.boat_type   || textBoatDetails.boat_type   ? `type: ${formFields.boat_type || textBoatDetails.boat_type}` : null,
    formFields.boat_length || textBoatDetails.boat_length ? `length: ${formFields.boat_length || textBoatDetails.boat_length}m` : null,
    formFields.boat_year   ? `year: ${formFields.boat_year}` : null,
  ].filter(Boolean);
  const boatDetailsStr = boatParts.join(', ');

  // --- INQUIRY TYPE & PRIORITY ---
  const inquiryText  = formFields.message || formFields.service || customerBody;
  const inquiryType  = classifyInquiryType(inquiryText, rawSubject);
  const priority     = classifyPriority(inquiryText, rawSubject);

  // --- DESCRIPTION ---
  // Use the structured message field if available, otherwise the customer body
  const description = (formFields.message || customerBody).substring(0, 5000);

  // --- AI-BASED MISSING INFO ANALYSIS ---
  // Note: This runs server-side during lead creation, NOT in frontend
  // We intentionally skip LLM call here to keep lead creation fast
  // The REAL AI analysis happens later in LeadIntelligencePanel when user opens the lead
  const contextQuestions = [
    '🤖 KI-ANALYSE AUSSTEHEND: Bitte Lead öffnen und "Run Analysis" klicken für intelligente Nachfragen-Generierung'
  ];
  
  // --- STRUCTURED NOTES (audit trail) ---
  const structuredNotes = [
    `[Auto-created from website inquiry email]`,
    `Sender source: ${senderSource}`,
    `Mailbox: ${record.mailbox_name || 'n/a'}`,
    `Message-ID: ${record.message_id || 'n/a'}`,
    `Received: ${record.received_at || 'n/a'}`,
    `Subject: ${rawSubject}`,
    formFields.company     ? `Company: ${formFields.company}`       : null,
    formFields.service     ? `Requested service: ${formFields.service}` : null,
    boatDetailsStr         ? `Boat: ${boatDetailsStr}`              : null,
    formFields.location    ? `Location/marina: ${formFields.location}` : null,
    formFields.desired_date? `Desired date: ${formFields.desired_date}` : null,
    contextQuestions.length > 0 ? `\n--- NACHFRAGEN (KI-ANALYSE) ---\n${contextQuestions.join('\n')}` : null,
    `Conversation key: ${record.conversation_key || 'n/a'}`,
  ].filter(Boolean).join('\n');

  const leadPayload = {
    name:           finalName,
    email:          finalEmail,
    phone:          finalPhone || '+0',    // phone is required in Lead schema
    contact_method: 'Website',
    inquiry_type:   inquiryType,
    priority:       priority,
    status:         'New Incoming',
    description:    description,
    notes:          structuredNotes,
  };

  if (boatDetailsStr) leadPayload.boat_details = boatDetailsStr;
  if (formFields.location) leadPayload.location = formFields.location;

  const extractionStatus = (finalName && finalEmail && finalPhone) ? 'extracted' : 'partial';

  return { blocked: false, payload: leadPayload, extractionStatus, senderSource, formFields };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));

    // Support entity automation event payload format
    let sandboxRecordId = body.sandbox_record_id || body.entity_id;
    if (body.event?.entity_id) sandboxRecordId = body.event.entity_id;
    if (body.data?.id)         sandboxRecordId = body.data.id;

    let recordsToProcess = [];

    if (sandboxRecordId) {
      const records = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ id: sandboxRecordId });
      recordsToProcess = records || [];
    } else {
      // Bulk mode: all unprocessed valid inbound messages
      const allInbound  = await base44.asServiceRole.entities.EmailMessageSandbox.filter({ direction: 'inbound' });
      const allBridges  = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 500);
      const bridgedIds  = new Set((allBridges || []).map(b => b.source_sandbox_record_id).filter(Boolean));

      recordsToProcess = (allInbound || []).filter(r =>
        r.duplicate_status !== 'duplicate' &&
        (r.processing_status === 'stored' || r.processing_status === 'parsed' || r.processing_status === 'sanitized') &&
        !bridgedIds.has(r.id) &&
        // FIX #6: Skip records where from_email is still unknown — data quality guard
        r.from_email !== 'unknown@unknown'
      );
    }

    if (recordsToProcess.length === 0) {
      return Response.json({ success: true, message: 'No new records to process', processed: 0 });
    }

    // Load bridges once for duplicate checking
    const allBridges         = await base44.asServiceRole.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 500);
    const existingMessageIds = new Set((allBridges || []).map(b => b.source_email_message_id).filter(Boolean));
    const existingFingerprints = new Set((allBridges || []).map(b => b.internal_notes).filter(n => n?.startsWith('fingerprint:')));

    const results = [];

    for (const record of recordsToProcess) {
      const result = { record_id: record.id, subject: record.subject, from_email: record.from_email };

      try {
        // --- SENDER GUARD + EXTRACTION ---
        const extracted = extractLeadPayload(record);

        if (extracted.blocked) {
          // Log as blocked bridge record (auditable)
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
            creation_error_log: `Blocked: ${extracted.blockReason}`,
            auto_created_at: new Date().toISOString(),
          });
          result.status = 'blocked_internal_sender';
          result.reason = extracted.blockReason;
          results.push(result);
          continue;
        }

        const { payload: leadPayload, extractionStatus, senderSource } = extracted;
        const resolvedEmail = leadPayload.email;

        // --- DUPLICATE CHECKS ---
        const messageId   = record.message_id;
        const fingerprint = `fingerprint:${buildFingerprint(resolvedEmail, record.subject, record.received_at)}`;

        // Check 1: Already bridged by sandbox record ID
        const alreadyBridged = allBridges.find(b => b.source_sandbox_record_id === record.id);
        if (alreadyBridged) {
          result.status = 'skipped_already_bridged';
          result.bridge_id = alreadyBridged.id;
          results.push(result);
          continue;
        }

        // Check 2: Duplicate by Message-ID
        if (messageId && existingMessageIds.has(messageId)) {
          await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
            source_email_message_id: messageId,
            source_sandbox_record_id: record.id,
            source_conversation_key: record.conversation_key,
            source_from_email: resolvedEmail,
            source_from_name: leadPayload.name,
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

        // Check 3: Fallback fingerprint
        if (existingFingerprints.has(fingerprint)) {
          await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
            source_email_message_id: messageId,
            source_sandbox_record_id: record.id,
            source_conversation_key: record.conversation_key,
            source_from_email: resolvedEmail,
            source_from_name: leadPayload.name,
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

        // --- CREATE LEAD ---
        const createdLead = await base44.asServiceRole.entities.Lead.create(leadPayload);

        // --- CREATE BRIDGE RECORD ---
        await base44.asServiceRole.entities.EmailLeadBridgeSandbox.create({
          source_email_message_id: messageId,
          source_sandbox_record_id: record.id,
          source_conversation_key: record.conversation_key,
          source_from_email: resolvedEmail,
          source_from_name: leadPayload.name,
          source_subject: record.subject,
          source_received_at: record.received_at,
          lead_created: true,
          created_lead_id: createdLead.id,
          duplicate_check_status: 'unique',
          extraction_status: extractionStatus,
          creation_status: 'created',
          extracted_lead_payload_json: { ...leadPayload, _sender_source: senderSource },
          auto_created_at: new Date().toISOString(),
          internal_notes: fingerprint,
        });

        // Update in-memory sets for remaining batch items
        if (messageId) existingMessageIds.add(messageId);
        existingFingerprints.add(fingerprint);

        result.status      = 'created';
        result.lead_id     = createdLead.id;
        result.sender_source = senderSource;
        results.push(result);

      } catch (err) {
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
        }).catch(() => {});

        result.status = 'error';
        result.error  = err.message;
        results.push(result);
      }
    }

    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return Response.json({ success: true, processed: results.length, summary, results });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});