import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Screens a single incoming lead for data quality and prepares two ready-to-send
// email drafts (a friendly verification/follow-up and a polite rejection).
// Runs automatically on new leads via an entity automation, and can be re-run manually.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Support both manual call ({ lead_id }) and entity automation event payloads
    let leadId = body.lead_id || body.entity_id;
    if (body.event?.entity_id) leadId = body.event.entity_id;
    if (body.data?.id) leadId = body.data.id;

    if (!leadId) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    // Load the lead
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    const lead = leads?.[0];
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    // Load active service locations (defines our operating area for the location check)
    const locations = await base44.asServiceRole.entities.Location.filter({ status: 'Active' });
    const marinaList = (locations || [])
      .map(l => [l.name, l.city].filter(Boolean).join(' — '))
      .filter(Boolean);
    const marinaContext = marinaList.length > 0
      ? marinaList.join('\n')
      : 'Istrien (Kroatien), slowenische Küste, Nord-Italien';

    // Build the lead context
    const leadContext = [
      lead.name ? `Name: ${lead.name}` : 'Name: (fehlt)',
      lead.email ? `E-Mail: ${lead.email}` : 'E-Mail: (fehlt)',
      lead.phone && lead.phone !== '+0' ? `Telefon: ${lead.phone}` : 'Telefon: (fehlt)',
      lead.boat_name ? `Boot: ${lead.boat_name}` : null,
      lead.boat_details ? `Bootsdaten: ${lead.boat_details}` : null,
      lead.location ? `Standort/Marina: ${lead.location}` : 'Standort/Marina: (fehlt)',
      lead.inquiry_type ? `Anfrage-Typ: ${lead.inquiry_type}` : null,
      lead.description ? `\nNachricht des Kunden:\n${lead.description}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `Du bist Assistent im Kundenservice von Alpha Yachting, einem Yacht-Service- und Reparaturbetrieb.
Alpha Yachting betreut Motor- und Segelyachten bis ca. 20m im Einsatzgebiet: istrische Küste (Kroatien), slowenische Küste und Nord-Italien.

UNSERE BEKANNTEN STANDORTE / MARINAS (Einsatzgebiet):
${marinaContext}

Deine Aufgabe: Prüfe den folgenden EINGEHENDEN LEAD strukturell auf Richtigkeit und Vollständigkeit und bereite ZWEI fertige E-Mail-Entwürfe vor.

LEAD-DATEN:
${leadContext}

PRÜFE DREI BEREICHE:
1. contact — Sind Kontaktdaten (Name, E-Mail, Telefon) vorhanden und plausibel? Fehlende/unplausible Angaben markieren.
2. boat — Sind die Boots-/Auftragsdaten konkret genug, um den Aufwand einzuschätzen (Bootstyp/Marke/Länge, Motor, konkrete Problembeschreibung)? Zu vage = "unclear".
3. location — Liegt der genannte Standort/die Marina in unserem Einsatzgebiet (siehe Liste oben / istrische & slowenische Küste, Nord-Italien)? Wenn kein Standort genannt → "missing". Wenn klar außerhalb → "unclear" mit Hinweis.

ERKENNE DIE SPRACHE des Leads (aus der Nachricht bzw. den Daten) und schreibe BEIDE E-Mail-Entwürfe in genau dieser Sprache (bei Unklarheit: Deutsch).

TON: freundlich-persönlich, höflich, mit "Sie" (bzw. der höflichen Anrede der jeweiligen Sprache). Nicht steif, sondern warm und zugewandt.

ENTWURF 1 — NACHFRAGE/VERIFIZIERUNG:
Eine E-Mail, die sich für die Anfrage bedankt und gezielt die fehlenden oder unklaren Informationen erfragt (nur das, was laut Prüfung wirklich fehlt), damit ein Angebot erstellt werden kann. Freundlich, konkret, kurz. Mit Grußformel "Ihr Team von Alpha Yachting".

ENTWURF 2 — HÖFLICHE ABSAGE:
Eine freundliche, wertschätzende Absage, dass der Auftrag derzeit leider nicht übernommen werden kann (z.B. aufgrund aktueller Auslastung / außerhalb des Einsatzgebiets / begrenzter Kapazität). Bedanke dich für das Interesse, formuliere die Absage bedauernd aber verbindlich, ohne konkrete interne Details preiszugeben. Mit Grußformel "Ihr Team von Alpha Yachting".

Gib NUR gültiges JSON zurück.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          language: { type: 'string', description: 'Erkannte Sprache, z.B. Deutsch, English, Italiano' },
          completeness: { type: 'string', enum: ['complete', 'incomplete', 'unclear'] },
          summary: { type: 'string', description: 'Kurze Zusammenfassung des Prüfergebnisses (1-2 Sätze)' },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                area: { type: 'string', enum: ['contact', 'boat', 'location'] },
                status: { type: 'string', enum: ['ok', 'missing', 'unclear'] },
                note: { type: 'string' },
              },
            },
          },
          missing_info: { type: 'array', items: { type: 'string' } },
          followup_subject: { type: 'string' },
          followup_body: { type: 'string' },
          rejection_subject: { type: 'string' },
          rejection_body: { type: 'string' },
        },
        required: ['completeness', 'summary', 'followup_subject', 'followup_body', 'rejection_subject', 'rejection_body'],
      },
    });

    const updatePayload = {
      screening_status: 'screened',
      screening_completeness: result.completeness || 'unclear',
      screening_language: result.language || '',
      screening_summary: result.summary || '',
      screening_checks: Array.isArray(result.checks) ? result.checks : [],
      screening_missing_info: Array.isArray(result.missing_info) ? result.missing_info : [],
      draft_followup_subject: result.followup_subject || '',
      draft_followup_body: result.followup_body || '',
      draft_rejection_subject: result.rejection_subject || '',
      draft_rejection_body: result.rejection_body || '',
      screened_at: new Date().toISOString(),
    };

    await base44.asServiceRole.entities.Lead.update(leadId, updatePayload);

    return Response.json({ success: true, lead_id: leadId, screening: updatePayload });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});