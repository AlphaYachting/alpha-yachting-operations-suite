import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const { data: lead } = payload;

  // Only proceed if status is exactly "Ready to Offer"
  if (lead?.status !== 'Ready to Offer') {
    return Response.json({ skipped: true, reason: 'status_not_ready_to_offer' });
  }

  // Old status must not already have been "Ready to Offer" (prevent re-trigger on unrelated updates)
  const oldStatus = payload?.old_data?.status;
  if (oldStatus === 'Ready to Offer') {
    return Response.json({ skipped: true, reason: 'already_was_ready_to_offer' });
  }

  // IDEMPOTENCY CHECK — if offer already exists, skip (do not change status)
  if (lead.created_offer_ids && lead.created_offer_ids.length > 0) {
    return Response.json({ skipped: true, reason: 'offer_already_exists' });
  }

  // VALIDATION
  if (!lead.name || (!lead.phone && !lead.email)) {
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      status: 'Needs Clarification',
      auto_offer_error: 'Fehlende Kontaktdaten: Name und Telefon/E-Mail erforderlich'
    });
    return Response.json({ skipped: true, reason: 'validation_failed' });
  }

  // STEP 3 — Find or create Customer
  // IMPORTANT: Only trust customer_id if this lead was already previously converted
  // (converted_customer_id is set). A raw customer_id on a new lead may be stale/incorrect.
  let customerId = lead.converted_customer_id || null;

  if (!customerId) {
    // Try to find by email first, then phone
    let existingCustomers = [];
    if (lead.email) {
      existingCustomers = await base44.asServiceRole.entities.Customer.filter({ email: lead.email });
    }
    if (existingCustomers.length === 0 && lead.phone) {
      existingCustomers = await base44.asServiceRole.entities.Customer.filter({ phone: lead.phone });
    }

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      await base44.asServiceRole.entities.Lead.update(lead.id, { customer_id: customerId });
    } else {
      // Create new Customer from lead data
      const nameParts = (lead.name || '').trim().split(' ');
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      const newCustomer = await base44.asServiceRole.entities.Customer.create({
        first_name: firstName,
        last_name: lastName || firstName,
        email: lead.email || '',
        phone: lead.phone || '',
        notes: 'Auto-created from Lead'
      });
      customerId = newCustomer.id;

      await base44.asServiceRole.entities.Lead.update(lead.id, {
        customer_id: customerId,
        converted_customer_id: customerId,
        converted_at: new Date().toISOString()
      });
    }
  }

  // STEP 4 — Find or create Boat (optional, only if boat_name present)
  let boatId = lead.converted_boat_id || null;

  if (!boatId && lead.boat_name) {
    // Check if boat already exists for this customer
    const existingBoats = await base44.asServiceRole.entities.Boat.filter({ customer_id: customerId });
    const matchingBoat = existingBoats.find(
      b => b.vessel_name?.toLowerCase() === lead.boat_name?.toLowerCase()
    );

    if (matchingBoat) {
      boatId = matchingBoat.id;
    } else {
      const newBoat = await base44.asServiceRole.entities.Boat.create({
        customer_id: customerId,
        vessel_name: lead.boat_name,
        known_issues: lead.boat_details || ''
      });
      boatId = newBoat.id;
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        converted_boat_id: boatId
      });
    }
  }

  // STEP 5 — Create Offer
  const currentYear = new Date().getFullYear();
  const allOffers = await base44.asServiceRole.entities.Offer.list('-created_date', 5000);
  const existingNumbers = allOffers
    .map(o => o.offer_number)
    .filter(num => num && num.startsWith(`OFF-${currentYear}-`))
    .map(num => parseInt(num.split('-')[2]) || 0);
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const offerNumber = `OFF-${currentYear}-${String(maxNumber + 1).padStart(4, '0')}`;

  const offerData = {
    offer_number: offerNumber,
    lead_id: lead.id,
    customer_id: customerId,
    title: `Angebot — ${lead.boat_name || lead.name}`,
    description: lead.description || lead.notes || '',
    status: 'Draft'
  };
  if (boatId) offerData.boat_id = boatId;
  // Inherit assigned user from Lead so the offer shows the correct responsible person
  if (lead.assigned_to_user_id) offerData.assigned_to_user_id = lead.assigned_to_user_id;

  const newOffer = await base44.asServiceRole.entities.Offer.create(offerData);

  // STEP 6 — Finalize Lead (stay at "Ready to Offer" — status moves to "Offered" only when Offer is set to "Sent")
  const existingOfferIds = lead.created_offer_ids || [];
  await base44.asServiceRole.entities.Lead.update(lead.id, {
    auto_offer_error: null,
    created_offer_ids: [...existingOfferIds, newOffer.id]
  });

  return Response.json({
    success: true,
    offer_id: newOffer.id,
    offer_number: newOffer.offer_number,
    customer_id: customerId,
    boat_id: boatId,
    lead_id: lead.id
  });
});