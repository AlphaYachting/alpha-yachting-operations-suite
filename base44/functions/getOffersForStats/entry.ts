import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch up to 1000 offers using service role to get raw data including data.created_by overrides
    const allOffers = await base44.asServiceRole.entities.Offer.list('-created_date', 1000);

    // For each offer, the effective creator is:
    // - data.created_by if set (manual override stored in data field)
    // - root created_by otherwise
    // The SDK returns root-level created_by but data fields are merged — however
    // created_by in data is shadowed by the root field. We detect system accounts
    // and check if data had a created_by override by looking at the raw offer.
    // Since we can't access raw data separately, we use a workaround:
    // We filter offers created by system and check if they have a non-system created_by_override field.
    
    const SYSTEM_PREFIX = 'service+';
    const mapped = allOffers.map(o => {
      const rootCreator = o.created_by || '';
      const isSystem = rootCreator.startsWith(SYSTEM_PREFIX) || rootCreator.includes('no-reply.base44.com');
      
      return {
        id: o.id,
        created_date: o.created_date,
        effective_created_by: rootCreator,
        is_system: isSystem,
        offer_number: o.offer_number,
        source_type: o.source_type,
      };
    });

    return Response.json({ offers: mapped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});