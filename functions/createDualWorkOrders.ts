import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { baseWorkOrderData, orgTasks, execTasks } = await req.json();

    // Validate
    if (!baseWorkOrderData.job_id || !baseWorkOrderData.title || !baseWorkOrderData.scheduled_date) {
      return Response.json({ 
        error: 'Missing required fields: job_id, title, scheduled_date' 
      }, { status: 400 });
    }

    if (!orgTasks?.length && !execTasks?.length) {
      return Response.json({ 
        error: 'Must provide at least one task stream' 
      }, { status: 400 });
    }

    // Generate shared group ID
    const workorder_group_id = crypto.randomUUID();

    // Clean numeric fields
    const numericFields = ['estimated_duration_hours', 'travel_time_minutes', 'work_time_minutes', 
                           'break_time_minutes', 'mileage_km', 'sort_index'];
    numericFields.forEach(field => {
      if (baseWorkOrderData[field] === '' || baseWorkOrderData[field] === undefined) {
        baseWorkOrderData[field] = null;
      }
    });

    // ============================================================
    // CREATE EXECUTION WORKORDER (Primary)
    // ============================================================
    let execWorkOrder = null;
    if (execTasks?.length > 0) {
      const execWOResponse = await base44.asServiceRole.functions.invoke('createWorkOrderWithNumber', {
        ...baseWorkOrderData,
        title: `${baseWorkOrderData.title} – Execution`,
        workorder_type: 'EXECUTION',
        workorder_group_id: workorder_group_id,
        linked_workorder_id: null, // Will update after org WO created
        assigned_technicians: baseWorkOrderData.assigned_technicians || []
      });

      if (!execWOResponse.data?.success) {
        throw new Error(execWOResponse.data?.message || 'Failed to create execution work order');
      }
      execWorkOrder = execWOResponse.data.work_order;

      // Create execution tasks
      for (let i = 0; i < execTasks.length; i++) {
        await base44.asServiceRole.entities.Task.create({
          work_order_id: execWorkOrder.id,
          title: execTasks[i].title,
          description: execTasks[i].description || '',
          estimated_minutes: execTasks[i].estimated_minutes || null,
          sequence_order: i,
          task_stream: 'EXECUTION',
          status: 'Not Started'
        });
      }
    }

    // ============================================================
    // CREATE ORGANIZATION WORKORDER (Companion)
    // ============================================================
    let orgWorkOrder = null;
    if (orgTasks?.length > 0) {
      const orgWOResponse = await base44.asServiceRole.functions.invoke('createWorkOrderWithNumber', {
        ...baseWorkOrderData,
        title: `${baseWorkOrderData.title} – Organization`,
        workorder_type: 'ORGANIZATION',
        workorder_group_id: workorder_group_id,
        linked_workorder_id: execWorkOrder?.id || null,
        assigned_technicians: [], // Default to empty for org WO
        status: 'Draft'
      });

      if (!orgWOResponse.data?.success) {
        throw new Error(orgWOResponse.data?.message || 'Failed to create organization work order');
      }
      orgWorkOrder = orgWOResponse.data.work_order;

      // Create organization tasks
      for (let i = 0; i < orgTasks.length; i++) {
        await base44.asServiceRole.entities.Task.create({
          work_order_id: orgWorkOrder.id,
          title: orgTasks[i].title,
          description: orgTasks[i].description || '',
          estimated_minutes: orgTasks[i].estimated_minutes || null,
          sequence_order: i,
          task_stream: 'ORGANIZATION',
          status: 'Not Started',
          assigned_user_id: user.id // Default org tasks to current user (optional)
        });
      }
    }

    // ============================================================
    // LINK WORKORDERS (Bidirectional)
    // ============================================================
    if (execWorkOrder && orgWorkOrder) {
      await base44.asServiceRole.entities.WorkOrder.update(execWorkOrder.id, {
        linked_workorder_id: orgWorkOrder.id
      });
      await base44.asServiceRole.entities.WorkOrder.update(orgWorkOrder.id, {
        linked_workorder_id: execWorkOrder.id
      });
    }

    return Response.json({
      success: true,
      workorder_group_id,
      execution_workorder: execWorkOrder,
      organization_workorder: orgWorkOrder
    });

  } catch (error) {
    console.error('Error creating dual work orders:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});