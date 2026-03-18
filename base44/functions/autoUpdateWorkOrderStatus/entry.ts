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

        // Check if task is now active (not "Not Started")
        const isTaskActive = task.status && task.status !== 'Not Started';
        
        if (!isTaskActive || !task.work_order_id) {
            return Response.json({ success: true, message: 'Task not active or no work order' });
        }

        // Get the parent work order
        const workOrders = await base44.asServiceRole.entities.WorkOrder.list();
        const workOrder = workOrders.find(wo => wo.id === task.work_order_id);

        if (!workOrder) {
            return Response.json({ success: true, message: 'Work order not found' });
        }

        // Only update if work order is in a "pre-work" state
        const preWorkStatuses = ['Draft', 'Scheduled', 'Dispatched'];
        if (preWorkStatuses.includes(workOrder.status)) {
            await base44.asServiceRole.entities.WorkOrder.update(workOrder.id, {
                status: 'In Progress'
            });
            
            return Response.json({ 
                success: true, 
                message: `Work Order ${workOrder.work_order_number} auto-updated to In Progress` 
            });
        }

        return Response.json({ success: true, message: 'Work order already in active state' });

    } catch (error) {
        console.error('Error in autoUpdateWorkOrderStatus:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});