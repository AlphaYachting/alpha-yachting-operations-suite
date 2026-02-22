import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Only process update events
    if (event?.type !== 'update' || !data || !old_data) {
      return Response.json({ success: false, reason: 'Not an update event' });
    }

    const oldTechs = old_data.assigned_technicians || [];
    const newTechs = data.assigned_technicians || [];

    // Find newly added technicians
    const addedTechIds = newTechs.filter(id => !oldTechs.includes(id));

    if (addedTechIds.length === 0) {
      return Response.json({ success: true, message: 'No new technicians added' });
    }

    // Load necessary data
    const [workOrder, technicians, job, boat, customer, location] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.get(data.id),
      base44.asServiceRole.entities.Technician.list(),
      data.job_id ? base44.asServiceRole.entities.Job.get(data.job_id) : null,
      null, // Will load via job
      null,
      null
    ]);

    // Load boat, customer, location via job
    let boatData = null;
    let customerData = null;
    let locationData = null;

    if (job) {
      [boatData, customerData, locationData] = await Promise.all([
        job.boat_id ? base44.asServiceRole.entities.Boat.get(job.boat_id) : null,
        job.customer_id ? base44.asServiceRole.entities.Customer.get(job.customer_id) : null,
        job.location_id ? base44.asServiceRole.entities.Location.get(job.location_id) : null
      ]);
    }

    // Get tasks for this work order
    const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: data.id });

    // Build task list
    const taskList = tasks.length > 0
      ? tasks.map(t => `<li>${t.title}</li>`).join('')
      : '<li>No tasks specified</li>';

    const scheduledDate = data.scheduled_date
      ? new Date(data.scheduled_date).toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : 'Not scheduled';

    // Send notifications to newly added technicians
    const notifications = [];
    for (const techId of addedTechIds) {
      const tech = technicians.find(t => t.id === techId);
      if (!tech?.email) continue;

      const message = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p><strong>Work Order:</strong> ${data.title}</p>
          <p><strong>Boat:</strong> ${boatData?.vessel_name || 'Not specified'}</p>
          <p><strong>Marina:</strong> ${locationData?.name || 'Not specified'}</p>
          <p><strong>Scheduled Date:</strong> ${scheduledDate}</p>
          <div style="margin-top: 15px;">
            <p><strong>Tasks to Complete:</strong></p>
            <ul style="margin: 10px 0;">
              ${taskList}
            </ul>
          </div>
        </div>
      `;

      // Create notification
      const notification = await base44.asServiceRole.entities.Notification.create({
        user_email: tech.email,
        type: 'work_order_assignment',
        title: 'New Work Order Assignment',
        message: message,
        related_work_order_id: data.id,
        is_read: false,
        email_sent: false
      });

      notifications.push(notification);

      // Send email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: tech.email,
          subject: `New Work Order Assignment: ${data.title}`,
          body: `
            <h2>You have been assigned to a work order</h2>
            ${message}
            <p style="margin-top: 20px;">
              <a href="${Deno.env.get('APP_DOMAIN')}" 
                 style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Work Order
              </a>
            </p>
          `
        });

        // Mark email as sent
        await base44.asServiceRole.entities.Notification.update(notification.id, {
          email_sent: true
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return Response.json({
      success: true,
      notifications_created: notifications.length,
      technicians_notified: addedTechIds.length
    });
  } catch (error) {
    console.error('Error in notifyWorkOrderAssignment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});