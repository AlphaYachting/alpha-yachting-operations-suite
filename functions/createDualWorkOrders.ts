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
    // ALLOCATE WO NUMBERS (inline to avoid nested function calls)
    // ============================================================
    const recentWorkOrders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 50);
    const validNumbers = recentWorkOrders
      .map(wo => wo.work_order_number)
      .filter(num => num && /^WO\d{5}$/.test(num))
      .map(num => parseInt(num.substring(2), 10))
      .filter(num => !isNaN(num));
    
    const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
    const execWONumber = `WO${String(maxNumber + 1).padStart(5, '0')}`;
    const orgWONumber = `WO${String(maxNumber + 2).padStart(5, '0')}`;

    // Auto-set status
    const hasDate = !!baseWorkOrderData.scheduled_date;
    const hasTechs = baseWorkOrderData.assigned_technicians?.length > 0;
    const isPlannedReady = hasDate && hasTechs;
    const execStatus = (isPlannedReady && baseWorkOrderData.status === 'Draft') ? 'Scheduled' : baseWorkOrderData.status;

    // ============================================================
    // CREATE EXECUTION WORKORDER (Primary)
    // ============================================================
    let execWorkOrder = null;
    if (execTasks?.length > 0) {
      execWorkOrder = await base44.asServiceRole.entities.WorkOrder.create({
        ...baseWorkOrderData,
        title: `${baseWorkOrderData.title} – Execution`,
        work_order_number: execWONumber,
        workorder_type: 'EXECUTION',
        workorder_group_id: workorder_group_id,
        linked_workorder_id: null, // Will update after org WO created
        assigned_technicians: baseWorkOrderData.assigned_technicians || [],
        status: execStatus
      });

      // Create execution tasks
      const execTaskPromises = execTasks.map((task, i) =>
        base44.asServiceRole.entities.Task.create({
          work_order_id: execWorkOrder.id,
          title: task.title,
          description: task.description || '',
          estimated_minutes: task.estimated_minutes || null,
          sequence_order: i,
          task_stream: 'EXECUTION',
          status: 'Not Started'
        })
      );
      await Promise.all(execTaskPromises);
    }

    // ============================================================
    // CREATE ORGANIZATION WORKORDER (Companion)
    // ============================================================
    let orgWorkOrder = null;
    if (orgTasks?.length > 0) {
      orgWorkOrder = await base44.asServiceRole.entities.WorkOrder.create({
        ...baseWorkOrderData,
        title: `${baseWorkOrderData.title} – Organization`,
        work_order_number: orgWONumber,
        workorder_type: 'ORGANIZATION',
        workorder_group_id: workorder_group_id,
        linked_workorder_id: execWorkOrder?.id || null,
        assigned_technicians: [], // Default to empty for org WO
        status: 'Draft'
      });

      // Create organization tasks
      const orgTaskPromises = orgTasks.map((task, i) =>
        base44.asServiceRole.entities.Task.create({
          work_order_id: orgWorkOrder.id,
          title: task.title,
          description: task.description || '',
          estimated_minutes: task.estimated_minutes || null,
          sequence_order: i,
          task_stream: 'ORGANIZATION',
          status: 'Not Started',
          assigned_user_id: user.id
        })
      );
      await Promise.all(orgTaskPromises);
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