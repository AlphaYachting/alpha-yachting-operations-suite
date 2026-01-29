import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id, lead_description } = await req.json();
    const description = lead_description;

    if (!lead_id || !description) {
      return Response.json({ error: 'Missing lead_id or description' }, { status: 400 });
    }

    // Use AI to extract tasks from description/email/transcript
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a yacht service manager. Analyze this customer inquiry/email and extract actionable tasks needed to follow up and prepare an offer. 

Customer Inquiry:
${description}

Extract specific, concrete tasks that need to be done. For each task provide:
1. A clear title (max 10 words)
2. A brief description of what needs to be done
3. A category: Information, Inspection, Quote, Follow-up, Documentation, or Other

Return as JSON array with objects: { title, description, category }`,
      response_json_schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                category: { 
                  type: 'string',
                  enum: ['Information', 'Inspection', 'Quote', 'Follow-up', 'Documentation', 'Other']
                }
              }
            }
          }
        }
      }
    });

    // Save generated tasks to database
    const tasksToCreate = (response.tasks || []).map(task => ({
      lead_id,
      title: task.title,
      description: task.description,
      category: task.category,
      status: 'Pending',
      ai_generated: true
    }));

    if (tasksToCreate.length > 0) {
      await base44.entities.LeadTask.bulkCreate(tasksToCreate);
    }

    return Response.json({
      success: true,
      tasks_generated: tasksToCreate.length,
      tasks: tasksToCreate
    });
  } catch (error) {
    console.error('Error generating lead tasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});