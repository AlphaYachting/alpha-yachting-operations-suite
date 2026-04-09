import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const { data: offer, old_data: oldOffer } = payload;

  // Only proceed if new status is Rejected or Expired
  const negativeStatuses = ['Rejected', 'Expired'];
  if (!negativeStatuses.includes(offer?.status)) {
    return Response.json({ skipped: true, reason: 'status_not_negative' });
  }

  // Idempotency: skip if it already was in this state
  if (negativeStatuses.includes(oldOffer?.status)) {
    return Response.json({ skipped: true, reason: 'already_was_negative' });
  }

  // Must have a lead_id
  if (!offer?.lead_id) {
    return Response.json({ skipped: true, reason: 'no_lead_id' });
  }

  // Fetch the lead
  const leads = await base44.asServiceRole.entities.Lead.filter({ id: offer.lead_id });
  if (!leads || leads.length === 0) {
    return Response.json({ skipped: true, reason: 'lead_not_found' });
  }

  const lead = leads[0];

  // Don't override a positive terminal state
  if (lead.status === 'Ordered / Confirmed') {
    return Response.json({ skipped: true, reason: 'lead_already_confirmed' });
  }

  // If lead has multiple offers, check if any other offer is still active
  if (lead.created_offer_ids && lead.created_offer_ids.length > 1) {
    const otherOfferIds = lead.created_offer_ids.filter(id => id !== offer.id);
    const activeStatuses = ['Draft', 'Sent', 'Approved'];

    for (const otherId of otherOfferIds) {
      const others = await base44.asServiceRole.entities.Offer.filter({ id: otherId });
      if (others.length > 0 && activeStatuses.includes(others[0].status)) {
        return Response.json({ skipped: true, reason: 'other_active_offer_exists', offer_id: otherId });
      }
    }
  }

  // Set Lead to Rejected
  await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'Rejected' });

  return Response.json({
    success: true,
    lead_id: lead.id,
    lead_name: lead.name,
    offer_id: offer.id,
    offer_status: offer.status
  });
});