import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { event, data, old_data } = payload;
        
        // Only process update events for now (status changes)
        if (event.type !== 'update' || !data || !old_data) {
            return Response.json({ message: 'No action needed', event_type: event.type });
        }

        const workOrder = data;
        const oldWorkOrder = old_data;

        // Check if status changed
        const statusChanged = workOrder.status !== oldWorkOrder.status;
        
        if (!statusChanged) {
            return Response.json({ message: 'Status unchanged, no notification sent' });
        }

        // Fetch related data for context
        const job = workOrder.job_id 
            ? await base44.asServiceRole.entities.Job.get(workOrder.job_id).catch(() => null)
            : null;

        const boat = job?.boat_id
            ? await base44.asServiceRole.entities.Boat.get(job.boat_id).catch(() => null)
            : null;

        const location = (workOrder.location_id || job?.location_id)
            ? await base44.asServiceRole.entities.Location.get(workOrder.location_id || job.location_id).catch(() => null)
            : null;

        // Fetch assigned technicians
        const assignedTechnicians = workOrder.assigned_technicians || [];
        const leadTechnicianId = workOrder.lead_technician_id;

        // Get all technician IDs to notify
        const technicianIds = [...new Set([...assignedTechnicians, leadTechnicianId].filter(Boolean))];

        if (technicianIds.length === 0) {
            return Response.json({ message: 'No technicians assigned, no notification sent' });
        }

        // Fetch technician details
        const technicians = await Promise.all(
            technicianIds.map(id => base44.asServiceRole.entities.Technician.get(id).catch(() => null))
        );

        const validTechnicians = technicians.filter(t => t && t.email);

        if (validTechnicians.length === 0) {
            return Response.json({ message: 'No technician emails found' });
        }

        // Compose notification message for internal team
        const statusMessages = {
            'Scheduled': 'has been scheduled',
            'Dispatched': 'is ready for dispatch',
            'In Progress': 'work has started',
            'Completed': 'has been completed',
            'Paused': 'has been paused',
            'Waiting for Parts': 'is waiting for parts',
            'Waiting for Approval': 'is awaiting approval'
        };

        const statusMessage = statusMessages[workOrder.status] || 'status has been updated';
        
        const emailSubject = `Work Order ${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)} - ${workOrder.status}`;
        
        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af;">Work Order Status Update</h2>
                
                <p>Work order <strong>${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)}</strong> ${statusMessage}.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">Work Order Details</h3>
                    <p><strong>Work Order:</strong> ${workOrder.title}</p>
                    ${boat ? `<p><strong>Boot / Schiff:</strong> ${boat.vessel_name}${boat.manufacturer ? ' (' + boat.manufacturer + (boat.model ? ' ' + boat.model : '') + ')' : ''}</p>` : ''}
                    ${job ? `<p><strong>Projekt:</strong> ${job.title}</p>` : ''}
                    ${location ? `<p><strong>Ort:</strong> ${location.name}</p>` : ''}
                    ${workOrder.scheduled_date ? `<p><strong>Termin:</strong> ${new Date(workOrder.scheduled_date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                    <p><strong>Status:</strong> <span style="color: #1e40af; font-weight: bold;">${workOrder.status}</span></p>
                    ${workOrder.description ? `<p><strong>Beschreibung:</strong> ${workOrder.description}</p>` : ''}
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                    Best regards,<br>
                    Alpha Yachting Team
                </p>
            </div>
        `;

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        const FROM_ADDRESS = Deno.env.get('CUSTOM_EMAIL_FROM') || 'info@alpha-yachting.hr';
        const FROM_NAME = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

        // Send email to all assigned technicians via Resend
        const emailPromises = validTechnicians.map(tech =>
            fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
                    to: [tech.email],
                    subject: emailSubject,
                    html: emailBody
                })
            })
        );

        await Promise.all(emailPromises);

        // Create in-app notifications for technicians
        const contextParts = [boat?.vessel_name, job?.title, location?.name].filter(Boolean);
        const contextStr = contextParts.length ? ` | ${contextParts.join(' · ')}` : '';
        const notificationPromises = validTechnicians.map(tech =>
            base44.asServiceRole.entities.Notification.create({
                user_email: tech.email,
                type: 'work_order_status_change',
                title: `Work Order ${workOrder.status}`,
                message: `${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)} – ${workOrder.title}${contextStr} → ${workOrder.status}`,
                related_work_order_id: workOrder.id,
                email_sent: true
            })
        );

        await Promise.all(notificationPromises);

        return Response.json({ 
            success: true, 
            message: 'Internal team notifications sent',
            technicians_notified: validTechnicians.length,
            status: workOrder.status
        });

    } catch (error) {
        console.error('Error in handleWorkOrderNotifications:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});