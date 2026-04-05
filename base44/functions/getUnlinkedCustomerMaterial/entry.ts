/**
 * getUnlinkedCustomerMaterial
 *
 * Returns CustomerMaterialEntry records for a given customer that are:
 * - not yet billed (no billed_offer_id)
 * - not yet reserved/staged (no staged_offer_id)
 * - not linked to any WorkOrder or Job (work_order_id is null, job_id is null)
 *
 * These are customer-ordered materials that exist in the system but cannot be
 * automatically matched to a specific WorkOrder for billing. The Billing Review UI
 * must surface these so the reviewer can manually assign them to the correct
 * billing package before export.
 *
 * Do NOT auto-assign these. They must be reviewed and linked manually.
 *
 * Input: { customer_id: string }
 * Output: { success, records: CustomerMaterialEntry[], count: number }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_id } = body;

    if (!customer_id) {
      return Response.json({ error: 'customer_id is required' }, { status: 400 });
    }

    const allCME = await base44.asServiceRole.entities.CustomerMaterialEntry.filter({ customer_id });

    const unlinked = allCME.filter(cme =>
      !cme.billed_offer_id &&
      !cme.staged_offer_id &&
      !cme.work_order_id &&
      !cme.job_id
    );

    return Response.json({
      success: true,
      records: unlinked,
      count: unlinked.length,
    });

  } catch (error) {
    console.error('[getUnlinkedCustomerMaterial] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});