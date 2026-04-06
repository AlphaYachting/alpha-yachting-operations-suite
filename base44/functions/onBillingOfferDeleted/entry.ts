/**
 * onBillingOfferDeleted
 * 
 * Triggered when a READY_TO_INVOICE_REVIEW Offer is deleted.
 * Resets WorkOrders back to "Ready to Invoice" and clears staged_offer_id
 * on all related TimeEntries, MaterialUsages, and CustomerMaterialEntries.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    // Only process deletes of READY_TO_INVOICE_REVIEW offers
    const offer = old_data || data;
    if (!offer || offer.source_type !== 'READY_TO_INVOICE_REVIEW') {
      return Response.json({ success: true, message: 'Not a billing offer, skipping.' });
    }

    const offerId = event?.entity_id || offer.id;
    const woIds = offer.source_work_order_ids || [];

    console.log(`[onBillingOfferDeleted] Offer ${offer.offer_number} deleted. Resetting ${woIds.length} WOs.`);

    const results = { wos_reset: 0, te_cleared: 0, mu_cleared: 0, cme_cleared: 0, errors: [] };

    // 1. Reset WorkOrders back to "Ready to Invoice"
    for (const woId of woIds) {
      try {
        await base44.asServiceRole.entities.WorkOrder.update(woId, { status: 'Ready to Invoice' });
        results.wos_reset++;
      } catch (e) {
        results.errors.push(`WO ${woId}: ${e.message}`);
      }
    }

    // 2. Clear staged_offer_id on TimeEntries
    const allTE = await base44.asServiceRole.entities.TimeEntry.list('-created_date', 2000);
    const stagedTE = allTE.filter(te => te.staged_offer_id === offerId);
    for (const te of stagedTE) {
      try {
        await base44.asServiceRole.entities.TimeEntry.update(te.id, { staged_offer_id: null });
        results.te_cleared++;
      } catch (e) {
        results.errors.push(`TE ${te.id}: ${e.message}`);
      }
    }

    // 3. Clear staged_offer_id on MaterialUsages
    const allMU = await base44.asServiceRole.entities.MaterialUsage.list('-created_date', 1000);
    const stagedMU = allMU.filter(m => m.staged_offer_id === offerId);
    for (const m of stagedMU) {
      try {
        await base44.asServiceRole.entities.MaterialUsage.update(m.id, { staged_offer_id: null });
        results.mu_cleared++;
      } catch (e) {
        results.errors.push(`MU ${m.id}: ${e.message}`);
      }
    }

    // 4. Clear staged_offer_id on CustomerMaterialEntries
    const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.list('-created_date', 2000);
    const stagedCME = allCME.filter(c => c.staged_offer_id === offerId);
    for (const c of stagedCME) {
      try {
        await base44.asServiceRole.entities.CustomerMaterialEntry.update(c.id, { staged_offer_id: null });
        results.cme_cleared++;
      } catch (e) {
        results.errors.push(`CME ${c.id}: ${e.message}`);
      }
    }

    console.log(`[onBillingOfferDeleted] Done:`, JSON.stringify(results));
    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('[onBillingOfferDeleted] ERROR:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});