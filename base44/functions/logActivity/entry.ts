import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Shared activity logger — called by entity automations
// Payload: { event, data, old_data, changed_fields }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data, changed_fields } = payload;

    if (!event || !data) {
      return Response.json({ error: 'Missing event or data' }, { status: 400 });
    }

    const entityType = event.entity_name;
    const entityId = event.entity_id;
    const action = event.type; // create | update | delete

    // Determine human-readable label
    const label = data.title || data.work_order_number || data.job_number ||
                  data.offer_number || data.name || data.vessel_name ||
                  (data.first_name ? `${data.first_name} ${data.last_name}` : null) ||
                  entityId?.slice(-6);

    // Determine who did it — created_by is available on all entities
    const userEmail = data.created_by || 'system';

    // For updates, capture before/after for changed fields only
    let oldValues = null;
    let newValues = null;
    if (action === 'update' && changed_fields?.length > 0 && old_data) {
      oldValues = {};
      newValues = {};
      for (const field of changed_fields) {
        oldValues[field] = old_data[field];
        newValues[field] = data[field];
      }
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: label,
      changed_fields: changed_fields || [],
      old_values: oldValues,
      new_values: newValues,
      occurred_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});