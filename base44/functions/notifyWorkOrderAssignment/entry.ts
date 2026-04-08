import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();
    const workOrderId = event?.entity_id;

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

    // Deduplizierung: Prüfe ob in den letzten 10 Minuten bereits Notifications für diese WO existieren
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentNotifications = await base44.asServiceRole.entities.Notification.filter({
      related_work_order_id: workOrderId,
      type: 'work_order_assignment'
    });
    const recentlySentTechIds = new Set(
      recentNotifications
        .filter(n => n.created_date > tenMinutesAgo)
        .map(n => {
          // Extrahiere tech email aus der Notification und matche zurück
          return n.user_email;
        })
    );

    // Load necessary data
    const [workOrder, technicians, job, boat, customer, location] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.get(workOrderId),
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
    const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: workOrderId });

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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_ADDRESS = Deno.env.get('CUSTOM_EMAIL_FROM') || 'info@alpha-yachting.hr';
    const FROM_NAME = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';
    const APP_DOMAIN = Deno.env.get('APP_DOMAIN') || 'https://alpha-yachting.base44.app';

    const notifications = [];
    for (const techId of addedTechIds) {
      const tech = technicians.find(t => t.id === techId);
      if (!tech?.email) continue;

      // Deduplizierung: Überspringe wenn in letzten 10 Minuten bereits gesendet
      if (recentlySentTechIds.has(tech.email)) {
        console.log(`Skipping duplicate notification for ${tech.email}`);
        continue;
      }

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
        related_work_order_id: workOrderId,
        is_read: false,
        email_sent: false
      });

      notifications.push(notification);

      // Send email via Resend
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_ADDRESS}>`,
            to: [tech.email],
            subject: `Neue Aufgabenzuteilung: ${data.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
                <h2 style="color: #1e40af;">Du wurdest einem Work Order zugewiesen</h2>
                ${message}
                <p style="margin-top: 20px;">
                  <a href="${APP_DOMAIN}" 
                     style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Work Order öffnen
                  </a>
                </p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
                <p style="font-size: 12px; color: #888;">Alpha Yachting Service System</p>
              </div>
            `
          })
        });

        const emailBody = await emailRes.json();
        console.log('Resend response:', emailRes.status, JSON.stringify(emailBody));

        if (emailRes.ok) {
          await base44.asServiceRole.entities.Notification.update(notification.id, {
            email_sent: true
          });
        }
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