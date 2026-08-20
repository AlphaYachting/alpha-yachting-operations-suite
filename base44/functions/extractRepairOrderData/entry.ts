import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const STORAGE_SERVICES = [
  'Bootsreinigung außen',
  'Bootsreinigung innen',
  'Motor-Konservierung / Einwinterung',
  'Batterie ausbauen / laden / prüfen',
  'Batterieservice während der Lagerzeit',
  'Kontrolle von Bilge / Feuchtigkeit',
  'Abdeckung / Plane montieren',
  'Antifouling prüfen / Angebot erstellen',
  'Politur / Pflegearbeiten',
  'Motorservice / Wartung',
  'Sonstige Arbeiten gemäß separatem Angebot'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_urls = [], current_data = {}, user_message = '', chat_history = [] } = body;
    const isStorage = current_data?.order_type === 'storage';

    const responseSchema = {
      type: "object",
      properties: {
        assistant_message: {
          type: "string",
          description: "Kurze, freundliche Antwort auf Deutsch: was übernommen wurde. Fehlende Angaben höchstens in einem kurzen Nebensatz erwähnen und ausdrücklich als optional/später nachtragbar kennzeichnen. Niemals nach der Adresse drängen."
        },
        extracted: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            customer_address: { type: "string" },
            customer_phone: { type: "string" },
            customer_email: { type: "string" },
            boat_type_model: { type: "string" },
            boat_name: { type: "string" },
            boat_year: { type: "string" },
            boat_registration: { type: "string" },
            boat_hin: { type: "string" },
            boat_length_m: { type: "number" },
            boat_location: { type: "string" },
            engine_make_type: { type: "string" },
            engine_power: { type: "string" },
            engine_hours: { type: "string" },
            work_categories: { type: "array", items: { type: "string" } },
            positions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "string" },
                  price: { type: "number" }
                }
              }
            },
            hourly_rate: { type: "number" },
            customer_tax_id: { type: "string", description: "OIB / Steuernummer / VAT-ID" },
            boat_beam_m: { type: "number" },
            boat_draft_m: { type: "number" },
            boat_value: { type: "string" },
            trailer_on_arrival: { type: "boolean" },
            trailer_type: { type: "string" },
            trailer_registration: { type: "string" },
            storage_interval: { type: "string", description: "Nur exakt: Täglich | Wöchentlich | Monatlich | Jährlich | Winterlagerung / Saisonlagerung | Sonstiges" },
            storage_start_date: { type: "string", description: "YYYY-MM-DD" },
            storage_end_date: { type: "string", description: "YYYY-MM-DD" },
            storage_under_roof: { type: "string", description: "Nur exakt: Ja | Nein | Nach Verfügbarkeit" },
            storage_location: { type: "string" },
            storage_price: { type: "number" },
            storage_billing_type: { type: "string", description: "Nur exakt: Pro Tag | Pro Woche | Pro Monat | Pro Jahr / Saison | Pauschalpreis" },
            storage_services: {
              type: "array",
              items: { type: "string" },
              description: `Nur exakt diese Werte: ${STORAGE_SERVICES.join(', ')}`
            },
            storage_services_notes_append: {
              type: "string",
              description: "NEUE Zusatz-/Servicearbeiten, die zu keinem Standardwert von storage_services passen. Strukturierte Liste: jede Position in eigener Zeile, beginnend mit '- ', Menge/Details in Klammern. Nur die NEUEN Positionen, keine bereits erfassten."
            },
            work_description_append: {
              type: "string",
              description: "NEUE gewünschte Reparatur-/Servicearbeiten als strukturierte Liste, jede Position in eigener Zeile beginnend mit '- '. Nur bei Reparaturauftrag verwenden."
            },
            special_agreements_append: {
              type: "string",
              description: "NEUE besondere Vereinbarungen / Absprachen (z.B. Zugangsregelungen, Sonderwünsche, Fristen) als strukturierte Liste, jede Zeile beginnend mit '- '."
            },
            insurance_company: { type: "string" },
            insurance_policy_number: { type: "string" }
          }
        }
      },
      required: ["assistant_message", "extracted"]
    };

    const historyText = (chat_history || [])
      .map((m: any) => `${m.role === 'user' ? 'Nutzer' : 'Assistent'}: ${m.content}`)
      .join('\n');

    const prompt = `Du bist ein Assistent für Alpha Yachting, der beim Ausfüllen eines ${isStorage ? 'Einlagerungsvertrags (Einlagerung/Winterlagerung)' : 'Reparaturauftrags'} hilft.
Du erhältst ggf. hochgeladene Dokumente (Zulassungsschein/Bootspapiere, Ausweis, Angebote) und eine Nachricht des Nutzers.

Bereits erfasste Daten (nicht überschreiben, wenn du nichts Besseres findest):
${JSON.stringify(current_data, null, 2)}

Bisheriger Gesprächsverlauf:
${historyText || '(noch kein Verlauf)'}

Neue Nachricht des Nutzers:
"${user_message || '(keine Nachricht, nur Dokumente)'}"

Regeln:
1. Lies alle beigefügten Dokumente aus: Bootsdaten (Typ/Modell, Name, Baujahr, Kennzeichen, HIN, Länge/Breite/Tiefgang, Motor, Leistung), Kundendaten, Positionen/Stundensatz aus Angeboten.
2. Felder, die du nicht findest, LASS KOMPLETT WEG. Gib niemals leere Strings oder 0 zurück.
3. JEDE inhaltliche Information aus der Nachricht MUSS in einem Feld landen — nichts darf verloren gehen:
   - Genannte Zusatz-/Servicearbeiten: passende Werte exakt aus dieser Liste in storage_services: ${STORAGE_SERVICES.join(' | ')}.
   - Alle Arbeiten, die zu keinem dieser Werte passen, gehören in storage_services_notes_append${isStorage ? '' : ' bzw. bei Reparaturauftrag in work_description_append'} — als Listenzeilen, jede beginnend mit "- ".
   - Absprachen, Bedingungen, Sonderwünsche (z.B. Zugang, Fristen, Haftung, Zahlungsdetails) gehören in special_agreements_append — ebenfalls als Listenzeilen mit "- ".
   - Gib in den *_append-Feldern NUR die neuen Positionen zurück, nicht die bereits in den erfassten Daten vorhandenen. Nie Freitext-Absätze, immer Listenzeilen.
4. Ordne Arbeiten zusätzlich diesen Kategorien zu (nur exakt): "Motor / Antrieb", "Elektrik / Elektronik", "Rumpf / Gelcoat", "Osmose / Unterwasserschiff", "Antifouling", "Rigg / Segel", "Winterlager / Konservierung", "Kranung / Transport", "Anhänger".
5. Bei Einlagerung zusätzlich: storage_interval, storage_start_date, storage_end_date, storage_under_roof, storage_location, storage_price, storage_billing_type, trailer_on_arrival, Versicherungsdaten, customer_tax_id.
6. assistant_message: kurz auf Deutsch bestätigen, was du in welche Liste übernommen hast. Frage NICHT nach der Adresse oder anderen Stammdaten — diese können jederzeit später ergänzt werden. Höchstens ein kurzer Hinweis, welche Angaben für den Vertrag noch nützlich wären (optional).`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: file_urls.length > 0 ? file_urls : undefined,
      response_json_schema: responseSchema,
      model: file_urls.length > 0 ? "claude_sonnet_4_6" : "automatic"
    });

    let normalized: any = result;
    if (result && typeof result === 'object' && (result as any).response !== undefined) {
      normalized = (result as any).response;
    }
    if (typeof normalized === 'string') {
      try {
        normalized = JSON.parse(normalized);
      } catch (_e) {
        normalized = { assistant_message: normalized, extracted: {} };
      }
    }
    if (!normalized || typeof normalized !== 'object') {
      normalized = { assistant_message: '', extracted: {} };
    }

    const hasExtracted = normalized.extracted && typeof normalized.extracted === 'object'
      && Object.keys(normalized.extracted).length > 0;
    if (!hasExtracted && typeof normalized.assistant_message === 'string'
        && normalized.assistant_message.trim().startsWith('{')) {
      try {
        const inner = JSON.parse(normalized.assistant_message);
        if (inner && typeof inner === 'object') {
          normalized = { ...normalized, ...inner };
        }
      } catch (_e) {
        // leave as-is
      }
    }

    // Strip placeholder values some models emit instead of omitting fields
    const PLACEHOLDERS = ['nicht angegeben', 'unbekannt', 'n/a', 'k.a.', 'keine angabe', '-', '–'];
    if (normalized.extracted && typeof normalized.extracted === 'object') {
      for (const [k, v] of Object.entries(normalized.extracted)) {
        if (typeof v === 'string' && PLACEHOLDERS.includes(v.trim().toLowerCase())) {
          delete normalized.extracted[k];
        }
      }
    }

    return Response.json({ success: true, ...normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});