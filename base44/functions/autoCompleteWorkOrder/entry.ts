import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Auto-completes a WorkOrder when all its Tasks are in a terminal state.
 * Terminal states: Completed, Skipped, Not Possible
 * Blocking states: Not Started, In Progress, Needs Approval
 * 
 * Triggered by: Task entity automation (create + update events)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;

    // Only care about task create/update events
    if (!event || !data) {
      return Response.json({ skipped: true, reason: 'No event or data' });
    }

    const workOrderId = data.work_order_id;
    if (!workOrderId) {
      return Response.json({ skipped: true, reason: 'Task has no work_order_id' });
    }

    // Fetch the WorkOrder first — skip if already Completed or Cancelled
    let wo;
    try {
      const results = await base44.asServiceRole.entities.WorkOrder.filter({ id: workOrderId });
      wo = results?.[0];
    } catch (e) {
      return Response.json({ skipped: true, reason: 'WorkOrder not found' });
    }
    
    if (!wo) {
      return Response.json({ skipped: true, reason: 'WorkOrder not found' });
    }

    if (['Completed', 'Cancelled'].includes(wo.status)) {
      return Response.json({ skipped: true, reason: `WorkOrder already ${wo.status}` });
    }

    // Fetch ALL tasks for this WorkOrder
    const allTasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: workOrderId });

    if (!allTasks || allTasks.length === 0) {
      return Response.json({ skipped: true, reason: 'No tasks found for this WorkOrder' });
    }

    // Terminal states that allow WO completion
    const terminalStates = ['Completed', 'Skipped', 'Not Possible'];
    
    const allDone = allTasks.every(task => terminalStates.includes(task.status));
    const hasAtLeastOneCompleted = allTasks.some(task => task.status === 'Completed');

    if (!allDone) {
      const pending = allTasks.filter(t => !terminalStates.includes(t.status));
      return Response.json({ 
        skipped: true, 
        reason: `${pending.length} task(s) still pending`,
        pendingTasks: pending.map(t => ({ id: t.id, title: t.title, status: t.status }))
      });
    }

    if (!hasAtLeastOneCompleted) {
      return Response.json({ skipped: true, reason: 'No tasks actually completed (all skipped/not possible)' });
    }

    // All tasks done — set WorkOrder to Completed
    console.log(`[autoCompleteWorkOrder] All ${allTasks.length} tasks done for WO ${workOrderId}. Setting to Completed.`);

    await base44.asServiceRole.entities.WorkOrder.update(workOrderId, {
      status: 'Completed',
      actual_end_time: new Date().toISOString(),
      documentation_complete: true
    });

    return Response.json({ 
      success: true, 
      workOrderId,
      tasksChecked: allTasks.length,
      message: 'WorkOrder set to Completed'
    });

  } catch (error) {
    console.error('[autoCompleteWorkOrder] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});