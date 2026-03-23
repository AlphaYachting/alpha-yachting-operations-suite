import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only operation
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all work orders
    const workOrders = await base44.asServiceRole.entities.WorkOrder.list();
    const workOrderIds = new Set(workOrders.map(wo => wo.id));

    // Find orphaned tasks (WO deleted but task remains)
    const allTasks = await base44.asServiceRole.entities.Task.list();
    const orphanedTasks = allTasks.filter(t => !workOrderIds.has(t.work_order_id));

    // Find orphaned comments
    const allComments = await base44.asServiceRole.entities.WorkOrderComment.list();
    const orphanedComments = allComments.filter(c => !workOrderIds.has(c.work_order_id));

    // Delete orphaned records
    let tasksDeleted = 0, commentsDeleted = 0;

    for (const task of orphanedTasks) {
      await base44.asServiceRole.entities.Task.delete(task.id);
      tasksDeleted++;
    }

    for (const comment of orphanedComments) {
      await base44.asServiceRole.entities.WorkOrderComment.delete(comment.id);
      commentsDeleted++;
    }

    return Response.json({
      success: true,
      tasksDeleted,
      commentsDeleted
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});