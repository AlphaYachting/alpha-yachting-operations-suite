import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id } = await req.json();
  if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

  // Fetch lead
  const leads = await base44.entities.Lead.filter({ id: lead_id });
  const lead = leads[0];
  if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

  // Check if already converted to opportunity
  const existing = await base44.entities.Opportunity.filter({ lead_id });
  if (existing.length > 0) {
    return Response.json({
      error: 'Lead already converted to opportunity',
      opportunity_id: existing[0].id,
    }, { status: 409 });
  }

  // Create opportunity from lead data
  const opportunity = await base44.entities.Opportunity.create({
    title: lead.name
      ? `${lead.name} — ${lead.inquiry_type || 'Inquiry'}`
      : 'New Opportunity',
    lead_id: lead.id,
    customer_id: lead.customer_id || null,
    boat_id: lead.converted_boat_id || null,
    source: lead.contact_method || 'Other',
    notes: [lead.notes, lead.description].filter(Boolean).join('\n\n').substring(0, 2000),
    stage: 'Reviewing Inquiry',
    probability: 20,
    assigned_user_id: lead.assigned_to_user_id || null,
  });

  // Update lead status to Converted
  await base44.entities.Lead.update(lead_id, { status: 'Converted' });

  return Response.json({ success: true, opportunity_id: opportunity.id });
});