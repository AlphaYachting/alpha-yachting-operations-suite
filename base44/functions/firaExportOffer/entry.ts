// FIRA Finance Export — Alpha Yachting CRM
// Exports an existing offer as PONUDA (offer) to FIRA Custom Webshop API.
// STRICT ISOLATION: does not touch invoices, work orders, or other finance logic.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Country normalizer ──────────────────────────────────────────────────────
const COUNTRY_MAP = {
  'austria': 'AT', 'österreich': 'AT', 'osterreich': 'AT',
  'germany': 'DE', 'deutschland': 'DE',
  'croatia': 'HR', 'hrvatska': 'HR',
  'italy': 'IT', 'italien': 'IT', 'italia': 'IT',
  'slovenia': 'SI', 'slowenien': 'SI', 'slovenija': 'SI',
  'switzerland': 'CH', 'schweiz': 'CH',
  'france': 'FR', 'frankreich': 'FR',
  'spain': 'ES', 'spanien': 'ES',
  'netherlands': 'NL', 'niederlande': 'NL',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'united states': 'US', 'usa': 'US',
  'montenegro': 'ME', 'crna gora': 'ME',
  'serbia': 'RS', 'srbija': 'RS',
  'bosnia': 'BA', 'bosna': 'BA',
  'czechia': 'CZ', 'czech republic': 'CZ',
  'poland': 'PL', 'hungary': 'HU', 'slovakia': 'SK',
};

function normalizeCountry(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  return COUNTRY_MAP[key] || null;
}

// ── Simple positive-integer hash ────────────────────────────────────────────
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Stable numeric webshopOrderId from offer_number ─────────────────────────
// OFF-2026-0042 → 20260042
function deriveWebshopOrderId(offerNumber) {
  if (!offerNumber) return null;
  const digits = offerNumber.replace(/[^0-9]/g, '');
  if (digits.length >= 4) return parseInt(digits, 10);
  return simpleHash(offerNumber) % 9999999 + 1;
}

// ── Unit type mapper ─────────────────────────────────────────────────────────
function mapUnit(unitType) {
  const map = {
    'Hour': 'h', 'Piece': 'kom', 'Square Meter': 'm2',
    'Linear Meter': 'm', 'Liter': 'l', 'Kilogram': 'kg',
    'Set': 'set', 'Lump Sum': 'pau', 'km': 'km',
    'day': 'dan', 'month': 'mj', 'season': 'sez', 'flat': 'pau',
  };
  return map[unitType] || 'kom';
}

// ── Export hash (duplicate detection) ───────────────────────────────────────
function buildExportHash(offer, tasks) {
  const raw = [
    offer.offer_number || '',
    offer.customer_id || '',
    String(offer.total_amount || 0),
    String(tasks.length),
    offer.valid_until || '',
    String(offer.vat_rate || 0),
  ].join('|');
  return String(simpleHash(raw));
}

// ── Validation ───────────────────────────────────────────────────────────────
function validate(offer, tasks, customer) {
  const errors = [];
  if (!offer.offer_number) errors.push('Offer number is missing');
  if (!customer) errors.push('Customer record not found');
  if (customer) {
    if (!customer.billing_country) errors.push('Billing country is missing (required for FIRA)');
    if (!normalizeCountry(customer.billing_country)) errors.push(`Billing country "${customer.billing_country}" could not be mapped to a 2-letter code`);
    if (!customer.company_name && !customer.last_name) errors.push('Customer billing name (company or last name) is missing');
  }
  if (!tasks || tasks.length === 0) errors.push('At least one non-optional line item is required');
  if (offer.total_amount == null || isNaN(Number(offer.total_amount))) errors.push('Offer totals are missing or invalid');
  return errors;
}

