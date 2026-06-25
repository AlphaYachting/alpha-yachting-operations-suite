import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    // Delete related LeadTasks and LeadTaskComments first
    const leadTasks = await base44.asServiceRole.entities.LeadTask.filter({ lead_id });
    await Promise.all(leadTasks.map(t => base44.asServiceRole.entities.LeadTask.delete(t.id)));

    const leadTaskComments = await base44.asServiceRole.entities.LeadTaskComment.filter({ lead_id });
    await Promise.all(leadTaskComments.map(c => base44.asServiceRole.entities.LeadTaskComment.delete(c.id)));

    // Delete the lead itself via service role (handles service-created leads)
    await base44.asServiceRole.entities.Lead.delete(lead_id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});