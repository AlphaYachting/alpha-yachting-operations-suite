import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_SYSTEM_PROMPT = `Du bist ein Bootsservice-Angebots-Assistent für Alpha Yachting. Analysiere Serviceanfragen und erstelle strukturierte Angebots-Tasks.

Regeln:
- Wenn genug Infos vorhanden: response_type="tasks_ready", erstelle alle Tasks
- Wenn wichtige Infos fehlen: response_type="question", stelle max. 2 Fragen
- Trenne Labor (Verbtitel) und Material (Produktname) in separate Tasks
- Nutze realistische Stundensätze für Bootsservice (1-8h je nach Aufwand)
- Antworte immer auf Deutsch`;

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
        const raw = configs[0].value;
        if (raw.length > 4000) {
          console.warn(`[AI Assistant] Custom prompt too long (${raw.length} chars), truncating to 4000.`);
          systemPrompt = raw.substring(0, 4000);
        } else {
          systemPrompt = raw;
        }
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
        5  // Only top 5 to keep prompt short
      );
      console.log('[AI Assistant] Knowledge base components loaded:', components?.length || 0);
      if (components && components.length > 0) {
        const componentList = components.map(c => `- ${c.name}${c.base_price_eur ? ` €${c.base_price_eur}` : ''}`).join('\n');
        knowledgeContext = `\nReferenz:\n${componentList}`;
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

    const offerContext = (offer_details.customer_name || offer_details.boat_name)
      ? `\nKunde: ${offer_details.customer_name || ''}, Boot: ${offer_details.boat_name || ''} ${offer_details.boat_details || ''}`
      : '';

    const historyText = conversation_history.length > 0
      ? '\nVerlauf:\n' + conversation_history.map(m =>
          `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
        ).join('\n')
      : '';

    const fullPrompt = `${systemPrompt}${knowledgeContext}${offerContext}${historyText}

Anfrage: ${user_input}`;

    console.log('[AI Assistant] History length:', conversation_history.length);
    console.log('[AI Assistant] Offer context:', JSON.stringify(offer_details));
    console.log('[AI Assistant] System prompt length:', systemPrompt.length);
    console.log('[AI Assistant] Full prompt length:', fullPrompt.length);
    console.log('[AI Assistant] System prompt preview (first 300 chars):', systemPrompt.substring(0, 300));

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