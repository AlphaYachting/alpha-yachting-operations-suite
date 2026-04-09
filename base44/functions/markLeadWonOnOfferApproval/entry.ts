import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const { data: offer, old_data: oldOffer } = payload;

  // 1. Only proceed if new status is Approved
  if (offer?.status !== 'Approved') {
    return Response.json({ skipped: true, reason: 'status_not_approved' });
  }

  // 2. Idempotency: if already was Approved, do nothing
  if (oldOffer?.status === 'Approved') {
    return Response.json({ skipped: true, reason: 'already_was_approved' });
  }

  // 3. Must have a lead_id
  if (!offer?.lead_id) {
    return Response.json({ skipped: true, reason: 'no_lead_id' });
  }

  // 4. Fetch the lead
  let leads;
  try {
    leads = await base44.asServiceRole.entities.Lead.filter({ id: offer.lead_id });
  } catch (_) {
    return Response.json({ skipped: true, reason: 'lead_fetch_error', lead_id: offer.lead_id });
  }
  if (!leads || leads.length === 0) {
    return Response.json({ skipped: true, reason: 'lead_not_found', lead_id: offer.lead_id });
  }

  const lead = leads[0];

  // 5. Already Ordered / Confirmed → skip
  if (lead.status === 'Ordered / Confirmed') {
    return Response.json({ skipped: true, reason: 'lead_already_won', lead_id: lead.id });
  }

  // 6. Update Lead to Ordered / Confirmed
  await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'Ordered / Confirmed' });

  return Response.json({
    success: true,
    lead_id: lead.id,
    lead_name: lead.name,
    offer_id: offer.id,
    offer_number: offer.offer_number || null,
  });
});