import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VESSEL_TYPES = ['Sailboat', 'Motorboat', 'Yacht', 'Catamaran', 'RIB', 'Other'];
const HULL_MATERIALS = ['GRP/Fiberglass', 'Aluminum', 'Steel', 'Wood', 'Carbon', 'Other'];
const ENGINE_TYPES = ['Inboard Diesel', 'Inboard Petrol', 'Outboard', 'Electric', 'Sail Only', 'Hybrid'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId, customerData, boatData } = await req.json();
    if (!leadId) {
      return Response.json({ error: 'leadId required' }, { status: 400 });
    }

    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    if (leads.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }
    const lead = leads[0];

    // --- Customer: reuse linked customer, otherwise create ---
    let customer = null;
    const existingCustomerId = lead.customer_id || lead.converted_customer_id;
    if (existingCustomerId) {
      const found = await base44.asServiceRole.entities.Customer.filter({ id: existingCustomerId });
      customer = found[0] || null;
    }
    if (!customer) {
      const nameParts = (lead.name || '').trim().split(/\s+/);
      customer = await base44.asServiceRole.entities.Customer.create({
        first_name: customerData?.first_name || nameParts[0] || '',
        last_name: customerData?.last_name || nameParts.slice(1).join(' ') || 'Lead',
        email: customerData?.email || lead.email,
        phone: customerData?.phone || lead.phone,
        customer_type: customerData?.customer_type || 'Private',
        preferred_language: customerData?.preferred_language || 'German',
        notes: lead.notes || '',
        status: 'Active'
      });
    }

    // --- Boat: parse free-text boat details into structured fields ---
    let boatId = null;
    const vesselName = boatData?.vessel_name || lead.boat_name;
    const rawDetails = [lead.boat_details, lead.description].filter(Boolean).join('\n');

    if (vesselName || rawDetails) {
      let parsed = {};
      if (rawDetails.trim().length > 0) {
        parsed = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract structured boat data from the following inquiry text. Only fill fields that are clearly stated; leave others empty/null. Do not guess.
Allowed vessel_type values: ${VESSEL_TYPES.join(', ')}.
Allowed hull_material values: ${HULL_MATERIALS.join(', ')}.
Allowed engine_type values: ${ENGINE_TYPES.join(', ')}.
Lengths in meters (convert feet to meters if needed). Year as 4-digit number.

Boat name (if known): ${vesselName || 'unknown'}
Text:
"""
${rawDetails}
"""`,
          response_json_schema: {
            type: 'object',
            properties: {
              vessel_name: { type: 'string' },
              vessel_type: { type: 'string' },
              manufacturer: { type: 'string' },
              model: { type: 'string' },
              year: { type: 'number' },
              length_m: { type: 'number' },
              beam_m: { type: 'number' },
              draft_m: { type: 'number' },
              hull_material: { type: 'string' },
              engine_type: { type: 'string' },
              engine_manufacturer: { type: 'string' },
              engine_model: { type: 'string' },
              engine_hours: { type: 'number' },
              registration_number: { type: 'string' },
              flag_country: { type: 'string' },
              berth_number: { type: 'string' },
              known_issues: { type: 'string' }
            }
          }
        }) || {};
      }

      const clean = (v) => (typeof v === 'string' && v.trim() && !/^(n\/a|unknown|null|none|-)$/i.test(v.trim())) ? v.trim() : undefined;
      const num = (v) => (typeof v === 'number' && !isNaN(v) && v > 0) ? v : undefined;
      const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);

      const boatPayload = {
        customer_id: customer.id,
        vessel_name: vesselName || clean(parsed.vessel_name) || 'Unbenannt',
        vessel_type: pick(boatData?.vessel_type, VESSEL_TYPES) || pick(parsed.vessel_type, VESSEL_TYPES) || 'Sailboat',
        manufacturer: clean(parsed.manufacturer),
        model: clean(parsed.model),
        year: num(parsed.year),
        length_m: num(parsed.length_m),
        beam_m: num(parsed.beam_m),
        draft_m: num(parsed.draft_m),
        hull_material: pick(parsed.hull_material, HULL_MATERIALS),
        engine_type: pick(parsed.engine_type, ENGINE_TYPES),
        engine_manufacturer: clean(parsed.engine_manufacturer),
        engine_model: clean(parsed.engine_model),
        engine_hours: num(parsed.engine_hours),
        registration_number: clean(parsed.registration_number),
        flag_country: clean(parsed.flag_country),
        berth_number: clean(parsed.berth_number),
        current_location_id: boatData?.location_id || lead.location_id || undefined,
        known_issues: clean(parsed.known_issues) || lead.notes || undefined,
        systems_notes: lead.boat_details ? `Aus Lead übernommen: ${lead.boat_details}` : undefined,
        status: 'Active'
      };
      Object.keys(boatPayload).forEach(k => boatPayload[k] === undefined && delete boatPayload[k]);

      const boat = await base44.asServiceRole.entities.Boat.create(boatPayload);
      boatId = boat.id;
    }

    await base44.asServiceRole.entities.Lead.update(leadId, {
      converted_customer_id: customer.id,
      converted_boat_id: boatId,
      converted_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      customerId: customer.id,
      boatId,
      message: `Lead converted: ${customer.first_name} ${customer.last_name}`
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});