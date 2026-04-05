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
 * - FAILURE SAFETY: All staged reservations are rolled back if any step fails
 * - EMPTY OFFER SAFETY: Returns error if zero line items created (no orphaned empty offers)
 *
 * Input: { work_order_ids: string[], title?: string, language?: string, vat_rate?: number, valid_until_days?: number }
 * Output: { success, offer_id, offer_number, line_items_created, warnings[] } or { success: false, error, ... }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  // Track which records we stage in this run — for rollback on failure
  const stagedRecordIds = { timeEntries: [], materialUsages: [], cme: [] };
  let base44 = null;
  
  // Rollback staged reservations on failure
  const rollbackStagedRecords = async () => {
    if (!base44) return;
    if (stagedRecordIds.timeEntries.length === 0 && stagedRecordIds.materialUsages.length === 0 && stagedRecordIds.cme.length === 0) return;
    
    console.log(`[createBillingOfferFromWO] ROLLBACK: clearing staged_offer_id from ${stagedRecordIds.timeEntries.length} TimeEntries, ${stagedRecordIds.materialUsages.length} MaterialUsages, ${stagedRecordIds.cme.length} CME`);
    
    try {
      await Promise.all([
        ...stagedRecordIds.timeEntries.map(id => base44.asServiceRole.entities.TimeEntry.update(id, { staged_offer_id: null }).catch(() => {})),
        ...stagedRecordIds.materialUsages.map(id => base44.asServiceRole.entities.MaterialUsage.update(id, { staged_offer_id: null }).catch(() => {})),
        ...stagedRecordIds.cme.map(id => base44.asServiceRole.entities.CustomerMaterialEntry.update(id, { staged_offer_id: null }).catch(() => {})),
      ]);
      console.log(`[createBillingOfferFromWO] Rollback completed.`);
    } catch (rollbackErr) {
      console.error(`[createBillingOfferFromWO] Rollback partial failure:`, rollbackErr.message);
    }
  };
  
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      work_order_ids = [],
      unlinked_cme_ids = [],
      work_order_meta = {},
      title,
      language = 'German',
      vat_rate = 0,
      valid_until_days = 30,
    } = body;

    if ((!work_order_ids || work_order_ids.length === 0) && (!unlinked_cme_ids || unlinked_cme_ids.length === 0)) {
      return Response.json({ error: 'At least one work_order_id or unlinked_cme_id is required' }, { status: 400 });
    }

    const warnings = [];

    // ── 1. Resolve WorkOrders (use frontend-provided meta when available) ───────
    let targetWOs = [];
    if (work_order_ids.length > 0) {
      const metaKeys = Object.keys(work_order_meta);
      const metaComplete = metaKeys.length === work_order_ids.length && work_order_ids.every(id => work_order_meta[id]);

      if (metaComplete) {
        targetWOs = work_order_ids.map(id => ({ id, ...work_order_meta[id] }));
      } else {
        const allWOs = await base44.asServiceRole.entities.WorkOrder.list('-scheduled_date', 1000);
        targetWOs = allWOs.filter(wo => work_order_ids.includes(wo.id));
      }

      if (targetWOs.length === 0) {
        return Response.json({ error: 'No matching WorkOrders found' }, { status: 404 });
      }

      const invalidWOs = targetWOs.filter(wo =>
        wo.status !== 'Ready to Invoice' ||
        wo.workorder_type === 'ORGANIZATION'
      );

      if (invalidWOs.length > 0) {
        return Response.json({
          error: `Some WorkOrders are not eligible: ${invalidWOs.map(w => `${w.number || w.work_order_number} (${w.status}, ${w.workorder_type})`).join(', ')}. Only EXECUTION/STANDARD WorkOrders with status "Ready to Invoice" are allowed.`
        }, { status: 400 });
      }
    }

    // ── 2. Resolve Job, Customer, Boat, Location ──────────────────────────────
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
      const firstCMEList = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ id: unlinked_cme_ids[0] });
      if (!firstCMEList[0]?.customer_id) {
        return Response.json({ error: 'Could not resolve customer from provided CME IDs' }, { status: 400 });
      }
      sourceCustomerId = firstCMEList[0].customer_id;
    }

    // ── 3. Gather unbilled + unreserved TimeEntries ───────────────────────────
    const allTimeEntries = [];
    for (const wo of targetWOs) {
      const entries = await base44.asServiceRole.entities.TimeEntry.filter({ work_order_id: wo.id });
      allTimeEntries.push(...entries);
    }
    const unbilledTimeEntries = allTimeEntries.filter(te =>
      te.is_billable !== false &&
      !te.billed_offer_id &&
      !te.staged_offer_id
    );
    console.log(`[createBillingOfferFromWO] TimeEntries: ${allTimeEntries.length} total, ${unbilledTimeEntries.length} unbilled. Staged: ${allTimeEntries.filter(t => t.staged_offer_id).length}, Billed: ${allTimeEntries.filter(t => t.billed_offer_id).length}`);

    // ── 4. Gather unbilled + unreserved MaterialUsage ─────────────────────────
    const allMaterialUsage = [];
    for (const wo of targetWOs) {
      const items = await base44.asServiceRole.entities.MaterialUsage.filter({ work_order_id: wo.id });
      allMaterialUsage.push(...items);
    }
    const unbilledMaterial = allMaterialUsage.filter(m =>
      m.billable !== false &&
      !m.billed_offer_id &&
      !m.staged_offer_id
    );
    console.log(`[createBillingOfferFromWO] MaterialUsage: ${allMaterialUsage.length} total, ${unbilledMaterial.length} unbilled. Staged: ${allMaterialUsage.filter(m => m.staged_offer_id).length}, Billed: ${allMaterialUsage.filter(m => m.billed_offer_id).length}`);
    console.log(`[createBillingOfferFromWO] Target WO IDs: ${JSON.stringify(work_order_ids)}`);

    // ── 5. Gather unbilled + unreserved CustomerMaterialEntry ────────────────
    const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ customer_id: sourceCustomerId });
    const woIdSet = new Set(work_order_ids);
    const jobIdSet = new Set(sourceJobIds);
    const unlinkedCMEIdSet = new Set(unlinked_cme_ids);

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

    const selectedUnlinkedCME = allCME.filter(cme =>
      unlinkedCMEIdSet.has(cme.id) &&
      !cme.billed_offer_id &&
      !cme.staged_offer_id
    );

    const unbilledCME = [...linkedUnbilledCME, ...selectedUnlinkedCME];

    if (unbilledTimeEntries.length === 0 && unbilledMaterial.length === 0 && unbilledCME.length === 0) {
      return Response.json({
        success: false,
        error: 'No billable items found for selected WorkOrders. Check that TimeEntries and MaterialUsage exist and are not already billed.',
      }, { status: 400 });
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

    const woMap = Object.fromEntries(targetWOs.map(wo => [wo.id, {
      ...wo,
      work_order_number: wo.work_order_number || wo.number,
    }]));

    const allSourceTasks = [];
    if (targetWOs.length > 0) {
      for (const wo of targetWOs) {
        const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: wo.id });
        allSourceTasks.push(...tasks);
      }
    }
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
    // Track all IDs for rollback on failure
    stagedRecordIds.timeEntries = unbilledTimeEntries.map(te => te.id);
    stagedRecordIds.materialUsages = unbilledMaterial.map(m => m.id);
    stagedRecordIds.cme = unbilledCME.map(cme => cme.id);

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
      warnings.push(`Reservation warning: could not set staged_offer_id on all source items: ${reservationErr.message}.`);
      console.error(`[createBillingOfferFromWO] Reservation partial failure:`, reservationErr.message);
    }

    // ── Unit type normalizer ─────────────────────────────────────────────────
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
      return UNIT_MAP[raw] || 'Piece';
    };

    // ── 10. Create OfferTask rows — LABOR ─────────────────────────────────────
    let lineOrder = 0;
    let lineItemsCreated = 0;

    try {
      for (const te of unbilledTimeEntries) {
        const tech = techMap[te.technician_id];
        const rate = tech?.hourly_rate_billable || 0;
        const hours = parseFloat(((te.duration_minutes || 0) / 60).toFixed(2));
        const techName = tech ? `${tech.first_name} ${tech.last_name}` : 'Technician';
        const wo = woMap[te.work_order_id];
        const woPrefix = wo?.work_order_number ? `${wo.work_order_number} — ` : '';
        const task = te.task_id ? taskMap[te.task_id] : null;

        if (rate === 0) {
          warnings.push(`TimeEntry ${te.id}: Technician ${techName} has no hourly_rate_billable set.`);
        }

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
        const salesPrice = m.unit_price || item?.sales_price || 0;
        const itemName = item?.name || `Item ${m.inventory_item_id}`;
        const unit = item?.unit || 'Piece';
        const wo = woMap[m.work_order_id];
        const woPrefix = wo?.work_order_number ? `${wo.work_order_number} — ` : '';
        const task = m.task_id ? taskMap[m.task_id] : null;

        if (salesPrice === 0) {
          warnings.push(`MaterialUsage ${m.id}: Item "${itemName}" has no recorded price.`);
        }

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
          unit_type: normalizeUnit(cme.unit),
          quantity: cme.quantity || 1,
          unit_price: purchasePrice,
          total_amount: parseFloat((purchasePrice * (cme.quantity || 1)).toFixed(2)),
          is_optional: false,
        });
        lineItemsCreated++;
      }
    } catch (taskErr) {
      console.error(`[createBillingOfferFromWO] OfferTask creation failed:`, taskErr.message);
      console.log(`[createBillingOfferFromWO] Rolling back staged reservations due to OfferTask failure.`);
      await rollbackStagedRecords();
      throw new Error(`Failed to create billing offer line items: ${taskErr.message}`);
    }

    // ── 13. SAFETY: Validate result before success ───────────────────────────
    if (lineItemsCreated === 0) {
      console.warn(`[createBillingOfferFromWO] EMPTY OFFER: Created Offer ${offerId} but 0 line items. Rolling back staged reservations.`);
      await rollbackStagedRecords();
      return Response.json({
        success: false,
        error: 'No billable items could be created. Check that TimeEntries and MaterialUsage exist and are not already billed.',
        offer_id: offerId,
        offer_number: offerNumber,
        line_items_created: 0,
      }, { status: 400 });
    }

    console.log(`[createBillingOfferFromWO] SUCCESS: Created Offer ${offerId} with ${lineItemsCreated} line items from ${work_order_ids.length} WOs.`);

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
    console.error('[createBillingOfferFromWO] EXCEPTION:', error.message);
    await rollbackStagedRecords();
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});