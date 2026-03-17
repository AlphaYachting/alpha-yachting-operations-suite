import { base44 } from '@/api/base44Client';

async function getUserSettings(userEmail) {
  try {
    const settings = await base44.entities.NotificationSettings.filter({ user_email: userEmail });
    if (settings.length > 0) {
      return settings[0];
    }
    // Return defaults if no settings found
    return {
      work_order_assignment_enabled: true,
      task_status_change_enabled: true,
      work_order_reminder_enabled: true,
      notification_method: 'both',
      notify_as_lead_only: false
    };
  } catch (error) {
    console.error('Error loading user settings:', error);
    return {
      work_order_assignment_enabled: true,
      task_status_change_enabled: true,
      work_order_reminder_enabled: true,
      notification_method: 'both',
      notify_as_lead_only: false
    };
  }
}

export async function createNotification(userEmail, type, title, message, relatedWorkOrderId = null, relatedTaskId = null) {
  try {
    // Get user's notification settings
    const settings = await getUserSettings(userEmail);

    // Check if this notification type is enabled
    if (type === 'work_order_assignment' && !settings.work_order_assignment_enabled) {
      return null;
    }
    if (type === 'task_status_change' && !settings.task_status_change_enabled) {
      return null;
    }
    if (type === 'work_order_reminder' && !settings.work_order_reminder_enabled) {
      return null;
    }

    const method = settings.notification_method || 'both';

    // Create in-app notification if enabled
    let notification = null;
    if (method === 'both' || method === 'in_app_only') {
      notification = await base44.entities.Notification.create({
        user_email: userEmail,
        type,
        title,
        message,
        related_work_order_id: relatedWorkOrderId,
        related_task_id: relatedTaskId,
        is_read: false,
        email_sent: false
      });
    }

    // Send email notification if enabled
    if (method === 'both' || method === 'email_only') {
      try {
        const appUrl = window.location.origin;
        await base44.integrations.Core.SendEmail({
          to: userEmail,
          subject: `[Alpha Yachting] ${title}`,
          body: `
            <h2>${title}</h2>
            <p>${message}</p>
            ${relatedWorkOrderId ? `<p style="margin-top: 20px;"><a href="${appUrl}/WorkOrderDetail?id=${relatedWorkOrderId}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Work Order</a></p>` : ''}
            <br>
            <p style="color: #666; font-size: 12px;">This is an automated notification from Alpha Yachting Service Management.</p>
          `
        });

        // Mark email as sent
        if (notification) {
          await base44.entities.Notification.update(notification.id, { email_sent: true });
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function notifyWorkOrderAssignment(workOrder, technicians, workOrderTitle) {
  const assignedTechIds = workOrder.assigned_technicians || [];
  
  // Fetch additional details for the email
  let job = null;
  let boat = null;
  let location = null;
  let tasks = [];
  
  try {
    if (workOrder.job_id) {
      job = await base44.entities.Job.list().then(jobs => jobs.find(j => j.id === workOrder.job_id));
      if (job?.boat_id) {
        boat = await base44.entities.Boat.list().then(boats => boats.find(b => b.id === job.boat_id));
      }
      if (job?.location_id) {
        location = await base44.entities.Location.list().then(locs => locs.find(l => l.id === job.location_id));
      }
    }
    
    tasks = await base44.entities.Task.filter({ work_order_id: workOrder.id });
  } catch (error) {
    console.error('Error fetching work order details:', error);
  }
  
  for (const techId of assignedTechIds) {
    const tech = technicians.find(t => t.id === techId);
    if (tech && tech.email) {
      // Get user settings to check if they want lead-only notifications
      const settings = await getUserSettings(tech.email);
      
      // Skip if user only wants notifications when they're lead tech
      if (settings.notify_as_lead_only && workOrder.lead_technician_id !== techId) {
        continue;
      }
      
      // Build detailed message with HTML formatting
      const boatName = boat?.vessel_name || 'Unknown Vessel';
      const marineName = location?.name || 'Not specified';
      const workDate = workOrder.scheduled_date 
        ? new Date(workOrder.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        : 'Not scheduled';
      const taskList = tasks.length > 0 
        ? tasks.map(t => `<li>${t.title}</li>`).join('')
        : '<li>No tasks specified</li>';
      
      const detailedMessage = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p><strong>Work Order:</strong> ${workOrderTitle}</p>
          <p><strong>Boat:</strong> ${boatName}</p>
          <p><strong>Marina:</strong> ${marineName}</p>
          <p><strong>Scheduled Date:</strong> ${workDate}</p>
          <div style="margin-top: 15px;">
            <p><strong>Tasks to Complete:</strong></p>
            <ul style="margin: 10px 0;">
              ${taskList}
            </ul>
          </div>
        </div>
      `;
      
      await createNotification(
        tech.email,
        'work_order_assignment',
        'New Work Order Assignment',
        detailedMessage,
        workOrder.id
      );
    }
  }
}

export async function notifyTaskStatusChange(task, workOrder, technicians, oldStatus, newStatus) {
  // Notify all technicians assigned to the work order
  const assignedTechIds = workOrder.assigned_technicians || [];
  
  for (const techId of assignedTechIds) {
    const tech = technicians.find(t => t.id === techId);
    if (tech && tech.email) {
      await createNotification(
        tech.email,
        'task_status_change',
        'Task Status Updated',
        `Task "${task.title}" status changed from ${oldStatus} to ${newStatus}`,
        workOrder.id,
        task.id
      );
    }
  }
}

export async function notifyLeadAssignment(lead, assignedUser) {
  if (!assignedUser || !assignedUser.email) return;

  try {
    // Use backend function so APP_DOMAIN secret is used for correct production URL
    await base44.functions.invoke('notifyLeadAssignment', {
      lead_id: lead.id,
      assigned_user_email: assignedUser.email
    });
  } catch (error) {
    console.error('Failed to send lead assignment notification:', error);
  }
}