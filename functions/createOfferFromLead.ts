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
      return Response.json({ error: 'lead_id required' }, { status: 400 });
    }

    // Fetch lead with tasks
    const [leads, leadTasks] = await Promise.all([
      base44.entities.Lead.filter({ id: lead_id }),
      base44.entities.LeadTask.filter({ lead_id })
    ]);

    if (leads.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leads[0];
    let customerId = lead.converted_customer_id;
    let boatId = lead.converted_boat_id;

    // If not converted yet, create customer and boat
    if (!customerId) {
      const nameParts = lead.name.split(' ');
      const customer = await base44.asServiceRole.entities.Customer.create({
        first_name: nameParts[0] || lead.name,
        last_name: nameParts.slice(1).join(' ') || 'Lead',
        email: lead.email,
        phone: lead.phone,
        customer_type: 'Private',
        preferred_language: 'German',
        status: 'Active'
      });
      customerId = customer.id;

      // Create boat if boat_name exists
      if (lead.boat_name) {
        const boat = await base44.asServiceRole.entities.Boat.create({
          customer_id: customerId,
          vessel_name: lead.boat_name,
          vessel_type: 'Sailboat',
          current_location_id: lead.location_id,
          known_issues: lead.notes,
          status: 'Active'
        });
        boatId = boat.id;
      }

      // Update lead as converted
      await base44.asServiceRole.entities.Lead.update(lead_id, {
        status: 'Converted',
        converted_customer_id: customerId,
        converted_boat_id: boatId,
        converted_at: new Date().toISOString()
      });
    }

    // Generate offer number
    const existingOffers = await base44.entities.Offer.list();
    const offerNumber = `OFF-${String(existingOffers.length + 1).padStart(4, '0')}`;

    // Create offer
    const offer = await base44.asServiceRole.entities.Offer.create({
      offer_number: offerNumber,
      title: lead.boat_name ? `Service for ${lead.boat_name}` : `Service Offer - ${lead.name}`,
      description: lead.description || lead.notes || '',
      customer_id: customerId,
      boat_id: boatId,
      location_id: lead.location_id,
      status: 'Draft',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      currency: 'EUR',
      language: 'German'
    });

    // Convert lead tasks to offer tasks
    if (leadTasks.length > 0) {
      const offerTasks = leadTasks.map((task, index) => ({
        offer_id: offer.id,
        title: task.title,
        description: task.description || '',
        estimated_hours: 1,
        hourly_rate: 80,
        sequence_order: index + 1,
        is_optional: false
      }));

      await base44.asServiceRole.entities.OfferTask.bulkCreate(offerTasks);
    }

    return Response.json({
      success: true,
      offer_id: offer.id,
      offer_number: offerNumber,
      customer_id: customerId,
      boat_id: boatId,
      tasks_converted: leadTasks.length
    });

  } catch (error) {
    console.error('Error creating offer from lead:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});