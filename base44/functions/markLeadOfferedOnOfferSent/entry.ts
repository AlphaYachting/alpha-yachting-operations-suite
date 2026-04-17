import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const { data: offer, old_data: oldOffer } = payload;

  // Only proceed if new status is "Sent"
  if (offer?.status !== 'Sent') {
    return Response.json({ skipped: true, reason: 'status_not_sent' });
  }

  // Idempotency: if already was Sent, do nothing
  if (oldOffer?.status === 'Sent') {
    return Response.json({ skipped: true, reason: 'already_was_sent' });
  }

  // Must have a lead_id
  if (!offer?.lead_id) {
    return Response.json({ skipped: true, reason: 'no_lead_id' });
  }

  // Fetch the lead
  let lead;
  try {
    lead = await base44.asServiceRole.entities.Lead.get(offer.lead_id);
  } catch (_) {
    return Response.json({ skipped: true, reason: 'lead_fetch_error' });
  }
  if (!lead) {
    return Response.json({ skipped: true, reason: 'lead_not_found' });
  }

  // Only update if lead is still in "Ready to Offer" (don't override terminal statuses)
  if (!['New Incoming', 'Needs Clarification', 'Ready to Offer'].includes(lead.status)) {
    return Response.json({ skipped: true, reason: 'lead_status_already_advanced', current_status: lead.status });
  }

  await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'Offered' });

  return Response.json({
    success: true,
    lead_id: lead.id,
    lead_name: lead.name,
    offer_id: offer.id,
  });
});