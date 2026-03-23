import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Delete all tasks first
    const allTasks = await base44.asServiceRole.entities.Task.list();
    for (const task of allTasks) {
      await base44.asServiceRole.entities.Task.delete(task.id);
    }

    // Delete all work order related data
    const [allPhotos, allTimeEntries, allComments, allMaterials, allTeamOrders, allAccessLogs, allRequirements, allReservations] = await Promise.all([
      base44.asServiceRole.entities.WorkOrderPhoto.list(),
      base44.asServiceRole.entities.TimeEntry.list(),
      base44.asServiceRole.entities.WorkOrderComment.list(),
      base44.asServiceRole.entities.MaterialUsage.list(),
      base44.asServiceRole.entities.TeamOrder.list(),
      base44.asServiceRole.entities.WorkOrderAccessLog.list(),
      base44.asServiceRole.entities.WorkOrderRequirementList.list(),
      base44.asServiceRole.entities.InventoryReservation.list()
    ]);

    // Delete photos
    for (const photo of allPhotos) {
      await base44.asServiceRole.entities.WorkOrderPhoto.delete(photo.id);
    }

    // Delete time entries
    for (const entry of allTimeEntries) {
      await base44.asServiceRole.entities.TimeEntry.delete(entry.id);
    }

    // Delete comments
    for (const comment of allComments) {
      await base44.asServiceRole.entities.WorkOrderComment.delete(comment.id);
    }

    // Delete material usage
    for (const material of allMaterials) {
      await base44.asServiceRole.entities.MaterialUsage.delete(material.id);
    }

    // Delete team orders
    for (const order of allTeamOrders) {
      await base44.asServiceRole.entities.TeamOrder.delete(order.id);
    }

    // Delete access logs
    for (const log of allAccessLogs) {
      await base44.asServiceRole.entities.WorkOrderAccessLog.delete(log.id);
    }

    // Delete requirements
    for (const req of allRequirements) {
      await base44.asServiceRole.entities.WorkOrderRequirementList.delete(req.id);
    }

    // Delete reservations
    for (const res of allReservations) {
      await base44.asServiceRole.entities.InventoryReservation.delete(res.id);
    }

    // Finally, delete all work orders
    const allWorkOrders = await base44.asServiceRole.entities.WorkOrder.list();
    for (const wo of allWorkOrders) {
      await base44.asServiceRole.entities.WorkOrder.delete(wo.id);
    }

    return Response.json({ 
      success: true, 
      message: `Deleted ${allTasks.length} tasks and ${allWorkOrders.length} work orders with all associated data` 
    });
  } catch (error) {
    console.error('Error deleting data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});