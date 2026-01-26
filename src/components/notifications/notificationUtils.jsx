import { base44 } from '@/api/base44Client';

export async function createNotification(userEmail, type, title, message, relatedWorkOrderId = null, relatedTaskId = null) {
  try {
    // Create notification record
    const notification = await base44.entities.Notification.create({
      user_email: userEmail,
      type,
      title,
      message,
      related_work_order_id: relatedWorkOrderId,
      related_task_id: relatedTaskId,
      is_read: false,
      email_sent: false
    });

    // Send email notification
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
      await base44.entities.Notification.update(notification.id, { email_sent: true });
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Continue even if email fails - in-app notification is created
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