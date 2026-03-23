import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    console.log(`[CASCADE DELETE] Starting cascade delete for Job: ${job_id}`);

    // Step 1: Get all WorkOrders for this Job
    const workOrders = await base44.asServiceRole.entities.WorkOrder.filter({ job_id });
    const workOrderIds = workOrders.map(wo => wo.id);
    console.log(`[CASCADE DELETE] Found ${workOrders.length} WorkOrders to delete`);

    // Step 2: Delete all Tasks referencing these WorkOrders
    let tasksDeletedCount = 0;
    if (workOrderIds.length > 0) {
      for (const woId of workOrderIds) {
        const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: woId });
        for (const task of tasks) {
          await base44.asServiceRole.entities.Task.delete(task.id);
          tasksDeletedCount++;
        }
      }
    }

    // Step 3: Delete Tasks directly linked to Job (if any exist without work_order_id)
    const directJobTasks = await base44.asServiceRole.entities.Task.filter({ job_id });
    for (const task of directJobTasks) {
      await base44.asServiceRole.entities.Task.delete(task.id);
      tasksDeletedCount++;
    }
    console.log(`[CASCADE DELETE] Deleted ${tasksDeletedCount} Tasks`);

    // Step 4: Delete all WorkOrders
    for (const wo of workOrders) {
      await base44.asServiceRole.entities.WorkOrder.delete(wo.id);
    }
    console.log(`[CASCADE DELETE] Deleted ${workOrders.length} WorkOrders`);

    // Step 5: Delete the Job itself
    await base44.asServiceRole.entities.Job.delete(job_id);
    console.log(`[CASCADE DELETE] Deleted Job: ${job_id}`);

    return Response.json({
      success: true,
      deleted: {
        job: 1,
        work_orders: workOrders.length,
        tasks: tasksDeletedCount
      },
      message: `Successfully deleted job and ${workOrders.length} work orders with ${tasksDeletedCount} tasks`
    });
  } catch (error) {
    console.error('[CASCADE DELETE] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});