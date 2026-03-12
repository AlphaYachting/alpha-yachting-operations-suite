import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Called by scheduled automation — service role only
  const opportunities = await base44.asServiceRole.entities.Opportunity.list('-created_date', 500);
  const activities    = await base44.asServiceRole.entities.OpportunityActivity.list('-activity_date', 2000);

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Group activities by opportunity
  const activityByOpp = {};
  activities.forEach(a => {
    if (!activityByOpp[a.opportunity_id]) activityByOpp[a.opportunity_id] = [];
    activityByOpp[a.opportunity_id].push(a);
  });

  let flagged = 0;
  let cleared = 0;

  for (const opp of opportunities) {
    // Skip closed deals
    if (['Won', 'Lost', 'Archived'].includes(opp.stage)) {
      if (opp.follow_up_required) {
        await base44.asServiceRole.entities.Opportunity.update(opp.id, { follow_up_required: false });
        cleared++;
      }
      continue;
    }

    const oppActivities = activityByOpp[opp.id] || [];
    const lastActivityMs = oppActivities.length > 0
      ? new Date(oppActivities[0].activity_date).getTime()
      : new Date(opp.created_date).getTime();

    const needsFollowUp = (now - lastActivityMs) > SEVEN_DAYS_MS;

    if (needsFollowUp !== !!opp.follow_up_required) {
      await base44.asServiceRole.entities.Opportunity.update(opp.id, { follow_up_required: needsFollowUp });
      if (needsFollowUp) flagged++;
      else cleared++;
    }
  }

  return Response.json({ success: true, checked: opportunities.length, flagged, cleared });
});