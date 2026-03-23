import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { validationType, payload } = await req.json();

    if (!validationType) {
      return Response.json({ error: 'validationType required' }, { status: 400 });
    }

    // EMAIL UNIQUENESS
    if (validationType === 'email_unique') {
      const { email } = payload;
      if (!email) return Response.json({ valid: false, message: 'Email required' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.Customer.filter({ email });
      return Response.json({
        valid: existing.length === 0,
        message: existing.length > 0 ? 'Email already registered' : ''
      });
    }

    // LEAD UNIQUENESS (name+phone within 30 days)
    if (validationType === 'lead_unique') {
      const { name, phone } = payload;
      if (!name || !phone) return Response.json({ valid: false });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recent = await base44.asServiceRole.entities.Lead.filter({ name, phone });
      const recentLeads = recent.filter(l => l.created_date > thirtyDaysAgo);

      return Response.json({
        valid: recentLeads.length === 0,
        message: recentLeads.length > 0 ? 'Similar lead created recently' : ''
      });
    }

    // BOAT OWNERSHIP (boat.customer_id === customer.id)
    if (validationType === 'boat_ownership') {
      const { boatId, customerId } = payload;
      const boats = await base44.asServiceRole.entities.Boat.filter({ id: boatId });
      
      if (boats.length === 0) {
        return Response.json({ valid: false, message: 'Boat not found' });
      }

      const boat = boats[0];
      const isOwner = boat.customer_id === customerId;

      return Response.json({
        valid: isOwner,
        message: isOwner ? '' : 'Boat does not belong to this customer'
      });
    }

    // TECHNICIAN EXISTS
    if (validationType === 'technician_exists') {
      const { technicianIds } = payload;
      if (!Array.isArray(technicianIds)) {
        return Response.json({ valid: false, message: 'Invalid technician list' });
      }

      const techs = await base44.asServiceRole.entities.Technician.filter({ id: { $in: technicianIds } });
      const valid = techs.length === technicianIds.length;

      return Response.json({
        valid,
        message: valid ? '' : 'One or more technicians not found'
      });
    }

    // DATE NOT IN PAST
    if (validationType === 'date_not_past') {
      const { date } = payload;
      if (!date) return Response.json({ valid: true }); // Optional date

      const schedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      schedDate.setHours(0, 0, 0, 0);

      const valid = schedDate >= today;

      return Response.json({
        valid,
        message: valid ? '' : 'Date cannot be in the past'
      });
    }

    // LOCATION EXISTS
    if (validationType === 'location_exists') {
      const { locationId } = payload;
      if (!locationId) return Response.json({ valid: true }); // Optional

      const locs = await base44.asServiceRole.entities.Location.filter({ id: locationId });
      const valid = locs.length > 0;

      return Response.json({
        valid,
        message: valid ? '' : 'Location not found'
      });
    }

    return Response.json({ error: 'Unknown validation type' }, { status: 400 });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});