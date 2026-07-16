import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { repair_order_id } = await req.json();
    if (!repair_order_id) {
      return Response.json({ error: 'repair_order_id is required' }, { status: 400 });
    }

    const ro = await base44.entities.RepairOrder.get(repair_order_id);
    if (!ro) return Response.json({ error: 'Repair order not found' }, { status: 404 });

    if (ro.converted_job_id) {
      return Response.json({ success: true, job_id: ro.converted_job_id, already_converted: true });
    }

    // 1. Resolve / create Customer
    let customerId = ro.customer_id;
    if (!customerId) {
      // Try to match by email
      let existing = [];
      if (ro.customer_email) {
        existing = await base44.entities.Customer.filter({ email: ro.customer_email });
      }
      if (existing.length > 0) {
        customerId = existing[0].id;
      } else {
        const nameParts = (ro.customer_name || 'Unbekannt').trim().split(' ');
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (nameParts[0] || 'Unbekannt');
        const firstName = nameParts.length > 1 ? nameParts[0] : '';
        const newCustomer = await base44.entities.Customer.create({
          first_name: firstName,
          last_name: lastName,
          company_name: ro.customer_name && !firstName ? ro.customer_name : undefined,
          email: ro.customer_email || `noemail-${Date.now()}@placeholder.local`,
          phone: ro.customer_phone || '',
          billing_address: ro.customer_address || ''
        });
        customerId = newCustomer.id;
      }
    }

    // 2. Resolve / create Boat
    let boatId = ro.boat_id;
    if (!boatId) {
      const newBoat = await base44.entities.Boat.create({
        customer_id: customerId,
        vessel_name: ro.boat_name || '',
        model: ro.boat_type_model || '',
        year: ro.boat_year ? parseInt(ro.boat_year, 10) || undefined : undefined,
        length_m: ro.boat_length_m || undefined,
        registration_number: ro.boat_registration || '',
        engine_model: ro.engine_make_type || '',
        engine_hours: ro.engine_hours ? parseInt(ro.engine_hours, 10) || undefined : undefined
      });
      boatId = newBoat.id;
    }

    // 3. Allocate job number
    let jobNumber = '';
    try {
      const recentJobs = await base44.asServiceRole.entities.Job.list('-created_date', 100);
      const validNumbers = recentJobs
        .map((j: any) => j.job_number)
        .filter((num: string) => num && /^J\d{5}$/.test(num))
        .map((num: string) => parseInt(num.substring(1), 10))
        .filter((num: number) => !isNaN(num));
      const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
      jobNumber = `J${String(maxNumber + 1).padStart(5, '0')}`;
    } catch (_e) {
      jobNumber = `J${String(Date.now()).slice(-5)}`;
    }

    // 4. Create Job
    const job = await base44.entities.Job.create({
      job_number: jobNumber,
      customer_id: customerId,
      boat_id: boatId,
      title: ro.work_description
        ? ro.work_description.slice(0, 80)
        : `Reparaturauftrag ${ro.order_number || ''}`.trim(),
      description: ro.work_description || '',
      job_type: 'Mobile Service',
      status: 'New',
      intake_source: 'Drive-In',
      intake_date: new Date().toISOString(),
      estimated_cost: ro.cost_cap || undefined,
      internal_notes: `Erstellt aus Reparaturauftrag ${ro.order_number || repair_order_id}.`
    });

    // 5. Update repair order
    await base44.entities.RepairOrder.update(repair_order_id, {
      status: 'Converted',
      customer_id: customerId,
      boat_id: boatId,
      converted_job_id: job.id
    });

    return Response.json({
      success: true,
      job_id: job.id,
      job_number: jobNumber,
      customer_id: customerId,
      boat_id: boatId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});