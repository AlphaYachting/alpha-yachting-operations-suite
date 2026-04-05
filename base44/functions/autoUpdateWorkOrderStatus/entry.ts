import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        // Only process updates (not creates or deletes)
        if (event.type !== 'update' || !data) {
            return Response.json({ success: true, message: 'No action needed' });
        }

        const task = data;

        if (!task.work_order_id) {
            return Response.json({ success: true, message: 'Task has no work_order_id' });
        }

        // Get the parent work order
        const workOrders = await base44.asServiceRole.entities.WorkOrder.list();
        const workOrder = workOrders.find(wo => wo.id === task.work_order_id);

        if (!workOrder) {
            return Response.json({ success: true, message: 'Work order not found' });
        }

        const terminalTaskStatuses = ['Completed', 'Skipped', 'Not Possible'];
        const isTaskActive = task.status && task.status !== 'Not Started';
        const isTaskReopened = task.status && !terminalTaskStatuses.includes(task.status);

        // REVERSAL: If a task is non-terminal and the WO is 'Ready to Invoice', revert to In Progress
        if (isTaskReopened && workOrder.status === 'Ready to Invoice') {
            await base44.asServiceRole.entities.WorkOrder.update(workOrder.id, {
                status: 'In Progress'
            });
            return Response.json({ 
                success: true, 
                message: `Work Order ${workOrder.work_order_number} reverted from Ready to Invoice to In Progress` 
            });
        }

        // FORWARD: Move WO to In Progress when a task becomes active from a pre-work state
        const preWorkStatuses = ['Draft', 'Scheduled', 'Dispatched'];
        if (isTaskActive && preWorkStatuses.includes(workOrder.status)) {
            await base44.asServiceRole.entities.WorkOrder.update(workOrder.id, {
                status: 'In Progress'
            });
            return Response.json({ 
                success: true, 
                message: `Work Order ${workOrder.work_order_number} auto-updated to In Progress` 
            });
        }

        return Response.json({ success: true, message: 'No status change needed' });

    } catch (error) {
        console.error('Error in autoUpdateWorkOrderStatus:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});