// ── Payload mapper ────────────────────────────────────────────────────────────
function buildFiraPayload(offer, tasks, customer, location) {
  const vatRateDecimal = (offer.vat_rate || 0) / 100;

  // Totals — use existing offer totals, no new pricing engine
  const netto = parseFloat((offer.total_amount || 0).toFixed(2));
  const taxValue = parseFloat((netto * vatRateDecimal).toFixed(2));
  const brutto = parseFloat((netto + taxValue).toFixed(2));

  // Billing address
  const isCompany = customer.customer_type !== 'Private' || !!customer.company_name;
  const contactName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  const billingName = customer.company_name || contactName || '';
  const country2 = normalizeCountry(customer.billing_country) || '';

  const billingAddress = {
    name: billingName,
    address1: customer.billing_address || '',
    address2: '',
    city: customer.billing_city || '',
    country: country2,
    phone: customer.phone || customer.phone_secondary || '',
    zipCode: customer.billing_postal_code || '',
    email: customer.email || '',
    vatNumber: customer.vat_number || '',
    oib: customer.vat_number || '',
    company: isCompany ? (customer.company_name || '') : '',
  };

  // Shipping address — service location if available, otherwise omit
  let shippingAddress = null;
  if (location && location.address && location.city) {
    shippingAddress = {
      name: location.name || '',
      address1: location.address || '',
      city: location.city || '',
      country: normalizeCountry(location.country) || 'HR',
      zipCode: '',
      phone: location.contact_phone || '',
    };
  }

  // Discount percentage per line item (FIRA expects discountPercentage on each item)
  let lineDiscountPercent = 0;
  if (offer.discount_mode === 'PERCENT' && offer.discount_percent > 0) {
    lineDiscountPercent = offer.discount_percent;
  } else if ((offer.discount_mode === 'TARGET_TOTAL' || offer.discount_mode === 'AMOUNT') && offer.discount_amount > 0 && netto > 0) {
    lineDiscountPercent = parseFloat(((offer.discount_amount / (netto + offer.discount_amount)) * 100).toFixed(4));
  }

  // Line items — non-optional tasks only
  const lineItems = tasks
    .filter(t => !t.is_optional)
    .map((task, idx) => {
      // Bilingual FIRA export name: "German Title / Hrvatski naziv" when both exist
      const cleanTitle = (task.title || '').trim();
      const cleanTitleHr = (task.title_hr || '').trim();
      const combinedName = cleanTitle && cleanTitleHr
        ? `${cleanTitle} / ${cleanTitleHr}`
        : cleanTitle || cleanTitleHr || '';
      // FIRA: name field is varchar(255) — truncate if needed
      const exportName = combinedName.length > 255 ? combinedName.substring(0, 252) + '...' : combinedName;
      const item = {
        lineItemId: String(task.id || `item-${idx + 1}`),
        name: exportName,
        description: task.description || task.title || '',
        price: parseFloat((task.unit_price || 0).toFixed(4)),
        quantity: task.quantity || 1,
        unit: mapUnit(task.unit_type),
        taxRate: vatRateDecimal,
      };
      if (task.code) item.kpdCode = task.code;
      if (lineDiscountPercent > 0) item.discountPercentage = lineDiscountPercent;
      return item;
    });

  // Terms — by customer country
  const termsDE = 'Dieses Angebot gilt 30 Tage ab Ausstellungsdatum. Eigentumsvorbehalt bis zur vollständigen Bezahlung.';
  const termsHR = 'Ova ponuda vrijedi 30 dana od datuma izdavanja. Zadržano vlasništvo do potpune uplate.';
  const termsEN = 'This offer is valid for 30 days from the date of issue. Retention of title until full payment.';

  const now = new Date().toISOString();
  // FIRA spec: dueDate and validTo must be 'YYYY-MM-DD' format, createdAt is ISO datetime
  const validTo = offer.valid_until ? offer.valid_until : null; // already YYYY-MM-DD
  const dueDate = validTo || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const webshopOrderId = deriveWebshopOrderId(offer.offer_number);

  // Build the visible note content — this goes into internalNote (what FIRA displays as "Notiz")
  const noteParts = [];

  // Downpayment info FIRST — language determined by offer.language, NOT customer country
  if (offer.payment_terms_type === 'Downpayment' && offer.downpayment_percent > 0) {
    const dpAmount = offer.downpayment_amount != null
      ? `EUR ${parseFloat(offer.downpayment_amount).toFixed(2)}`
      : `${offer.downpayment_percent}%`;

    const offerLang = (offer.language || 'German').toLowerCase();
    if (offerLang === 'german') {
      noteParts.push(`Anzahlung: ${offer.downpayment_percent}% (${dpAmount}) bei Auftragsbestätigung. Restbetrag nach Abschluss der Arbeiten.`);
    } else if (offerLang === 'croatian') {
      noteParts.push(`Predujam: ${offer.downpayment_percent}% (${dpAmount}) pri potvrdi narudžbe. Ostatak nakon završetka radova.`);
    } else if (offerLang === 'italian') {
      noteParts.push(`Acconto: ${offer.downpayment_percent}% (${dpAmount}) alla conferma dell'ordine. Saldo alla conclusione dei lavori.`);
    } else if (offerLang === 'slovenian') {
      noteParts.push(`Predplačilo: ${offer.downpayment_percent}% (${dpAmount}) ob potrditvi naročila. Preostanek po zaključku del.`);
    } else {
      noteParts.push(`Downpayment: ${offer.downpayment_percent}% (${dpAmount}) upon order confirmation. Balance due upon completion.`);
    }
  } else if (offer.payment_terms_type === 'Installments' && offer.payment_schedule) {
    noteParts.push(offer.payment_schedule);
  }

  // Offer title + reference (after payment info)
  if (offer.title) {
    noteParts.push(`${offer.title.trim()} (${offer.offer_number || ''})`);
  }

  // Customer-visible notes
  if (offer.customer_notes && offer.customer_notes.trim()) {
    noteParts.push(offer.customer_notes.trim());
  }

  const builtNote = noteParts.join('\n\n');

  const payload = {
    webshopOrderId,
    webshopType: 'CUSTOM',
    webshopEvent: 'order_created',
    webshopOrderNumber: offer.offer_number || String(webshopOrderId),
    invoiceType: 'PONUDA',
    paymentGatewayCode: 'TRANSAKCIJSKI',
    paymentGatewayName: 'Bank Transfer / Banküberweisung',
    createdAt: offer.created_date ? new Date(offer.created_date).toISOString() : now,
    dueDate,
    validTo,
    currency: 'EUR',
    taxesIncluded: false,
    billingAddress,
    shippingAddress,
    taxValue,
    brutto,
    netto,
    lineItems,
    totalShipping: null,
    internalNote: builtNote || `Alpha Yachting Offer ${offer.offer_number || ''} | AY CRM Export`,
    note: builtNote || null,
    paymentType: 'TRANSAKCIJSKI',
  };

  // Attach terms based on country
  if (country2 === 'AT' || country2 === 'DE') payload.termsDE = termsDE;
  else if (country2 === 'HR') payload.termsHR = termsHR;
  else payload.termsEN = termsEN;

  return payload;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { offer_id, force_reexport } = body;

    if (!offer_id) return Response.json({ error: 'offer_id is required' }, { status: 400 });

    // Fetch offer (service role to ensure access)
    const offerList = await base44.asServiceRole.entities.Offer.list('-created_date', 500);
    const offer = offerList.find(o => o.id === offer_id);
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });

    // Guard: concurrent export
    if (offer.fira_export_status === 'exporting') {
      return Response.json({ success: false, error: 'Export already in progress for this offer' });
    }

    // Fetch tasks, customer, location in parallel
    const [allTasks, customerList, locationList] = await Promise.all([
      base44.asServiceRole.entities.OfferTask.filter({ offer_id: offer_id }, 'sequence_order'),
      offer.customer_id
        ? base44.asServiceRole.entities.Customer.list().then(list => list.filter(c => c.id === offer.customer_id))
        : Promise.resolve([]),
      offer.location_id
        ? base44.asServiceRole.entities.Location.list().then(list => list.filter(l => l.id === offer.location_id))
        : Promise.resolve([]),
    ]);

    const activeTasks = allTasks.filter(t => !t.is_optional);
    const customer = customerList[0] || null;
    const location = locationList[0] || null;

    // Duplicate hash protection
    const exportHash = buildExportHash(offer, activeTasks);
    if (!force_reexport && offer.fira_export_status === 'exported' && offer.fira_export_hash === exportHash) {
      return Response.json({
        success: false,
        already_exported: true,
        error: 'This offer was already successfully exported to FIRA with identical data.',
        fira_webshop_order_id: offer.fira_webshop_order_id,
        exported_at: offer.fira_exported_at,
        exported_by: offer.fira_exported_by,
      });
    }

    // Validate
    const errors = validate(offer, activeTasks, customer);
    if (errors.length > 0) {
      await base44.asServiceRole.entities.Offer.update(offer_id, {
        fira_export_status: 'failed',
        fira_last_error_message: errors.join('; '),
        fira_last_attempt_at: new Date().toISOString(),
        fira_export_attempt_count: (offer.fira_export_attempt_count || 0) + 1,
      });
      return Response.json({ success: false, validation_errors: errors });
    }

    // Mark as exporting (lock)
    await base44.asServiceRole.entities.Offer.update(offer_id, {
      fira_export_status: 'exporting',
      fira_invoice_type: 'PONUDA',
      fira_export_hash: exportHash,
      fira_last_attempt_at: new Date().toISOString(),
      fira_export_attempt_count: (offer.fira_export_attempt_count || 0) + 1,
    });

    // Build payload
    const payload = buildFiraPayload(offer, allTasks, customer, location);

    // FIRA API call
    const apiKey = Deno.env.get('FIRA_API_KEY');
    if (!apiKey) throw new Error('FIRA_API_KEY secret is not configured');

    // FIRA auth: secret key in 'FIRA-Api-Key' header (per FIRA error message)
    const firaUrl = 'https://app.fira.finance/api/v1/webshop/order/custom';

    let firaResponse, firaBody;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      firaResponse = await fetch(firaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'FIRA-Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const rawText = await firaResponse.text();
      try { firaBody = JSON.parse(rawText); } catch { firaBody = { raw: rawText }; }
    } catch (fetchErr) {
      await base44.asServiceRole.entities.Offer.update(offer_id, {
        fira_export_status: 'failed',
        fira_last_error_message: fetchErr.name === 'AbortError' ? 'Request timed out (15s)' : (fetchErr.message || 'Network error'),
        fira_request_payload_json: payload,
        fira_response_payload_json: null,
      });
      return Response.json({
        success: false,
        error: fetchErr.name === 'AbortError' ? 'FIRA API request timed out' : (fetchErr.message || 'Network error reaching FIRA API'),
      });
    }

    if (firaResponse.ok) {
      const externalRef = firaBody?.id || firaBody?.orderId || firaBody?.webshopOrderId || null;
      const exportedAt = new Date().toISOString();

      await base44.asServiceRole.entities.Offer.update(offer_id, {
        fira_export_status: 'exported',
        fira_exported_at: exportedAt,
        fira_exported_by: user.email,
        fira_last_error_message: null,
        fira_external_reference: externalRef != null ? String(externalRef) : '',
        fira_webshop_order_id: payload.webshopOrderId,
        fira_webshop_order_number: payload.webshopOrderNumber,
        fira_request_payload_json: payload,
        fira_response_payload_json: firaBody,
        fira_invoice_type: 'PONUDA',
        fira_export_hash: exportHash,
      });

      // ── Post-export locking: only for billing bridge offers (source_type = READY_TO_INVOICE_REVIEW)
      // Lock all staged/unbilled TimeEntry, MaterialUsage, and CustomerMaterialEntry records
      // that belong to the WorkOrders included in this offer. Clears staged_offer_id.
      if (offer.source_type === 'READY_TO_INVOICE_REVIEW' && Array.isArray(offer.source_work_order_ids) && offer.source_work_order_ids.length > 0) {
        console.log(`[firaExportOffer] Locking billing items for offer ${offer_id} (${offer.source_work_order_ids.length} WOs)`);

        try {
          for (const woId of offer.source_work_order_ids) {
            // Lock TimeEntries
            const timeEntries = await base44.asServiceRole.entities.TimeEntry.filter({ work_order_id: woId });
            const billableEntries = timeEntries.filter(te =>
              te.is_billable &&
              !te.billed_offer_id &&
              (te.staged_offer_id === offer_id || !te.staged_offer_id)
            );
            for (const te of billableEntries) {
              await base44.asServiceRole.entities.TimeEntry.update(te.id, {
                billed_offer_id: offer_id,
                billed_at: exportedAt,
                is_locked: true,
                staged_offer_id: null,
              });
            }

            // Lock MaterialUsage
            const materialUsages = await base44.asServiceRole.entities.MaterialUsage.filter({ work_order_id: woId });
            const billableMaterial = materialUsages.filter(m =>
              m.billable &&
              !m.billed_offer_id &&
              (m.staged_offer_id === offer_id || !m.staged_offer_id)
            );
            for (const m of billableMaterial) {
              await base44.asServiceRole.entities.MaterialUsage.update(m.id, {
                billed_offer_id: offer_id,
                billed_at: exportedAt,
                staged_offer_id: null,
              });
            }
          }

          // Lock CustomerMaterialEntry (linked by WO or job, or staged for this offer)
          if (offer.customer_id) {
            const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ customer_id: offer.customer_id });
            const woIdSet = new Set(offer.source_work_order_ids);
            const jobIdSet = new Set(Array.isArray(offer.source_job_ids) ? offer.source_job_ids : []);
            const billableCME = allCME.filter(cme =>
              !cme.billed_offer_id &&
              (
                cme.staged_offer_id === offer_id ||
                (
                  !cme.staged_offer_id &&
                  ((cme.work_order_id && woIdSet.has(cme.work_order_id)) ||
                   (cme.job_id && jobIdSet.has(cme.job_id)))
                )
              )
            );
            for (const cme of billableCME) {
              await base44.asServiceRole.entities.CustomerMaterialEntry.update(cme.id, {
                billed_offer_id: offer_id,
                billed_at: exportedAt,
                staged_offer_id: null,
              });
            }
          }

          console.log(`[firaExportOffer] Post-export locking complete for offer ${offer_id}`);
        } catch (lockErr) {
          // Locking failure is non-fatal — export already succeeded. Log for manual review.
          console.error(`[firaExportOffer] WARNING: Post-export locking failed for offer ${offer_id}: ${lockErr.message}. Export was successful but items may need manual locking.`);
        }
      }

      return Response.json({
        success: true,
        fira_response: firaBody,
        webshop_order_id: payload.webshopOrderId,
        webshop_order_number: payload.webshopOrderNumber,
      });
    } else {
      const errorMsg = firaBody?.message || firaBody?.error || firaBody?.errors?.join('; ') || `HTTP ${firaResponse.status}`;
      await base44.asServiceRole.entities.Offer.update(offer_id, {
        fira_export_status: 'failed',
        fira_last_error_message: errorMsg,
        fira_request_payload_json: payload,
        fira_response_payload_json: firaBody,
      });
      return Response.json({
        success: false,
        error: errorMsg,
        http_status: firaResponse.status,
        fira_response: firaBody,
      });
    }

  } catch (err) {
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
});