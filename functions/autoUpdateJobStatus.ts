import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        // Only process updates (not creates or deletes)
        if (event.type !== 'update' || !data) {
            return Response.json({ success: true, message: 'No action needed' });
        }

        const workOrder = data;

        // Check if work order is now "In Progress"
        if (workOrder.status !== 'In Progress' || !workOrder.job_id) {
            return Response.json({ success: true, message: 'Work order not in progress or no job' });
        }

        // Get the parent job
        const jobs = await base44.asServiceRole.entities.Job.list();
        const job = jobs.find(j => j.id === workOrder.job_id);

        if (!job) {
            return Response.json({ success: true, message: 'Job not found' });
        }

        // Only update if job is in a "pre-work" state
        const preWorkStatuses = ['New', 'Quoted', 'Approved', 'Scheduled'];
        if (preWorkStatuses.includes(job.status)) {
            await base44.asServiceRole.entities.Job.update(job.id, {
                status: 'In Progress'
            });
            
            return Response.json({ 
                success: true, 
                message: `Job ${job.job_number} auto-updated to In Progress` 
            });
        }

        return Response.json({ success: true, message: 'Job already in active state' });

    } catch (error) {
        console.error('Error in autoUpdateJobStatus:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});