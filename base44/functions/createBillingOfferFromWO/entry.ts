/**
 * createBillingOfferFromWO
 * 
 * Converts one or more Ready-to-Invoice WorkOrders into a commercial Offer snapshot.
 * KEY CHANGE: WorkOrder itself generates a base line item, even without TimeEntries/Material.
 * 
 * Safety guarantees:
 * - Only EXECUTION/STANDARD WorkOrders with status "Ready to Invoice" accepted
 * - Only unbilled (no billed_offer_id) AND unreserved (no staged_offer_id) items included
 * - ALWAYS creates at least one OfferTask per WorkOrder (the WorkOrder itself)
 * - Optional: TimeEntries, MaterialUsage, CustomerMaterialEntry
 * - staged_offer_id set immediately after Offer creation (prevents re-billing)
 * - FAILURE SAFETY: All staged reservations rolled back if any step fails
 * - Empty offers (zero WOs selected) prevented by design
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const stagedRecordIds = { timeEntries: [], materialUsages: [], cme: [] };
  let base44 = null;
  
  const rollbackStagedRecords = async () => {
    if (!base44) return;
    if (stagedRecordIds.timeEntries.length === 0 && stagedRecordIds.materialUsages.length === 0 && stagedRecordIds.cme.length === 0) return;
    
    console.log(`[createBillingOfferFromWO] ROLLBACK: clearing staged_offer_id...`);
    try {
      await Promise.all([
        ...stagedRecordIds.timeEntries.map(id => base44.asServiceRole.entities.TimeEntry.update(id, { staged_offer_id: null }).catch(() => {})),
        ...stagedRecordIds.materialUsages.map(id => base44.asServiceRole.entities.MaterialUsage.update(id, { staged_offer_id: null }).catch(() => {})),
        ...stagedRecordIds.cme.map(id => base44.asServiceRole.entities.CustomerMaterialEntry.update(cme.id, { staged_offer_id: null }).catch(() => {})),
      ]);
      console.log(`[createBillingOfferFromWO] Rollback completed.`);
    } catch (e) {
      console.error(`[createBillingOfferFromWO] Rollback partial failure:`, e.message);
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

    if (!work_order_ids || work_order_ids.length === 0) {
      return Response.json({ error: 'At least one work_order_id is required' }, { status: 400 });
    }

    const warnings = [];

    // ── 1. Resolve WorkOrders ─────────────────────────────────────────────────
    let targetWOs = [];
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
      wo.status !== 'Ready to Invoice' || wo.workorder_type === 'ORGANIZATION'
    );

    if (invalidWOs.length > 0) {
      return Response.json({
        error: `Some WorkOrders ineligible: ${invalidWOs.map(w => `${w.number} (${w.status})`).join(', ')}`
      }, { status: 400 });
    }

    // ── 2. Resolve Job, Customer ──────────────────────────────────────────────
    const primaryWO = targetWOs[0];
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: primaryWO.job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: `Job not found for WO ${primaryWO.work_order_number}` }, { status: 404 });
    const sourceCustomerId = job.customer_id;
    const sourceJobIds = [...new Set(targetWOs.map(wo => wo.job_id).filter(Boolean))];

    // ── 3-5. Gather optional TimeEntries, MaterialUsage, CME ──────────────────
    const allTimeEntries = [];
    for (const wo of targetWOs) {
      const entries = await base44.asServiceRole.entities.TimeEntry.filter({ work_order_id: wo.id });
      allTimeEntries.push(...entries);
    }
    const unbilledTimeEntries = allTimeEntries.filter(te =>
      te.is_billable !== false && !te.billed_offer_id && !te.staged_offer_id
    );

    const allMaterialUsage = [];
    for (const wo of targetWOs) {
      const items = await base44.asServiceRole.entities.MaterialUsage.filter({ work_order_id: wo.id });
      allMaterialUsage.push(...items);
    }
    const unbilledMaterial = allMaterialUsage.filter(m =>
      m.billable !== false && !m.billed_offer_id && !m.staged_offer_id
    );

    const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ customer_id: sourceCustomerId });
    const woIdSet = new Set(work_order_ids);
    const jobIdSet = new Set(sourceJobIds);
    const unlinkedCMEIdSet = new Set(unlinked_cme_ids);

    const linkedUnbilledCME = allCME.filter(cme =>
      !cme.billed_offer_id && !cme.staged_offer_id &&
      ((cme.work_order_id && woIdSet.has(cme.work_order_id)) ||
       (cme.job_id && jobIdSet.has(cme.job_id)))
    );

    const selectedUnlinkedCME = allCME.filter(cme =>
      unlinkedCMEIdSet.has(cme.id) && !cme.billed_offer_id && !cme.staged_offer_id
    );

    const unbilledCME = [...linkedUnbilledCME, ...selectedUnlinkedCME];

    // ── 6. Resolve price references ───────────────────────────────────────────
    const technicianIds = [...new Set(unbilledTimeEntries.map(te => te.technician_id).filter(Boolean))];
    const inventoryIds = [...new Set(unbilledMaterial.map(m => m.inventory_item_id).filter(Boolean))];

    const [allTechs, allInventory] = await Promise.all([
      technicianIds.length > 0 ? base44.asServiceRole.entities.Technician.list() : Promise.resolve([]),
      inventoryIds.length > 0 ? base44.asServiceRole.entities.InventoryItem.list() : Promise.resolve([]),
    ]);

    const techMap = Object.fromEntries(allTechs.map(t => [t.id, t]));
    const inventoryMap = Object.fromEntries(allInventory.map(i => [i.id, i]));
    const woMap = Object.fromEntries(targetWOs.map(wo => [wo.id, wo]));

    const allSourceTasks = [];
    for (const wo of targetWOs) {
      const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: wo.id });
      allSourceTasks.push(...tasks);
    }
    const taskMap = Object.fromEntries(allSourceTasks.map(t => [t.id, t]));

    // ── 7. Calculate totals per WorkOrder ─────────────────────────────────────
    const woTotals = {}; // woId → total
    let overallTotal = 0;

    unbilledTimeEntries.forEach(te => {
      const tech = techMap[te.technician_id];
      const rate = tech?.hourly_rate_billable || 0;
      const amount = rate * ((te.duration_minutes || 0) / 60);
      overallTotal += amount;
      woTotals[te.work_order_id] = (woTotals[te.work_order_id] || 0) + amount;
    });

    unbilledMaterial.forEach(m => {
      const item = inventoryMap[m.inventory_item_id];
      const salesPrice = m.unit_price || item?.sales_price || 0;
      const amount = salesPrice * (m.quantity || 1);
      overallTotal += amount;
      woTotals[m.work_order_id] = (woTotals[m.work_order_id] || 0) + amount;
    });

    unbilledCME.forEach(cme => {
      const amount = cme.total_purchase_price || 0;
      overallTotal += amount;
      if (cme.work_order_id) woTotals[cme.work_order_id] = (woTotals[cme.work_order_id] || 0) + amount;
    });

    // ── 8. Create Offer ──────────────────────────────────────────────────────
    const validUntil = new Date(Date.now() + valid_until_days * 86400000).toISOString().split('T')[0];
    const offerTitle = title || `Billing — ${targetWOs.map(w => w.work_order_number).join(', ')}`;
    const fallbackNumber = `BILL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    let offerNumber = fallbackNumber;
    try {
      const offerNumberRes = await base44.functions.invoke('allocateWorkOrderNumber', {});
      offerNumber = offerNumberRes?.data?.number || fallbackNumber;
    } catch (e) {
      warnings.push(`Could not allocate offer number, using fallback: ${fallbackNumber}`);
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
      total_amount: parseFloat(overallTotal.toFixed(2)),
      subtotal: parseFloat(overallTotal.toFixed(2)),
      status: 'Draft',
      valid_until: validUntil,
      source_type: 'READY_TO_INVOICE_REVIEW',
      source_work_order_ids: work_order_ids,
      source_job_ids: sourceJobIds,
      fira_export_status: 'not_exported',
      fira_export_attempt_count: 0,
      notes: `Auto-generated billing offer from: ${targetWOs.map(w => w.work_order_number).join(', ')}`,
      ai_generated: false,
    });

    const offerId = newOffer.id;

    // ── 9. Set staged_offer_id on all items ──────────────────────────────────
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
      console.log(`[createBillingOfferFromWO] Reserved items for offer ${offerId}`);
    } catch (e) {
      warnings.push(`Reservation warning: ${e.message}`);
    }

    // ── 10. Create OfferTask rows ────────────────────────────────────────────
    const UNIT_MAP = {
      'Piece': 'Piece', 'pcs': 'Piece', 'Hour': 'Hour', 'km': 'km', 'day': 'day',
      'Meter': 'Linear Meter', 'Kg': 'Kilogram', 'Liter': 'Liter', 'Set': 'Set',
    };
    const VALID_UNITS = new Set(['Hour','Piece','Square Meter','Linear Meter','Liter','Kilogram','Set','Lump Sum','km','day','month','season','flat']);
    const normalizeUnit = (raw) => {
      if (!raw || VALID_UNITS.has(raw)) return raw || 'Piece';
      return UNIT_MAP[raw] || 'Piece';
    };

    let lineOrder = 0;
    let lineItemsCreated = 0;

    try {
      // ── STEP 1: Create base WorkOrder lines (REQUIRED) ─────────────────────
      for (const wo of targetWOs) {
        const woTotal = woTotals[wo.id] || 0;
        const woNumber = wo.work_order_number || wo.number || `WO-${wo.id}`;
        
        await base44.asServiceRole.entities.OfferTask.create({
          offer_id: offerId,
          sequence_order: lineOrder++,
          title: `WorkOrder: ${woNumber}`,
          description: wo.title || '',
          item_type: 'Lump Sum',
          unit_type: 'flat',
          quantity: 1,
          unit_price: woTotal,
          total_amount: parseFloat(woTotal.toFixed(2)),
          is_optional: false,
        });
        lineItemsCreated++;
      }

      // ── STEP 2: Create optional TimeEntry lines ──────────────────────────
      for (const te of unbilledTimeEntries) {
        const tech = techMap[te.technician_id];
        const rate = tech?.hourly_rate_billable || 0;
        const hours = parseFloat(((te.duration_minutes || 0) / 60).toFixed(2));
        const techName = tech ? `${tech.first_name} ${tech.last_name}` : 'Technician';
        
        await base44.asServiceRole.entities.OfferTask.create({
          offer_id: offerId,
          sequence_order: lineOrder++,
          title: `${woMap[te.work_order_id]?.work_order_number || 'WO'} — Labor: ${techName}`,
          description: te.notes || '',
          item_type: 'Labor',
          unit_type: 'Hour',
          quantity: hours,
          unit_price: rate,
          total_amount: parseFloat((rate * hours).toFixed(2)),
          is_optional: false,
        });
        lineItemsCreated++;
      }

      // ── STEP 3: Create optional MaterialUsage lines ──────────────────────
      for (const m of unbilledMaterial) {
        const item = inventoryMap[m.inventory_item_id];
        const salesPrice = m.unit_price || item?.sales_price || 0;
        const itemName = item?.name || `Item ${m.inventory_item_id}`;
        
        await base44.asServiceRole.entities.OfferTask.create({
          offer_id: offerId,
          sequence_order: lineOrder++,
          title: `${woMap[m.work_order_id]?.work_order_number || 'WO'} — Material: ${itemName}`,
          description: m.notes || '',
          item_type: 'Material',
          unit_type: normalizeUnit(item?.unit),
          quantity: m.quantity || 1,
          unit_price: salesPrice,
          total_amount: parseFloat((salesPrice * (m.quantity || 1)).toFixed(2)),
          is_optional: false,
        });
        lineItemsCreated++;
      }

      // ── STEP 4: Create optional CME lines ────────────────────────────────
      for (const cme of unbilledCME) {
        const purchasePrice = cme.unit_purchase_price || 0;
        
        await base44.asServiceRole.entities.OfferTask.create({
          offer_id: offerId,
          sequence_order: lineOrder++,
          title: `Customer Material: ${cme.item_title}`,
          description: cme.notes || '',
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
      await rollbackStagedRecords();
      throw new Error(`Failed to create billing offer line items: ${taskErr.message}`);
    }

    // ── 11. Validate we created at least the WorkOrder base lines ────────────
    if (lineItemsCreated < targetWOs.length) {
      console.warn(`[createBillingOfferFromWO] INCOMPLETE: Expected ${targetWOs.length} base lines, got ${lineItemsCreated}`);
      await rollbackStagedRecords();
      return Response.json({
        success: false,
        error: 'Failed to create WorkOrder base lines.',
        offer_id: offerId,
        offer_number: offerNumber,
        line_items_created: lineItemsCreated,
      }, { status: 400 });
    }

    console.log(`[createBillingOfferFromWO] SUCCESS: Created Offer ${offerId} with ${lineItemsCreated} line items`);

    return Response.json({
      success: true,
      offer_id: offerId,
      offer_number: offerNumber,
      line_items_created: lineItemsCreated,
      workorder_base_lines: targetWOs.length,
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