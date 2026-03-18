import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Validate event payload
    if (!payload.event || payload.event.entity_name !== 'WorkOrder') {
      return Response.json({ 
        success: false, 
        error: 'Invalid event payload' 
      }, { status: 400 });
    }

    const { event, data, old_data } = payload;
    const workOrderId = event.entity_id;

    // Only process update events
    if (event.type !== 'update') {
      return Response.json({ 
        success: true, 
        message: 'Not an update event, skipping' 
      });
    }

    // Find associated TeamOrder
    const teamOrders = await base44.asServiceRole.entities.TeamOrder.filter({ 
      work_order_id: workOrderId 
    });

    if (teamOrders.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No team order found for this work order' 
      });
    }

    const teamOrder = teamOrders[0];

    // Track changes in core job fields
    const trackedFields = [
      'title',
      'description', 
      'scheduled_date',
      'scheduled_start_time',
      'scheduled_end_time',
      'estimated_duration_hours',
      'status'
    ];

    const changes = [];
    const timestamp = new Date().toISOString();

    for (const field of trackedFields) {
      const oldValue = old_data?.[field];
      const newValue = data?.[field];

      if (oldValue !== newValue && newValue !== undefined) {
        changes.push({
          timestamp,
          changed_field: field,
          old_value: String(oldValue || ''),
          new_value: String(newValue || ''),
          source: 'WorkOrder'
        });
      }
    }

    // Update TeamOrder if changes detected
    if (changes.length > 0) {
      const existingLog = teamOrder.change_log || [];
      const updatedLog = [...existingLog, ...changes];

      await base44.asServiceRole.entities.TeamOrder.update(teamOrder.id, {
        last_workorder_sync_at: timestamp,
        change_log: updatedLog
      });

      return Response.json({
        success: true,
        message: `TeamOrder synced: ${changes.length} changes tracked`,
        changes
      });
    }

    return Response.json({
      success: true,
      message: 'No tracked field changes detected'
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});