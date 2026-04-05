/**
 * createBillingOfferFromWO
 *
 * Converts one or more Ready-to-Invoice WorkOrders into a commercial Offer snapshot
 * for FIRA billing export. This is the bridge between the operational layer
 * (WorkOrder / TimeEntry / MaterialUsage / CustomerMaterialEntry) and the
 * existing FIRA export pipeline (Offer / OfferTask / firaExportOffer).
 *
 * Safety guarantees:
 * - Only EXECUTION/STANDARD WorkOrders with status "Ready to Invoice" are accepted
 * - Only unbilled (no billed_offer_id) AND unreserved (no staged_offer_id) items included
 * - staged_offer_id is set on all included items immediately after Offer creation
 *   → prevents the same item from appearing in a second Offer before FIRA export
 * - Material pricing uses MaterialUsage.unit_price first (historical snapshot),
 *   falls back to InventoryItem.sales_price only if usage-time price is missing
 * - Post-export locking (billed_offer_id + is_locked) is handled by firaExportOffer
 *
 * Input: { work_order_ids: string[], title?: string, language?: string, vat_rate?: number, valid_until_days?: number }
 * Output: { success, offer_id, offer_number, line_items_created, warnings[] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      work_order_ids = [],
      unlinked_cme_ids = [],  // explicitly selected unlinked CustomerMaterialEntry IDs
      title,
      language = 'German',
      vat_rate = 0,
      valid_until_days = 30,
    } = body;

    if ((!work_order_ids || work_order_ids.length === 0) && (!unlinked_cme_ids || unlinked_cme_ids.length === 0)) {
      return Response.json({ error: 'At least one work_order_id or unlinked_cme_id is required' }, { status: 400 });
    }

    const warnings = [];

    // ── 1. Fetch and validate WorkOrders ──────────────────────────────────────
    let targetWOs = [];
    if (work_order_ids.length > 0) {
      const allWOs = await base44.asServiceRole.entities.WorkOrder.list('-scheduled_date', 1000);
      targetWOs = allWOs.filter(wo => work_order_ids.includes(wo.id));

      if (targetWOs.length === 0) {
        return Response.json({ error: 'No matching WorkOrders found' }, { status: 404 });
      }

      const invalidWOs = targetWOs.filter(wo =>
        wo.status !== 'Ready to Invoice' ||
        wo.workorder_type === 'ORGANIZATION'
      );

      if (invalidWOs.length > 0) {
        return Response.json({
          error: `Some WorkOrders are not eligible: ${invalidWOs.map(w => `${w.work_order_number} (${w.status}, ${w.workorder_type})`).join(', ')}. Only EXECUTION/STANDARD WorkOrders with status "Ready to Invoice" are allowed.`
        }, { status: 400 });
      }
    }

    // ── 2. Resolve Job, Customer, Boat, Location ──────────────────────────────
    // If WOs present, resolve from first WO's job. If only unlinked CME, resolve from first CME.
    let job = null;
    let sourceCustomerId = null;
    const sourceJobIds = [...new Set(targetWOs.map(wo => wo.job_id).filter(Boolean))];

    if (targetWOs.length > 0) {
      const primaryWO = targetWOs[0];
      const jobs = await base44.asServiceRole.entities.Job.filter({ id: primaryWO.job_id });
      job = jobs[0];
      if (!job) return Response.json({ error: `Job not found for WorkOrder ${primaryWO.work_order_number}` }, { status: 404 });
      sourceCustomerId = job.customer_id;
    } else {
      // Material-only path: resolve customer from first unlinked CME
      const firstCMEList = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ id: unlinked_cme_ids[0] });
      if (!firstCMEList[0]?.customer_id) {
        return Response.json({ error: 'Could not resolve customer from provided CME IDs' }, { status: 400 });
      }
      sourceCustomerId = firstCMEList[0].customer_id;
    }

    // ── 3. Gather unbilled + unreserved TimeEntries ───────────────────────────
    // SAFETY: exclude both billed_offer_id (final) and staged_offer_id (reserved)
    const allTimeEntries = [];
    for (const wo of targetWOs) {
      const entries = await base44.asServiceRole.entities.TimeEntry.filter({ work_order_id: wo.id });
      allTimeEntries.push(...entries);
    }
    const unbilledTimeEntries = allTimeEntries.filter(te =>
      te.is_billable !== false &&   // include default-true records (not explicitly false)
      !te.billed_offer_id &&
      !te.staged_offer_id
    );

    // ── 4. Gather unbilled + unreserved MaterialUsage ─────────────────────────
    const allMaterialUsage = [];
    for (const wo of targetWOs) {
      const items = await base44.asServiceRole.entities.MaterialUsage.filter({ work_order_id: wo.id });
      allMaterialUsage.push(...items);
    }
    const unbilledMaterial = allMaterialUsage.filter(m =>
      m.billable !== false &&   // include default-true records (not explicitly false)
      !m.billed_offer_id &&
      !m.staged_offer_id
    );

    // ── 5. Gather unbilled + unreserved CustomerMaterialEntry ────────────────
    // Linked CME (auto-included): linked to selected WOs or jobs
    // Unlinked CME (explicit only): only if user passed unlinked_cme_ids
    const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ customer_id: sourceCustomerId });
    const woIdSet = new Set(work_order_ids);
    const jobIdSet = new Set(sourceJobIds);
    const unlinkedCMEIdSet = new Set(unlinked_cme_ids);

    // Validate all unlinked CME belong to the same customer
    if (unlinked_cme_ids.length > 0) {
      const unlinkedCMEFound = allCME.filter(c => unlinkedCMEIdSet.has(c.id));
      const wrongCustomer = unlinkedCMEFound.filter(c => c.customer_id !== sourceCustomerId);
      if (wrongCustomer.length > 0) {
        return Response.json({ error: 'All selected material must belong to the same customer' }, { status: 400 });
      }
    }

    const linkedUnbilledCME = allCME.filter(cme =>
      !cme.billed_offer_id &&
      !cme.staged_offer_id &&
      (
        (cme.work_order_id && woIdSet.has(cme.work_order_id)) ||
        (cme.job_id && jobIdSet.has(cme.job_id))
      )
    );

    // Explicitly selected unlinked CME
    const selectedUnlinkedCME = allCME.filter(cme =>
      unlinkedCMEIdSet.has(cme.id) &&
      !cme.billed_offer_id &&
      !cme.staged_offer_id
    );

    const unbilledCME = [...linkedUnbilledCME, ...selectedUnlinkedCME];

    if (unbilledTimeEntries.length === 0 && unbilledMaterial.length === 0 && unbilledCME.length === 0) {
      warnings.push('No unbilled/unreserved items found for the selected WorkOrders. Offer created but will be empty.');
    }

    // ── 6. Resolve Technicians and InventoryItems for price snapshots ─────────
    const technicianIds = [...new Set(unbilledTimeEntries.map(te => te.technician_id).filter(Boolean))];
    const inventoryIds = [...new Set(unbilledMaterial.map(m => m.inventory_item_id).filter(Boolean))];

    const [allTechs, allInventory] = await Promise.all([
      technicianIds.length > 0 ? base44.asServiceRole.entities.Technician.list() : Promise.resolve([]),
      inventoryIds.length > 0 ? base44.asServiceRole.entities.InventoryItem.list() : Promise.resolve([]),
    ]);

    const techMap = Object.fromEntries(allTechs.map(t => [t.id, t]));
    const inventoryMap = Object.fromEntries(allInventory.map(i => [i.id, i]));

    // Build WO map for title prefixing (already loaded, zero extra fetch)
    const woMap = Object.fromEntries(targetWOs.map(wo => [wo.id, wo]));

    // Load Tasks for TimeEntry + MaterialUsage lines that carry task_id
    const sourceTaskIds = [
      ...unbilledTimeEntries.map(te => te.task_id),
      ...unbilledMaterial.map(m => m.task_id),
    ].filter(Boolean);
    const allSourceTasks = sourceTaskIds.length > 0
      ? await base44.asServiceRole.entities.Task.list()
      : [];
    const taskMap = Object.fromEntries(allSourceTasks.map(t => [t.id, t]));

    // ── 7. Calculate totals (snapshot at creation time) ───────────────────────
    let totalAmount = 0;

    unbilledTimeEntries.forEach(te => {
      const tech = techMap[te.technician_id];
      const rate = tech?.hourly_rate_billable || 0;
      totalAmount += rate * ((te.duration_minutes || 0) / 60);
    });

    unbilledMaterial.forEach(m => {
      const item = inventoryMap[m.inventory_item_id];
      // FIX: MaterialUsage.unit_price is primary (historical snapshot at time of use).
      // InventoryItem.sales_price is fallback only — avoids live price overriding historical.
      const salesPrice = m.unit_price || item?.sales_price || 0;
      totalAmount += salesPrice * (m.quantity || 1);
    });

    unbilledCME.forEach(cme => {
      totalAmount += cme.total_purchase_price || 0;
    });

    // ── 8. Create Offer ───────────────────────────────────────────────────────
    const validUntil = new Date(Date.now() + valid_until_days * 86400000).toISOString().split('T')[0];
    const offerTitle = title || (targetWOs.length > 0
      ? `Billing — ${targetWOs.map(w => w.work_order_number).join(', ')}`
      : `Billing Material — ${new Date().toISOString().split('T')[0]}`);
    const fallbackNumber = `BILL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    let offerNumber = fallbackNumber;
    try {
      const offerNumberRes = await base44.functions.invoke('allocateWorkOrderNumber', {});
      offerNumber = offerNumberRes?.data?.number || fallbackNumber;
    } catch (e) {
      warnings.push(`Could not allocate offer number via function, using fallback: ${fallbackNumber}`);
    }

    const newOffer = await base44.asServiceRole.entities.Offer.create({
      offer_number: offerNumber,
      customer_id: sourceCustomerId,
      boat_id: job?.boat_id || null,
      location_id: job?.location_id || null,
      job_id: job?.id || null,
      title: offerTitle,
      language,
      vat_rate,
      total_amount: parseFloat(totalAmount.toFixed(2)),
      subtotal: parseFloat(totalAmount.toFixed(2)),
      status: 'Draft',
      valid_until: validUntil,
      source_type: 'READY_TO_INVOICE_REVIEW',
      source_work_order_ids: work_order_ids,
      source_job_ids: sourceJobIds,
      fira_export_status: 'not_exported',
      fira_export_attempt_count: 0,
      notes: `Auto-generated billing offer from Ready-to-Invoice WorkOrders: ${targetWOs.map(w => w.work_order_number).join(', ')}. Created by ${user.email}.`,
      ai_generated: false,
    });

    const offerId = newOffer.id;

    // ── 9. RESERVATION: Set staged_offer_id on all included items ────────────
    // This prevents these exact items from being included in any other Offer
    // before this one is either exported (→ billed_offer_id) or cancelled (→ clear staged_offer_id).
    // Non-fatal: if a reservation fails, we log a warning but continue — the partial
    // reservation still reduces duplicate risk and the UI can detect inconsistencies.
    try {
      await Promise.all([
        ...unbilledTimeEntries.map(te =>
          base44.asServiceRole.entities.TimeEntry.update(te.id, { staged_offer_id: offerId })
        ),
        ...unbilledMaterial.map(m =>
          base44.asServiceRole.entities.MaterialUsage.update(m.id, { staged_offer_id: offerId })
        ),
        ...unbilledCME.map(cme =>
          base44.asServiceRole.entities.CustomerMaterialEntry.update(cme.id, { staged_offer_id: offerId })
        ),
      ]);
      console.log(`[createBillingOfferFromWO] Reserved ${unbilledTimeEntries.length} time entries, ${unbilledMaterial.length} material usages, ${unbilledCME.length} CME records for offer ${offerId}`);
    } catch (reservationErr) {
      warnings.push(`Reservation warning: could not set staged_offer_id on all source items: ${reservationErr.message}. Some items may remain available for re-selection until export completes.`);
      console.error(`[createBillingOfferFromWO] Reservation partial failure for offer ${offerId}:`, reservationErr.message);
    }

    // ── Unit type normalizer ─────────────────────────────────────────────────
    // OfferTask.unit_type enum: Hour, Piece, Square Meter, Linear Meter, Liter, Kilogram, Set, Lump Sum, km, day, month, season, flat
    const UNIT_MAP = {
      'Piece': 'Piece', 'pcs': 'Piece', 'Stk': 'Piece', 'Stk.': 'Piece', 'stk': 'Piece', 'pc': 'Piece',
      'Meter': 'Linear Meter', 'm': 'Linear Meter', 'meter': 'Linear Meter',
      'Kg': 'Kilogram', 'kg': 'Kilogram', 'KG': 'Kilogram', 'kilogram': 'Kilogram',
      'Liter': 'Liter', 'l': 'Liter', 'L': 'Liter', 'liter': 'Liter',
      'Set': 'Set', 'set': 'Set',
      'Box': 'Piece', 'Roll': 'Piece', 'box': 'Piece', 'roll': 'Piece',
      'Hour': 'Hour', 'hr': 'Hour', 'hrs': 'Hour', 'h': 'Hour',
      'km': 'km', 'day': 'day', 'month': 'month',
    };
    const VALID_UNIT_TYPES = new Set(['Hour','Piece','Square Meter','Linear Meter','Liter','Kilogram','Set','Lump Sum','km','day','month','season','flat']);
    const normalizeUnit = (raw) => {
      if (!raw) return 'Piece';
      if (VALID_UNIT_TYPES.has(raw)) return raw;
      return UNIT_MAP[raw] || 'Piece';  // unknown → safest fallback
    };

    // ── 10. Create OfferTask rows — LABOR ─────────────────────────────────────
    let lineOrder = 0;
    let lineItemsCreated = 0;

    for (const te of unbilledTimeEntries) {
      const tech = techMap[te.technician_id];
      const rate = tech?.hourly_rate_billable || 0;
      const hours = parseFloat(((te.duration_minutes || 0) / 60).toFixed(2));
      const techName = tech ? `${tech.first_name} ${tech.last_name}` : 'Technician';
      const wo = woMap[te.work_order_id];
      const woPrefix = wo?.work_order_number ? `${wo.work_order_number} — ` : '';
      const task = te.task_id ? taskMap[te.task_id] : null;

      if (rate === 0) {
        warnings.push(`TimeEntry ${te.id}: Technician ${techName} has no hourly_rate_billable set — line item created with €0 rate.`);
      }

      // Build description: Task first, then Notes (no duplication in title)
      const descParts = [];
      if (task?.title) descParts.push(`Task: ${task.title}`);
      if (te.notes) descParts.push(`Notes: ${te.notes}`);

      await base44.asServiceRole.entities.OfferTask.create({
        offer_id: offerId,
        sequence_order: lineOrder++,
        title: `${woPrefix}Labor: ${techName}${te.entry_date ? ` — ${te.entry_date}` : ''}`,
        description: descParts.join('\n'),
        item_type: 'Labor',
        unit_type: 'Hour',
        quantity: hours,
        unit_price: rate,
        total_amount: parseFloat((rate * hours).toFixed(2)),
        is_optional: false,
      });
      lineItemsCreated++;
    }

    // ── 11. Create OfferTask rows — MATERIAL USAGE ────────────────────────────
    for (const m of unbilledMaterial) {
      const item = inventoryMap[m.inventory_item_id];
      // FIX: unit_price first (historical), sales_price as fallback only
      const salesPrice = m.unit_price || item?.sales_price || 0;
      const itemName = item?.name || `Item ${m.inventory_item_id}`;
      const unit = item?.unit || 'Piece';
      const wo = woMap[m.work_order_id];
      const woPrefix = wo?.work_order_number ? `${wo.work_order_number} — ` : '';
      const task = m.task_id ? taskMap[m.task_id] : null;

      if (salesPrice === 0) {
        warnings.push(`MaterialUsage ${m.id}: Item "${itemName}" has no recorded price — line item created with €0.`);
      }

      // Build description: Task first, then usage notes, then item description as fallback
      const descParts = [];
      if (task?.title) descParts.push(`Task: ${task.title}`);
      if (m.notes) descParts.push(`Notes: ${m.notes}`);
      else if (item?.description) descParts.push(item.description);

      await base44.asServiceRole.entities.OfferTask.create({
        offer_id: offerId,
        sequence_order: lineOrder++,
        title: `${woPrefix}Material: ${itemName}`,
        description: descParts.join('\n'),
        item_type: 'Material',
        unit_type: normalizeUnit(unit),
        quantity: m.quantity || 1,
        unit_price: salesPrice,
        total_amount: parseFloat((salesPrice * (m.quantity || 1)).toFixed(2)),
        is_optional: false,
      });
      lineItemsCreated++;
    }

    // ── 12. Create OfferTask rows — CUSTOMER MATERIAL ENTRIES ─────────────────
    for (const cme of unbilledCME) {
      const purchasePrice = cme.unit_purchase_price || 0;
      const cmeWO = cme.work_order_id ? woMap[cme.work_order_id] : null;
      const cmeWOPrefix = cmeWO?.work_order_number ? `${cmeWO.work_order_number} — ` : '';

      warnings.push(`CustomerMaterialEntry ${cme.id} ("${cme.item_title}"): using purchase price €${purchasePrice}. Review and add margin before FIRA export.`);

      // Build description: supplier/doc context + notes
      const cmeDescParts = [];
      if (cme.supplier_name) cmeDescParts.push(`Supplier: ${cme.supplier_name}`);
      if (cme.document_number) cmeDescParts.push(`Doc: ${cme.document_number}`);
      if (cme.notes) cmeDescParts.push(`Notes: ${cme.notes}`);

      await base44.asServiceRole.entities.OfferTask.create({
        offer_id: offerId,
        sequence_order: lineOrder++,
        title: `${cmeWOPrefix}Customer Material: ${cme.item_title}`,
        description: cmeDescParts.join(' | '),
        item_type: 'Material',
        unit_type: normalizeUnit(cme.unit),  // free-text unit → normalized enum value
        quantity: cme.quantity || 1,
        unit_price: purchasePrice,
        total_amount: parseFloat((purchasePrice * (cme.quantity || 1)).toFixed(2)),
        is_optional: false,
      });
      lineItemsCreated++;
    }

    console.log(`[createBillingOfferFromWO] Created Offer ${offerId} with ${lineItemsCreated} line items from ${work_order_ids.length} WOs.`);

    return Response.json({
      success: true,
      offer_id: offerId,
      offer_number: offerNumber,
      line_items_created: lineItemsCreated,
      labor_lines: unbilledTimeEntries.length,
      material_lines: unbilledMaterial.length,
      customer_material_lines: unbilledCME.length,
      warnings,
    });

  } catch (error) {
    console.error('[createBillingOfferFromWO] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});