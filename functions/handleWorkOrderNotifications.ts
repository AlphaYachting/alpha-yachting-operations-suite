import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // Fetch related data
        const [job, customer] = await Promise.all([
            workOrder.job_id ? base44.asServiceRole.entities.Job.get(workOrder.job_id) : null,
            null // Will fetch from job
        ]);

        const customerData = job?.customer_id 
            ? await base44.asServiceRole.entities.Customer.get(job.customer_id)
            : null;

        const boat = job?.boat_id
            ? await base44.asServiceRole.entities.Boat.get(job.boat_id)
            : null;

        // Determine if we should notify customer based on status
        const customerNotificationStatuses = [
            'Scheduled',
            'Dispatched',
            'In Progress',
            'Completed',
            'Paused',
            'Waiting for Parts',
            'Waiting for Approval'
        ];

        if (!customerNotificationStatuses.includes(workOrder.status)) {
            return Response.json({ message: 'Status does not require customer notification' });
        }

        if (!customerData?.email) {
            return Response.json({ message: 'No customer email found' });
        }

        // Compose notification message
        const statusMessages = {
            'Scheduled': 'has been scheduled',
            'Dispatched': 'technicians are on their way',
            'In Progress': 'work has started',
            'Completed': 'has been completed',
            'Paused': 'has been paused',
            'Waiting for Parts': 'is waiting for parts',
            'Waiting for Approval': 'is awaiting your approval'
        };

        const statusMessage = statusMessages[workOrder.status] || 'status has been updated';
        
        const emailSubject = `Work Order ${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)} - ${workOrder.status}`;
        
        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af;">Work Order Update</h2>
                
                <p>Dear ${customerData.first_name || 'valued customer'},</p>
                
                <p>Your work order <strong>${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)}</strong> ${statusMessage}.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #374151;">Work Order Details</h3>
                    <p><strong>Title:</strong> ${workOrder.title}</p>
                    ${boat ? `<p><strong>Vessel:</strong> ${boat.vessel_name}</p>` : ''}
                    ${workOrder.scheduled_date ? `<p><strong>Scheduled Date:</strong> ${workOrder.scheduled_date}</p>` : ''}
                    <p><strong>Current Status:</strong> <span style="color: #1e40af; font-weight: bold;">${workOrder.status}</span></p>
                    ${workOrder.description ? `<p><strong>Description:</strong> ${workOrder.description}</p>` : ''}
                </div>
                
                ${workOrder.status === 'Completed' ? `
                    <p style="color: #059669; font-weight: bold;">Thank you for choosing our services!</p>
                ` : ''}
                
                ${workOrder.status === 'Waiting for Approval' ? `
                    <p style="color: #dc2626; font-weight: bold;">Please review and approve the work at your earliest convenience.</p>
                ` : ''}
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    If you have any questions, please don't hesitate to contact us.
                </p>
                
                <p style="color: #6b7280; font-size: 14px;">
                    Best regards,<br>
                    Alpha Yachting Team
                </p>
            </div>
        `;

        // Send email to customer
        await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: 'Alpha Yachting',
            to: customerData.email,
            subject: emailSubject,
            body: emailBody
        });

        // Create in-app notification for customer if they have a user account
        const customerUser = customerData.email 
            ? await base44.asServiceRole.entities.User.filter({ email: customerData.email }).catch(() => [])
            : [];

        if (customerUser && customerUser.length > 0) {
            await base44.asServiceRole.entities.Notification.create({
                user_email: customerData.email,
                type: 'work_order_status_change',
                title: `Work Order ${workOrder.status}`,
                message: `Work order ${workOrder.work_order_number || '#' + workOrder.id.slice(0, 8)} ${statusMessage}`,
                related_work_order_id: workOrder.id,
                email_sent: true
            });
        }

        return Response.json({ 
            success: true, 
            message: 'Customer notification sent',
            customer_email: customerData.email,
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