import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * One-time repair: finds all WorkOrders where all Tasks are in terminal states
 * but the WorkOrder itself is NOT yet Completed/Cancelled — and sets them to Completed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const terminalStates = ['Completed', 'Skipped', 'Not Possible'];

    // Fetch all non-completed, non-cancelled WorkOrders that have tasks
    const allWorkOrders = await base44.asServiceRole.entities.WorkOrder.list();
    const candidateWOs = allWorkOrders.filter(wo => !['Completed', 'Cancelled'].includes(wo.status));

    const results = { fixed: [], skipped: [], noTasks: [] };

    for (const wo of candidateWOs) {
      const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: wo.id });

      if (!tasks || tasks.length === 0) {
        results.noTasks.push({ id: wo.id, number: wo.work_order_number });
        continue;
      }

      const allDone = tasks.every(t => terminalStates.includes(t.status));
      const hasAtLeastOneCompleted = tasks.some(t => t.status === 'Completed');

      if (allDone && hasAtLeastOneCompleted) {
        await base44.asServiceRole.entities.WorkOrder.update(wo.id, {
          status: 'Completed',
          actual_end_time: new Date().toISOString(),
          documentation_complete: true
        });
        results.fixed.push({ id: wo.id, number: wo.work_order_number, taskCount: tasks.length });
      } else {
        const pending = tasks.filter(t => !terminalStates.includes(t.status));
        results.skipped.push({ id: wo.id, number: wo.work_order_number, pendingTasks: pending.length });
      }
    }

    console.log(`[repairCompletedWorkOrders] Fixed: ${results.fixed.length}, Skipped: ${results.skipped.length}, NoTasks: ${results.noTasks.length}`);

    return Response.json({
      success: true,
      summary: {
        fixed: results.fixed.length,
        skipped: results.skipped.length,
        noTasks: results.noTasks.length
      },
      fixedWorkOrders: results.fixed,
      skippedWorkOrders: results.skipped
    });

  } catch (error) {
    console.error('[repairCompletedWorkOrders] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});