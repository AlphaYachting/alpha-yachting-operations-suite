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
        await base44.integrations.Core.SendEmail({
          to: userEmail,
          subject: `[Alpha Yachting] ${title}`,
          body: `
            <h2>${title}</h2>
            <p>${message}</p>
            ${relatedWorkOrderId ? `<p><a href="${window.location.origin}/#/WorkOrderDetail?id=${relatedWorkOrderId}">View Work Order</a></p>` : ''}
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
  
  for (const techId of assignedTechIds) {
    const tech = technicians.find(t => t.id === techId);
    if (tech && tech.email) {
      // Get user settings to check if they want lead-only notifications
      const settings = await getUserSettings(tech.email);
      
      // Skip if user only wants notifications when they're lead tech
      if (settings.notify_as_lead_only && workOrder.lead_technician_id !== techId) {
        continue;
      }
      
      await createNotification(
        tech.email,
        'work_order_assignment',
        'New Work Order Assignment',
        `You have been assigned to work order: ${workOrderTitle}`,
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