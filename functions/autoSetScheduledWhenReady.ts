import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        if (!data) {
            return Response.json({ success: true, message: 'No data provided' });
        }

        const workOrder = data;

        // Guard: Only operate on planning states (Draft, Scheduled)
        const planningStates = ['Draft', 'Scheduled'];
        if (!planningStates.includes(workOrder.status)) {
            return Response.json({ 
                success: true, 
                message: `Status "${workOrder.status}" is operational - not modified by planning automation` 
            });
        }

        // Evaluate planning readiness
        const hasDate = !!workOrder.scheduled_date;
        const hasTech = Array.isArray(workOrder.assigned_technicians) && 
                        workOrder.assigned_technicians.length > 0;

        const desiredStatus = (hasDate && hasTech) ? 'Scheduled' : 'Draft';

        // Idempotent: Only update if status needs to change
        if (workOrder.status === desiredStatus) {
            return Response.json({ 
                success: true, 
                message: `Status already correct: ${desiredStatus}` 
            });
        }

        // Update status
        await base44.asServiceRole.entities.WorkOrder.update(workOrder.id, {
            status: desiredStatus
        });

        return Response.json({ 
            success: true, 
            message: `WorkOrder ${workOrder.work_order_number || workOrder.id} status updated: ${workOrder.status} → ${desiredStatus}`,
            transition: `${workOrder.status} → ${desiredStatus}`,
            reason: hasDate && hasTech ? 'Planning complete' : 'Planning incomplete'
        });

    } catch (error) {
        console.error('Error in autoSetScheduledWhenReady:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});