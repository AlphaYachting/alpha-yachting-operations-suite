import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_SYSTEM_PROMPT = `Du bist ein Bootsservice-Angebots-Assistent für Alpha Yachting. Analysiere Serviceanfragen und erstelle strukturierte Angebots-Tasks.

Regeln:
- Wenn genug Infos vorhanden: response_type="tasks_ready", erstelle alle Tasks
- Wenn wichtige Infos fehlen: response_type="question", stelle max. 2 Fragen
- Trenne Labor (Verbtitel) und Material (Produktname) in separate Tasks
- Nutze realistische Stundensätze für Bootsservice (1-8h je nach Aufwand)
- Antworte immer auf Deutsch`;

const MAX_HISTORY = 6; // last 6 messages only

Deno.serve(async (req) => {
  const startTime = Date.now();
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

    console.log(`[AI] ===== NEW REQUEST =====`);
    console.log(`[AI] User: ${user.email}`);
    console.log(`[AI] Input: "${user_input}"`);
    console.log(`[AI] Language: ${language}`);
    console.log(`[AI] History messages: ${conversation_history.length}`);
    console.log(`[AI] Offer context: customer="${offer_details.customer_name || '-'}", boat="${offer_details.boat_name || '-'}"`);

    // Load custom system prompt
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let promptSource = 'default';
    try {
      const configs = await base44.asServiceRole.entities.AppConfiguration.filter({
        key: `OfferAIAssistantPrompt_${language}`
      });
      if (configs && configs.length > 0 && configs[0].value) {
        const raw = configs[0].value.trim();
        if (raw.length > MAX_PROMPT_CHARS) {
          console.warn(`[AI] Custom prompt TOO LONG: ${raw.length} chars → truncating to ${MAX_PROMPT_CHARS}`);
          systemPrompt = raw.substring(0, MAX_PROMPT_CHARS);
          promptSource = `custom_truncated(${raw.length}→${MAX_PROMPT_CHARS})`;
        } else {
          systemPrompt = raw;
          promptSource = `custom(${raw.length} chars)`;
        }
      } else {
        const fallback = await base44.asServiceRole.entities.AppConfiguration.filter({ key: 'OfferAIAssistantPrompt' });
        if (fallback && fallback.length > 0 && fallback[0].value) {
          const raw = fallback[0].value.trim();
          systemPrompt = raw.length > MAX_PROMPT_CHARS ? raw.substring(0, MAX_PROMPT_CHARS) : raw;
          promptSource = `fallback(${raw.length} chars)`;
        }
      }
    } catch (e) {
      console.warn('[AI] Could not load custom prompt, using default:', e.message);
    }
    console.log(`[AI] Prompt source: ${promptSource}`);

    // Load top knowledge base components (max 8, compact format)
    let knowledgeContext = '';
    try {
      const components = await base44.asServiceRole.entities.OfferTemplateComponent.filter(
        { is_active: true }, '-usage_count', 8
      );
      if (components && components.length > 0) {
        const list = components.map(c =>
          `${c.name}${c.item_type ? ` [${c.item_type}]` : ''}${c.base_price_eur ? ` €${c.base_price_eur}` : ''}`
        ).join(' | ');
        knowledgeContext = `\nReferenz-Services: ${list}`;
        console.log(`[AI] Knowledge base: ${components.length} components loaded`);
      } else {
        console.log(`[AI] Knowledge base: empty`);
      }
    } catch (e) {
      console.warn('[AI] Could not load knowledge base:', e.message);
    }

    // Build context — trim history to last MAX_HISTORY messages
    const trimmedHistory = conversation_history.slice(-MAX_HISTORY);
    const offerContext = (offer_details.customer_name || offer_details.boat_name)
      ? `\nKunde: ${offer_details.customer_name || '?'} | Boot: ${offer_details.boat_name || '?'}${offer_details.boat_details ? ` | ${offer_details.boat_details}` : ''}`
      : '';

    const historyText = trimmedHistory.length > 0
      ? '\nVerlauf:\n' + trimmedHistory.map(m =>
          `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
        ).join('\n')
      : '';

    const fullPrompt = `${systemPrompt}${knowledgeContext}${offerContext}${historyText}\n\nAnfrage: ${user_input}`;

    console.log(`[AI] Total prompt length: ${fullPrompt.length} chars`);
    console.log(`[AI] Calling LLM...`);

    const llmStart = Date.now();
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          response_type: {
            type: 'string',
            description: 'Either "question" (need more info) or "tasks_ready" (enough info to generate offer)'
          },
          message: {
            type: 'string',
            description: 'The assistant message shown to the user. Always in German. Never null or empty.'
          },
          tasks: {
            type: 'array',
            description: 'List of offer tasks. Only fill when response_type is tasks_ready.',
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
            description: 'Short professional offer intro for the client. Only when tasks_ready.'
          }
        },
        required: ['response_type', 'message']
      }
    });
    const llmMs = Date.now() - llmStart;

    console.log(`[AI] LLM responded in ${llmMs}ms`);
    console.log(`[AI] Raw response: ${JSON.stringify(response)}`);

    if (!response) {
      console.error('[AI] LLM returned null/undefined — prompt may still be too long or model overloaded');
      return Response.json({
        success: true,
        response_type: 'clarification',
        message: 'Entschuldigung, ich konnte die Anfrage nicht verarbeiten. Bitte vereinfachen Sie Ihre Eingabe.',
        tasks: [],
        client_description: '',
        suggested_components: []
      });
    }

    // Normalize response_type
    let responseType = (response.response_type || '').toLowerCase().trim();
    if (!['question', 'tasks_ready', 'clarification'].includes(responseType)) {
      if (responseType.includes('task') || responseType.includes('ready')) responseType = 'tasks_ready';
      else if (responseType.includes('question') || responseType.includes('frage')) responseType = 'question';
      else responseType = 'clarification';
    }

    const message = response.message || '(Keine Antwort vom Modell)';
    const tasks = response.tasks || [];

    console.log(`[AI] response_type: "${responseType}"`);
    console.log(`[AI] message: "${message}"`);
    console.log(`[AI] tasks count: ${tasks.length}`);
    tasks.forEach((t, i) => console.log(`[AI]   task[${i}]: ${t.title} | ${t.item_type} | qty:${t.quantity} x €${t.unit_price}`));
    console.log(`[AI] Total request time: ${Date.now() - startTime}ms`);

    return Response.json({
      success: true,
      response_type: responseType,
      message,
      tasks,
      client_description: response.client_description || '',
      suggested_components: [],
      _debug: {
        prompt_source: promptSource,
        prompt_length: fullPrompt.length,
        llm_ms: llmMs,
        total_ms: Date.now() - startTime,
        history_used: trimmedHistory.length
      }
    });

  } catch (error) {
    console.error('[AI] FATAL ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});