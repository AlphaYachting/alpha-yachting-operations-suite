import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_SYSTEM_PROMPT = `Du bist ein erfahrener Meerestechnik-Spezialist und Angebotsersteller für eine professionelle Bootsservicefirma (Alpha Yachting).

Deine Aufgabe ist es, durch ein strukturiertes Gespräch alle notwendigen Informationen zu sammeln, um ein vollständiges, professionelles Serviceangebot zu erstellen.

## DEINE ROLLE
- Analysiere Kundenbeschreibungen, Gesprächsnotizen oder Transkripte von Serviceanfragen.
- Stelle gezielte Rückfragen, wenn wichtige Informationen fehlen.
- Generiere am Ende strukturierte Angebotstasks (Labor + Material getrennt).

## FEHLENDE INFORMATIONEN PRÜFEN
Bevor du Tasks generierst, stelle sicher, dass du folgendes weißt:
1. Bootstyp, Hersteller, Modell und Länge (falls relevant)
2. Motorentyp und -modell (für Motorarbeiten)
3. Art und Umfang der gewünschten Arbeit
4. Besondere Kundenwünsche oder Einschränkungen

## TASK-GENERIERUNG REGELN (WICHTIG)
Wenn du genug Informationen hast (response_type = "tasks_ready"):
- Trenne IMMER Material von Arbeitsleistung in separate Tasks
- Material-Tasks: Nur Produktname als Titel (keine Verben)
- Labor-Tasks: Aktionsbeschreibung als Titel (mit Verb)
- Verwende realistische Stundenansätze für Bootsservice

## ANTWORTFORMAT
Antworte IMMER im angegebenen JSON-Format. Stelle maximal 2 Rückfragen auf einmal.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_input, conversation_history = [], offer_details = {}, language = 'German' } = await req.json();

    if (!user_input || !user_input.trim()) {
      return Response.json({ error: 'user_input is required' }, { status: 400 });
    }

    // Load custom system prompt from AppConfiguration, fallback to default
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    try {
      const configs = await base44.asServiceRole.entities.AppConfiguration.filter({
        key: `OfferAIAssistantPrompt_${language}`
      });
      if (configs && configs.length > 0 && configs[0].value) {
        systemPrompt = configs[0].value;
      } else {
        // Try language-neutral fallback
        const fallbackConfigs = await base44.asServiceRole.entities.AppConfiguration.filter({
          key: 'OfferAIAssistantPrompt'
        });
        if (fallbackConfigs && fallbackConfigs.length > 0 && fallbackConfigs[0].value) {
          systemPrompt = fallbackConfigs[0].value;
        }
      }
    } catch (e) {
      console.log('Could not load custom prompt, using default:', e.message);
    }

    // Load relevant OfferTemplateComponents as context for the AI
    let knowledgeContext = '';
    try {
      const components = await base44.asServiceRole.entities.OfferTemplateComponent.filter(
        { is_active: true },
        '-usage_count',
        20
      );
      if (components && components.length > 0) {
        const componentList = components.map(c =>
          `- ${c.name} (${c.category}, ${c.item_type}): ${c.description || ''} — ${c.base_price_eur ? `€${c.base_price_eur}/${c.unit_type || 'Std'}` : 'Preis variabel'}`
        ).join('\n');
        knowledgeContext = `\n\n## BEKANNTE SERVICELEISTUNGEN AUS UNSERER WISSENSDATENBANK\nNutze diese als Referenz für Preise und Beschreibungen:\n${componentList}`;
      }
    } catch (e) {
      console.log('Could not load knowledge base:', e.message);
    }

    // Build conversation context
    const languageMap = {
      'German': 'Deutsch',
      'English': 'English',
      'Italian': 'Italiano',
      'Slovenian': 'Slovenščina',
      'Croatian': 'Hrvatski'
    };

    const offerContext = offer_details.customer_name || offer_details.boat_name
      ? `\n\n## ANGEBOTS-KONTEXT\nKunde: ${offer_details.customer_name || 'Unbekannt'}\nBoot: ${offer_details.boat_name || 'Unbekannt'}\n${offer_details.boat_details || ''}`
      : '';

    const historyText = conversation_history.length > 0
      ? '\n\n## BISHERIGER GESPRÄCHSVERLAUF\n' + conversation_history.map(m =>
          `${m.role === 'user' ? 'Kunde/Nutzer' : 'Assistent'}: ${m.content}`
        ).join('\n')
      : '';

    const fullPrompt = `${systemPrompt}${knowledgeContext}${offerContext}${historyText}

## AKTUELLE NACHRICHT
${user_input}

## ANTWORTANWEISUNG
Antworte auf ${languageMap[language] || 'Deutsch'}. Analysiere die Anfrage und entscheide:
- Wenn mehr Informationen benötigt werden: response_type = "question"
- Wenn du genug weißt für ein vollständiges Angebot: response_type = "tasks_ready"
- Bei Unklarheiten: response_type = "clarification"

Wichtig: Wenn response_type = "tasks_ready", generiere ALLE Tasks (Labor + Material getrennt).`;

    console.log('[AI Assistant] Sending prompt to LLM, length:', fullPrompt.length);
    console.log('[AI Assistant] Offer context:', JSON.stringify(offer_details));
    console.log('[AI Assistant] History length:', conversation_history.length);

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          response_type: {
            type: 'string',
            description: 'Either "question" (need more info), "tasks_ready" (enough info to generate offer), or "clarification"'
          },
          message: {
            type: 'string',
            description: 'The assistant message shown to the user. Always required, never null.'
          },
          tasks: {
            type: 'array',
            description: 'List of offer tasks. Only fill this when response_type is tasks_ready.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                item_type: { type: 'string', description: 'Labor or Material' },
                unit_type: { type: 'string', description: 'Hour, Piece, Liter, etc.' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' }
              }
            }
          },
          client_description: {
            type: 'string',
            description: 'Short professional offer intro text for the client. Only when tasks_ready.'
          }
        },
        required: ['response_type', 'message']
      }
    });

    console.log('[AI Assistant] Raw LLM response:', JSON.stringify(response));

    // Normalize response_type
    const validTypes = ['question', 'tasks_ready', 'clarification'];
    let responseType = (response.response_type || '').toLowerCase();
    if (!validTypes.includes(responseType)) {
      if (responseType.includes('task') || responseType.includes('ready')) responseType = 'tasks_ready';
      else if (responseType.includes('question')) responseType = 'question';
      else responseType = 'clarification';
    }

    const message = response.message || response.text || response.assistant_message || '(Keine Antwort vom Modell erhalten)';

    console.log('[AI Assistant] Normalized response_type:', responseType);
    console.log('[AI Assistant] Message:', message);
    console.log('[AI Assistant] Tasks count:', (response.tasks || []).length);

    return Response.json({
      success: true,
      response_type: responseType,
      message: message,
      tasks: response.tasks || [],
      client_description: response.client_description || '',
      suggested_components: []
    });

  } catch (error) {
    console.error('processOfferAssistantInteraction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});