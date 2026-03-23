import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    console.log('[CLEANUP] Starting orphan cleanup...');

    // Get all Jobs and WorkOrders
    const [allJobs, allWorkOrders, allTasks] = await Promise.all([
      base44.asServiceRole.entities.Job.list('-created_date', 2000),
      base44.asServiceRole.entities.WorkOrder.list('-created_date', 2000),
      base44.asServiceRole.entities.Task.list('-created_date', 5000)
    ]);

    const validJobIds = new Set(allJobs.map(j => j.id));
    const validWorkOrderIds = new Set(allWorkOrders.map(wo => wo.id));

    // Find orphaned WorkOrders (job_id doesn't exist)
    const orphanedWorkOrders = allWorkOrders.filter(wo => wo.job_id && !validJobIds.has(wo.job_id));
    console.log(`[CLEANUP] Found ${orphanedWorkOrders.length} orphaned WorkOrders`);

    const orphanedWorkOrderIds = new Set(orphanedWorkOrders.map(wo => wo.id));

    // Find orphaned Tasks
    const orphanedTasks = allTasks.filter(task => {
      // Task references non-existent WorkOrder
      if (task.work_order_id && !validWorkOrderIds.has(task.work_order_id)) {
        return true;
      }
      // Task references WorkOrder that will be deleted
      if (task.work_order_id && orphanedWorkOrderIds.has(task.work_order_id)) {
        return true;
      }
      // Task directly references non-existent Job
      if (task.job_id && !validJobIds.has(task.job_id) && !task.work_order_id) {
        return true;
      }
      return false;
    });

    console.log(`[CLEANUP] Found ${orphanedTasks.length} orphaned Tasks`);

    // Delete orphaned Tasks first
    let tasksDeleted = 0;
    for (const task of orphanedTasks) {
      await base44.asServiceRole.entities.Task.delete(task.id);
      tasksDeleted++;
    }

    // Delete orphaned WorkOrders
    let workOrdersDeleted = 0;
    for (const wo of orphanedWorkOrders) {
      await base44.asServiceRole.entities.WorkOrder.delete(wo.id);
      workOrdersDeleted++;
    }

    console.log(`[CLEANUP] Cleanup complete. Deleted ${tasksDeleted} tasks and ${workOrdersDeleted} work orders`);

    return Response.json({
      success: true,
      deleted: {
        work_orders: workOrdersDeleted,
        tasks: tasksDeleted
      },
      details: {
        orphaned_work_orders_found: orphanedWorkOrders.length,
        orphaned_tasks_found: orphanedTasks.length
      },
      message: `Cleanup complete: Removed ${workOrdersDeleted} orphaned work orders and ${tasksDeleted} orphaned tasks`
    });
  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});