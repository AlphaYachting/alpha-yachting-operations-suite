import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Builds a structured BriefingContext object for an external worker/partner
 * Safe, isolated function that consolidates data from multiple entities
 * without causing side effects to existing workflows
 *
 * Input: { teamOrderId: string }
 * Output: BriefingContext object with external-safe data separated from internal-only
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamOrderId } = await req.json();

    if (!teamOrderId) {
      return Response.json(
        { error: 'teamOrderId is required' },
        { status: 400 }
      );
    }

    // Load TeamOrder first
    const [teamOrderData] = await base44.entities.TeamOrder.filter({
      id: teamOrderId
    });

    if (!teamOrderData) {
      return Response.json(
        { error: 'TeamOrder not found' },
        { status: 404 }
      );
    }

    // Load all related entities in parallel
    const [
      workOrderData,
      jobData,
      customerData,
      boatData,
      locationData,
      tasksData,
      externalPartnerData,
      offerData,
      workOrderPhotosData
    ] = await Promise.all([
      teamOrderData.work_order_id
        ? base44.entities.WorkOrder.filter({ id: teamOrderData.work_order_id })
        : Promise.resolve([]),
      null, // will load from workorder.job_id
      null, // will load from job or workorder
      null, // will load from job or workorder
      null, // will load from job or workorder
      teamOrderData.work_order_id
        ? base44.entities.Task.filter(
            { work_order_id: teamOrderData.work_order_id },
            'sequence_order'
          )
        : Promise.resolve([]),
      teamOrderData.external_partner_id
        ? base44.entities.Technician.filter({
            id: teamOrderData.external_partner_id
          })
        : Promise.resolve([]),
      null, // optional, will try to load
      teamOrderData.work_order_id
        ? base44.entities.WorkOrderPhoto.filter({
            work_order_id: teamOrderData.work_order_id
          })
        : Promise.resolve([])
    ]);

    // Second pass: load job and related entities
    const workOrder = workOrderData.length > 0 ? workOrderData[0] : null;
    const job = workOrder && workOrder.job_id
      ? (await base44.entities.Job.filter({ id: workOrder.job_id }))[0] || null
      : null;

    const customer = job
      ? (await base44.entities.Customer.filter({ id: job.customer_id }))[0] || null
      : null;

    const boat = job
      ? (await base44.entities.Boat.filter({ id: job.boat_id }))[0] || null
      : null;

    const location = job
      ? (await base44.entities.Location.filter({ id: job.location_id }))[0] || null
      : null;

    const externalPartner = externalPartnerData.length > 0 
      ? externalPartnerData[0] 
      : null;

    // Try to load offer if reference exists
    let offer = null;
    if (job && job.converted_from_offer_id) {
      try {
        const offerResults = await base44.entities.Offer.filter({
          id: job.converted_from_offer_id
        });
        offer = offerResults.length > 0 ? offerResults[0] : null;
      } catch (err) {
        // Offer not found or error — continue gracefully
      }
    }

    // Extract scope summary from job description via LLM if no offer
    let scopeSummary = offer?.description || null;
    if (!scopeSummary && job?.description) {
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Extract a brief 2-3 sentence scope summary from this job description. Be concise and focus on what work needs to be done:\n\n${job.description}`,
          response_json_schema: {
            type: 'object',
            properties: {
              scope_summary: { type: 'string' }
            }
          }
        });
        scopeSummary = result.scope_summary || null;
      } catch (err) {
        // LLM extraction failed — leave as null
      }
    }

    // Build normalized task list
    const tasks = (tasksData || []).map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      estimated_minutes: task.estimated_minutes,
      sequence_order: task.sequence_order || 0,
      task_stream: task.task_stream || 'EXECUTION',
      external_relevance: task.task_stream === 'EXECUTION' ? 'primary' : 'secondary'
    }));

    // Build the BriefingContext object
    const context = {
      meta: {
        generated_at: new Date().toISOString(),
        source: 'team_order_briefing_context',
        team_order_id: teamOrderId,
        work_order_id: teamOrderData.work_order_id,
        job_id: job?.id || null,
        version: 1
      },

      external_worker: {
        id: externalPartner?.id || null,
        name: externalPartner
          ? `${externalPartner.first_name} ${externalPartner.last_name}`
          : teamOrderData.partner_name || 'Unknown',
        role: externalPartner?.role || 'External Partner',
        contact: externalPartner?.phone || null,
        email: externalPartner?.email || null
      },

      work_order: {
        id: workOrder?.id || null,
        number: workOrder?.work_order_number || null,
        title: workOrder?.title || null,
        description: workOrder?.description || null,
        status: workOrder?.status || null,
        type: workOrder?.workorder_type || 'STANDARD',
        scheduled_date: workOrder?.scheduled_date || null,
        scheduled_start_time: workOrder?.scheduled_start_time || null,
        scheduled_end_date: workOrder?.scheduled_end_date || null,
        safety_notes: workOrder?.safety_notes || null
      },

      job: {
        id: job?.id || null,
        title: job?.title || null,
        description: job?.description || null,
        status: job?.status || null,
        priority: job?.priority || null,
        service_category: job?.service_category || null,
        job_type: job?.job_type || null
      },

      customer: {
        id: customer?.id || null,
        name:
          customer?.company_name ||
          `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() ||
          null,
        contact_name: customer
          ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
          : null,
        email: customer?.email || null,
        phone: customer?.phone || null,
        preferred_language: customer?.preferred_language || 'German'
      },

      boat: {
        id: boat?.id || null,
        name: boat?.vessel_name || null,
        type: boat?.vessel_type || null,
        length_m: boat?.length_m || null,
        berth: boat?.berth_number || null,
        known_context: boat?.known_issues || null
      },

      location: {
        id: location?.id || null,
        name: location?.name || null,
        address: location?.address || null,
        city: location?.city || null,
        access_notes: location?.access_notes || null
      },

      tasks: tasks,

      budget_policy: {
        approved_budget_total: teamOrderData.approved_budget_total || 0,
        labor_budget: teamOrderData.labor_budget || 0,
        travel_budget: teamOrderData.travel_budget || 0,
        accommodation_budget: teamOrderData.accommodation_budget || 0,
        per_diem_budget: teamOrderData.per_diem_budget || 0,
        accommodation_paid: teamOrderData.accommodation_paid || false,
        accommodation_max_per_night:
          teamOrderData.accommodation_max_per_night || null,
        meals_per_diem_paid: teamOrderData.meals_per_diem_paid || false,
        per_diem_rate_per_day: teamOrderData.per_diem_rate_per_day || null,
        mileage_paid: teamOrderData.mileage_paid || false,
        mileage_rate_per_km: teamOrderData.mileage_rate_per_km || null,
        travel_time_paid: teamOrderData.travel_time_paid || false,
        travel_time_rate_per_hour: teamOrderData.travel_time_rate_per_hour || null,
        other_reimbursables_allowed:
          teamOrderData.other_reimbursables_allowed || false,
        requires_preapproval_over: teamOrderData.requires_preapproval_over || 500,
        budget_exceed_requires_approval:
          teamOrderData.budget_exceed_requires_approval !== false
      },

      external_notes: {
        partner_notes: teamOrderData.partner_notes || null,
        customer_visible_notes: offer?.customer_notes || job?.customer_notes || null,
        scope_summary: scopeSummary,
        communication_summary: null // no email history in current schema
      },

      internal_only: {
        internal_notes: teamOrderData.internal_notes || null,
        raw_change_log: teamOrderData.change_log || [],
        internal_flags: teamOrderData.internal_flags || {},
        unresolved_context: null
      },

      attachments: (workOrderPhotosData || []).map(photo => ({
        id: photo.id,
        name: photo.caption || `Photo - ${photo.category}`,
        type: 'photo',
        source: 'work_order_photo',
        category: photo.category || 'Other',
        external_safe: photo.is_customer_visible !== false
      })),

      quality_flags: {
        missing_job_description: !job?.description,
        missing_scope_context: !scopeSummary,
        missing_customer_communication: true, // no email entity linked
        missing_task_descriptions: tasks.some(t => !t.description),
        stale_after_work_order_update: false, // would need version tracking
        has_only_partial_context: !job || !customer || !location
      }
    };

    return Response.json(context);
  } catch (error) {
    console.error('Error building briefing context:', error);
    return Response.json(
      { error: error.message || 'Failed to build briefing context' },
      { status: 500 }
    );
  }
});