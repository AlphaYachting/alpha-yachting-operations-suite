import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wizardData = await req.json();
    console.log('Wizard adapter invoked for:', wizardData.intent);

    // ============================================================
    // PHASE 1: RESOLVE SOURCE & CUSTOMER
    // ============================================================
    let customer, boat, lead;

    if (wizardData.source === 'lead') {
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: wizardData.sourceId });
      if (leads.length === 0) {
        return Response.json({ error: 'Lead not found' }, { status: 404 });
      }
      lead = leads[0];

      // If intent requires Customer and Lead not yet converted
      if (wizardData.intent !== 'boat_only' && lead.status !== 'Converted') {
        // Call backend function convertLeadToCustomer (if exists) or create directly
        try {
          const convertResult = await base44.asServiceRole.functions.invoke('convertLeadToCustomer', {
            leadId: lead.id,
            customerData: {},
            boatData: {}
          });
          customer = await base44.asServiceRole.entities.Customer.filter({ id: convertResult.customerId });
          customer = customer[0];
          if (convertResult.boatId) {
            const boats_arr = await base44.asServiceRole.entities.Boat.filter({ id: convertResult.boatId });
            boat = boats_arr[0];
          }
        } catch (e) {
          // Fallback: create Customer directly
          console.log('convertLeadToCustomer not available, creating Customer directly');
          const firstName = lead.name.split(' ')[0];
          const lastName = lead.name.split(' ').slice(1).join(' ') || 'Lead';
          customer = await base44.asServiceRole.entities.Customer.create({
            first_name: firstName,
            last_name: lastName,
            email: lead.email,
            phone: lead.phone,
            status: 'Active',
            preferred_language: 'German'
          });

          if (lead.boat_name) {
            boat = await base44.asServiceRole.entities.Boat.create({
              customer_id: customer.id,
              vessel_name: lead.boat_name,
              vessel_type: 'Sailboat',
              current_location_id: lead.location_id || null,
              status: 'Active'
            });
          }

          // Update lead as converted
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            status: 'Converted',
            converted_customer_id: customer.id,
            converted_boat_id: boat?.id || null,
            converted_at: new Date().toISOString()
          });
        }
      } else if (lead.status === 'Converted') {
        const customers = await base44.asServiceRole.entities.Customer.filter({ id: lead.converted_customer_id });
        customer = customers[0];
        if (lead.converted_boat_id) {
          const boats_arr = await base44.asServiceRole.entities.Boat.filter({ id: lead.converted_boat_id });
          boat = boats_arr[0];
        }
      }
    } else if (wizardData.source === 'customer') {
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: wizardData.sourceId });
      if (customers.length === 0) {
        return Response.json({ error: 'Customer not found' }, { status: 404 });
      }
      customer = customers[0];
    } else if (wizardData.source === 'new') {
      // Create new Customer
      const { first_name, last_name, email, phone } = wizardData.sourceData.newContact;
      
      // Validate email unique
      const existing = await base44.asServiceRole.entities.Customer.filter({ email });
      if (existing.length > 0) {
        return Response.json({ error: 'Email already exists' }, { status: 400 });
      }

      customer = await base44.asServiceRole.entities.Customer.create({
        first_name,
        last_name,
        email,
        phone,
        status: 'Active',
        preferred_language: 'German'
      });
    }

    // ============================================================
    // PHASE 2: RESOLVE VESSEL (BOAT)
    // ============================================================
    if (wizardData.intent !== 'boat_only' && !boat) {
      if (wizardData.vessel?.existing) {
        const boats_arr = await base44.asServiceRole.entities.Boat.filter({ id: wizardData.vessel.existing });
        boat = boats_arr[0];
        if (boat.customer_id !== customer.id) {
          return Response.json({ error: 'Boat does not belong to selected customer' }, { status: 400 });
        }
      } else if (wizardData.vessel?.new) {
        boat = await base44.asServiceRole.entities.Boat.create({
          customer_id: customer.id,
          vessel_name: wizardData.vessel.new.vessel_name,
          vessel_type: wizardData.vessel.new.vessel_type || 'Sailboat',
          current_location_id: wizardData.location?.existing || null,
          status: 'Active'
        });
      }
    }

    // Special case: boat_only intent
    if (wizardData.intent === 'boat_only') {
      if (!wizardData.vessel?.new?.vessel_name) {
        return Response.json({ error: 'Boat name required' }, { status: 400 });
      }
      const newBoat = await base44.asServiceRole.entities.Boat.create({
        customer_id: customer.id,
        vessel_name: wizardData.vessel.new.vessel_name,
        vessel_type: wizardData.vessel.new.vessel_type || 'Sailboat',
        current_location_id: wizardData.location?.existing || null,
        status: 'Active'
      });
      return Response.json({
        success: true,
        created: { customer: customer.id, boat: newBoat.id },
        redirectTo: `/BoatDetail?id=${newBoat.id}`
      });
    }

    // ============================================================
    // PHASE 3: RESOLVE LOCATION
    // ============================================================
    let location = null;
    if (wizardData.location?.existing) {
      const locs = await base44.asServiceRole.entities.Location.filter({ id: wizardData.location.existing });
      location = locs[0];
    } else if (wizardData.location?.new) {
      location = await base44.asServiceRole.entities.Location.create({
        name: wizardData.location.new.name,
        location_type: wizardData.location.new.location_type,
        region: wizardData.location.new.region || 'Istria',
        status: 'Active'
      });
    }
    // If 'unknown', location stays null

    // ============================================================
    // PHASE 4: CREATE OFFER
    // ============================================================
    let offer = null;
    if (wizardData.intent.includes('offer')) {
      offer = await base44.asServiceRole.entities.Offer.create({
        customer_id: customer.id,
        boat_id: boat?.id,
        location_id: location?.id,
        lead_id: lead?.id,
        title: wizardData.offer.title,
        description: wizardData.offer.description || '',
        status: 'Draft',
        language: wizardData.offer.language || 'German',
        valid_until: wizardData.offer.validUntil || null,
        payment_terms_type: wizardData.offer.paymentTermsType || 'Full',
        downpayment_percent: wizardData.offer.downpaymentPercent || 0,
        vat_rate: wizardData.offer.vat_rate || 0
      });

      // Add line items
      if (wizardData.offer.lineItems?.length) {
        for (const lineItem of wizardData.offer.lineItems) {
          await base44.asServiceRole.entities.OfferTask.create({
            offer_id: offer.id,
            title: lineItem.title,
            description: lineItem.description || '',
            unit_type: lineItem.unit_type || 'Hour',
            quantity: lineItem.quantity || 1,
            unit_price: lineItem.unit_price || 0,
            is_optional: lineItem.is_optional || false
          });
        }
      }

      // Update lead with created offer reference
      if (lead) {
        const existingIds = lead.created_offer_ids || [];
        await base44.asServiceRole.entities.Lead.update(lead.id, {
          created_offer_ids: [...existingIds, offer.id]
        });
      }
    }

    // ============================================================
    // PHASE 5: CREATE JOB
    // ============================================================
    let job = null;
    if (wizardData.intent.includes('job')) {
      // Validate scheduled_date not in past (if WO creation needed)
      if (wizardData.workOrder?.scheduled_date) {
        const schedDate = new Date(wizardData.workOrder.scheduled_date);
        if (schedDate < new Date()) {
          return Response.json({ error: 'Scheduled date cannot be in the past' }, { status: 400 });
        }
      }

      job = await base44.asServiceRole.entities.Job.create({
        customer_id: customer.id,
        boat_id: boat.id,
        location_id: location?.id,
        title: wizardData.job.title,
        description: wizardData.job.description || '',
        job_type: wizardData.job.jobType || 'Mobile Service',
        service_category: wizardData.job.serviceCategory || 'General Service',
        priority: wizardData.job.priority || 'Normal',
        status: 'New',
        intake_source: 'System',
        intake_date: new Date().toISOString(),
        requested_date: wizardData.job.targetDate || null,
        lead_technician_id: wizardData.technicians?.[0] || null
      });

      // Link Offer to Job if Offer+Job path
      if (offer) {
        await base44.asServiceRole.entities.Offer.update(offer.id, {
          converted_job_id: job.id,
          status: 'Converted'
        });
      }
    }

    // ============================================================
    // PHASE 6: CREATE WORK ORDER
    // ============================================================
    let workOrder = null;
    if (wizardData.intent === 'inspection' || (wizardData.intent.includes('job') && wizardData.workOrder?.createFirst !== false)) {
      const woTitle = wizardData.intent === 'inspection' 
        ? 'Initial Inspection'
        : wizardData.workOrder?.title || job.title;

      // Format scheduled_date as YYYY-MM-DD string
      let scheduledDateStr = wizardData.workOrder?.scheduled_date;
      if (scheduledDateStr) {
        const dateObj = new Date(scheduledDateStr);
        scheduledDateStr = dateObj.toISOString().split('T')[0];
      }

      workOrder = await base44.asServiceRole.entities.WorkOrder.create({
        job_id: job.id,
        offer_id: offer?.id || null,
        title: woTitle,
        description: wizardData.workOrder?.description || '',
        scheduled_date: scheduledDateStr,
        scheduled_start_time: wizardData.workOrder?.scheduled_start_time || null,
        estimated_duration_hours: wizardData.workOrder?.estimated_duration_hours,
        service_area: wizardData.job?.serviceCategory || 'General Service',
        assigned_technicians: wizardData.technicians || [],
        lead_technician_id: wizardData.technicians?.[0] || null,
        status: 'Draft',
        billable: true
      });

      // Link Offer to WorkOrder if single WO conversion
      if (offer && !job) {
        await base44.asServiceRole.entities.Offer.update(offer.id, {
          converted_work_order_id: workOrder.id,
          status: 'Converted'
        });
      }
    }

    // ============================================================
    // PHASE 7: CREATE TEAM ORDER (external partner)
    // ============================================================
    if (wizardData.externalPartner?.enabled && workOrder) {
      await base44.asServiceRole.entities.TeamOrder.create({
        work_order_id: workOrder.id,
        external_partner_id: wizardData.externalPartner.partner_id || null,
        partner_name: wizardData.externalPartner.partner_name || null,
        partner_contact: wizardData.externalPartner.partner_contact || null,
        status: 'Draft',
        approved_budget_total: wizardData.externalPartner.budget?.total || 0,
        labor_budget: wizardData.externalPartner.budget?.labor || 0,
        travel_budget: wizardData.externalPartner.budget?.travel || 0,
        accommodation_budget: wizardData.externalPartner.budget?.accommodation || 0,
        per_diem_budget: wizardData.externalPartner.budget?.per_diem || 0
      });
    }

    // ============================================================
    // SUCCESS
    // ============================================================
    const redirectTo = job?.id 
      ? `/JobDetail?id=${job.id}` 
      : offer?.id 
      ? `/OfferDetail?id=${offer.id}` 
      : `/CustomerDetail?id=${customer.id}`;

    return Response.json({
      success: true,
      created: {
        customer: customer.id,
        boat: boat?.id,
        location: location?.id,
        offer: offer?.id,
        job: job?.id,
        workOrder: workOrder?.id
      },
      redirectTo
    });

  } catch (error) {
    console.error('Wizard error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});