import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id } = await req.json();

    if (!lead_id) {
      return Response.json({ error: 'lead_id is required' }, { status: 400 });
    }

    // Fetch lead data
    const [lead] = await base44.entities.Lead.filter({ id: lead_id });

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Prepare offer data from lead
    const offerData = {
      lead_id: lead.id,
      customer_id: lead.customer_id || null,
      boat_id: lead.converted_boat_id || null,
      title: `Offer for ${lead.name}${lead.boat_name ? ' - ' + lead.boat_name : ''}`,
      description: lead.description || lead.notes || '',
      status: 'Draft',
      customer_notes: lead.inquiry_type ? `Inquiry Type: ${lead.inquiry_type}` : ''
    };

    // Create the offer
    const newOffer = await base44.asServiceRole.entities.Offer.create(offerData);

    // Update lead with reference to created offer
    const existingOfferIds = lead.created_offer_ids || [];
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      created_offer_ids: [...existingOfferIds, newOffer.id]
    });

    return Response.json({
      success: true,
      offer_id: newOffer.id,
      offer_number: newOffer.offer_number
    });

  } catch (error) {
    console.error('Error creating offer from lead:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});