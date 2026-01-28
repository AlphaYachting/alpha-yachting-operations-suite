import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { leadId, customerData, boatData } = await req.json();

    if (!leadId) {
      return Response.json({ error: 'leadId required' }, { status: 400 });
    }

    // Fetch the lead
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    if (leads.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leads[0];

    // Create customer
    const customer = await base44.asServiceRole.entities.Customer.create({
      first_name: customerData?.first_name || lead.name.split(' ')[0],
      last_name: customerData?.last_name || lead.name.split(' ').slice(1).join(' ') || 'Lead',
      email: customerData?.email || lead.email,
      phone: customerData?.phone || lead.phone,
      customer_type: customerData?.customer_type || 'Private',
      preferred_language: customerData?.preferred_language || 'German',
      status: 'Active'
    });

    // Create boat if boat_name provided
    let boatId = null;
    if (lead.boat_name || boatData?.vessel_name) {
      const boat = await base44.asServiceRole.entities.Boat.create({
        customer_id: customer.id,
        vessel_name: boatData?.vessel_name || lead.boat_name,
        vessel_type: boatData?.vessel_type || 'Sailboat',
        current_location_id: lead.location_id || boatData?.location_id,
        known_issues: lead.notes,
        status: 'Active'
      });
      boatId = boat.id;
    }

    // Update lead as converted
    await base44.asServiceRole.entities.Lead.update(leadId, {
      status: 'Converted',
      converted_customer_id: customer.id,
      converted_boat_id: boatId,
      converted_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      customerId: customer.id,
      boatId,
      message: `Lead converted: ${customer.first_name} ${customer.last_name}`
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});