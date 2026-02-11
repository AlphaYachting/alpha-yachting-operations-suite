import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Fetch all jobs with service_category
        const jobs = await base44.asServiceRole.entities.Job.filter({});
        
        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const job of jobs) {
            if (!job.service_category) {
                continue;
            }

            try {
                // Fetch work orders for this job
                const workOrders = await base44.asServiceRole.entities.WorkOrder.filter({ job_id: job.id });

                for (const wo of workOrders) {
                    // Only migrate if service_area is null/empty
                    if (!wo.service_area) {
                        await base44.asServiceRole.entities.WorkOrder.update(wo.id, {
                            service_area: job.service_category
                        });
                        migratedCount++;
                    } else {
                        skippedCount++;
                    }
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    job_id: job.id,
                    job_number: job.job_number,
                    error: error.message
                });
            }
        }

        return Response.json({
            success: true,
            summary: {
                total_jobs_processed: jobs.length,
                workorders_migrated: migratedCount,
                workorders_skipped: skippedCount,
                errors: errorCount
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});