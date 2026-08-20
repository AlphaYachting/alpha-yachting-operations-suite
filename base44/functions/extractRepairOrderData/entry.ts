import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_urls = [], current_data = {}, user_message = '', chat_history = [] } = body;

    // Schema of the fields the AI should try to fill from documents + conversation
    const responseSchema = {
      type: "object",
      properties: {
        assistant_message: {
          type: "string",
          description: "A short, friendly reply in German to the user summarizing what was extracted or asking for missing key info."
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
            work_description: { type: "string" },
            work_categories: {
              type: "array",
              items: { type: "string" }
            },
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
            trailer_on_arrival: { type: "boolean", description: "Eigener Trailer vorhanden / Boot kommt am Anhänger" },
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
              description: "Nur exakt diese Werte: Bootsreinigung außen, Bootsreinigung innen, Motor-Konservierung / Einwinterung, Batterie ausbauen / laden / prüfen, Batterieservice während der Lagerzeit, Kontrolle von Bilge / Feuchtigkeit, Abdeckung / Plane montieren, Antifouling prüfen / Angebot erstellen, Politur / Pflegearbeiten, Motorservice / Wartung, Sonstige Arbeiten gemäß separatem Angebot"
            },
            storage_services_notes: {
              type: "string",
              description: "Strukturierte Liste weiterer Service-/Zusatzaufträge, die nicht in der Standardliste storage_services enthalten sind. Jede Position in einer eigenen Zeile im Format '- Beschreibung (Menge/Details)'. Bereits vorhandene Positionen aus current_data.storage_services_notes müssen unverändert übernommen und die neuen Positionen ergänzt werden."
            },
            work_description_append: {
              type: "string",
              description: "Nur bei Reparaturauftrag: neue gewünschte Arbeiten als strukturierte Liste, jede Position in eigener Zeile im Format '- Beschreibung'."
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

    const prompt = `Du bist ein Assistent für Alpha Yachting, der beim Ausfüllen eines Reparaturauftrags hilft.
Du erhältst ggf. hochgeladene Dokumente (Zulassungsschein/Bootspapiere, Ausweis/Personaldokument, bestehende Angebote/Kostenvoranschläge) und eine Nachricht des Nutzers.

Bereits erfasste Daten (nicht überschreiben, wenn du nichts Besseres findest):
${JSON.stringify(current_data, null, 2)}

Bisheriger Gesprächsverlauf:
${historyText || '(noch kein Verlauf)'}

Neue Nachricht des Nutzers:
"${user_message || '(keine Nachricht, nur Dokumente)'}"

Aufgaben:
1. Lies alle beigefügten Dokumente sorgfältig aus.
2. Aus Zulassungsschein/Bootspapieren: Bootstyp/Modell, Bootsname, Baujahr, amtl. Kennzeichen, HIN-Nr., Länge, Motor, Leistung.
3. Aus Ausweis/Personaldokument: Name, Adresse des Kunden.
4. Aus Angeboten/Kostenvoranschlägen: Positionen (Beschreibung, Menge, Preis) und Stundensatz.
5. Extrahiere alle gefundenen Felder. Felder, die du nicht findest, lass leer/weg.
6. Ordne gewünschte Arbeiten den Kategorien zu (nur exakt diese Werte verwenden): "Motor / Antrieb", "Elektrik / Elektronik", "Rumpf / Gelcoat", "Osmose / Unterwasserschiff", "Antifouling", "Rigg / Segel", "Winterlager / Konservierung", "Kranung / Transport", "Anhänger".
7. WICHTIG: Wenn es um eine Einlagerung / Winterlagerung / einen Einlagerungsvertrag geht (order_type "storage" in den erfassten Daten oder aus dem Gespräch erkennbar), extrahiere zusätzlich die Einlagerungsfelder: storage_interval, storage_start_date, storage_end_date, storage_under_roof, storage_location, storage_price, storage_billing_type, storage_services (Zusatzleistungen), trailer_on_arrival, boat_beam_m, boat_draft_m, boat_value, Versicherungsdaten (insurance_company, insurance_policy_number) und customer_tax_id.
8. ZUSATZLEISTUNGEN / SERVICEAUFTRÄGE: Wenn der Nutzer zusätzliche Servicearbeiten nennt (z.B. "Bitte auch Motor warten und Batterie prüfen"), dann:
   a) Ordne jede Arbeit, wenn möglich, exakt einem Wert aus der Standardliste storage_services zu und gib alle passenden Werte (inkl. der bereits in current_data.storage_services vorhandenen) zurück.
   b) Alle Arbeiten, die zu keinem Standardwert passen, kommen in storage_services_notes als strukturierte Liste: jede Position in einer eigenen Zeile, beginnend mit "- ", mit Menge/Details in Klammern falls genannt. Übernimm dabei die bereits vorhandenen Zeilen aus current_data.storage_services_notes unverändert und ergänze nur die neuen. Nie Freitext-Absätze, immer Listenzeilen.
   c) Bei einem Reparaturauftrag (order_type "repair") liefere neue gewünschte Arbeiten stattdessen als Listenzeilen in work_description_append.
9. Antworte im Feld assistant_message auf Deutsch, freundlich und kurz: fasse zusammen, was du erkannt hast, und frage nach den wichtigsten noch fehlenden Angaben (z.B. Kundenadresse, gewünschte Arbeiten bzw. bei Einlagerung: Zeitraum, Preis, Zusatzleistungen).`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: file_urls.length > 0 ? file_urls : undefined,
      response_json_schema: responseSchema,
      model: file_urls.length > 0 ? "claude_sonnet_4_6" : "automatic"
    });

    // Some models return the structured output directly, others wrap it in a
    // "response" field (as an object OR as a JSON string). Normalize all cases
    // so the frontend always receives flat { assistant_message, extracted }.
    let normalized = result;
    if (result && typeof result === 'object' && result.response !== undefined) {
      normalized = result.response;
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

    // Some models put the entire JSON payload (including the real "extracted")
    // inside assistant_message as a string. Detect and unwrap that too.
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

    return Response.json({ success: true, ...normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});