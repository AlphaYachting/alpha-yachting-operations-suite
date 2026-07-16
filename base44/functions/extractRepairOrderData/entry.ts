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
            hourly_rate: { type: "number" }
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
7. Antworte im Feld assistant_message auf Deutsch, freundlich und kurz: fasse zusammen, was du erkannt hast, und frage nach den wichtigsten noch fehlenden Angaben (z.B. Kundenadresse, gewünschte Arbeiten).`;

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