import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const SYSTEM_PREFIX = 'service+';

    // Manual attribution overrides — these offers were triggered by a.rittler but created by system automation
    const MANUAL_ATTRIBUTION = {
      'OFF-2026-0071': 'a.rittler@rittler.co',
      'OFF-2026-0073': 'a.rittler@rittler.co',
      'OFF-2026-0060': 'a.rittler@rittler.co',
      'OFF-2026-0055': 'a.rittler@rittler.co',
      'OFF-2026-0040': 'a.rittler@rittler.co',
      'BILL-20260406-6611': 'a.rittler@rittler.co',
      'OFF-2026-0053': 'a.rittler@rittler.co',
      'OFF-2026-0051': 'a.rittler@rittler.co',
      'OFF-2026-0021': 'a.rittler@rittler.co',
      'OFF-2026-0034': 'a.rittler@rittler.co',
    };
    const isSystem = (email) => !email || email.startsWith(SYSTEM_PREFIX) || email.includes('no-reply.base44.com');

    // Fetch offers and leads in parallel
    const [allOffers, allLeads] = await Promise.all([
      base44.asServiceRole.entities.Offer.list('-created_date', 1000),
      base44.asServiceRole.entities.Lead.list('-created_date', 1000),
    ]);

    // Build lead lookup by id → created_by (human lead creator)
    const leadCreatorMap = {};
    for (const lead of allLeads) {
      if (lead.id && !isSystem(lead.created_by)) {
        leadCreatorMap[lead.id] = lead.created_by;
      }
    }

    const mapped = allOffers.map(o => {
      const rootCreator = o.created_by || '';
      const rootIsSystem = isSystem(rootCreator);

      // Determine effective creator with priority: manual override > lead attribution > root
      let effective_created_by = rootCreator;
      let attribution_source = 'root';

      const offerNum = (o.offer_number || '').replace(/^#/, '');
      if (MANUAL_ATTRIBUTION[offerNum]) {
        effective_created_by = MANUAL_ATTRIBUTION[offerNum];
        attribution_source = 'manual_override';
      } else if (rootIsSystem && o.lead_id && leadCreatorMap[o.lead_id]) {
        effective_created_by = leadCreatorMap[o.lead_id];
        attribution_source = 'lead';
      }

      return {
        id: o.id,
        created_date: o.created_date,
        effective_created_by,
        is_system: isSystem(effective_created_by),
        created_by: rootCreator,
        attribution_source,
        offer_number: o.offer_number,
        source_type: o.source_type,
        lead_id: o.lead_id || null,
        status: o.status || null,
      };
    });

    return Response.json({ offers: mapped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});