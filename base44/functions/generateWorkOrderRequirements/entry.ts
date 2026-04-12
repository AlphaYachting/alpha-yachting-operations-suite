import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { work_order_id } = await req.json();

    if (!work_order_id) {
      return Response.json({ error: 'Missing work_order_id' }, { status: 400 });
    }

    // Load work order and related data
    const workOrders = await base44.entities.WorkOrder.filter({ id: work_order_id });
    if (!workOrders || workOrders.length === 0) {
      return Response.json({ error: 'Work order not found' }, { status: 404 });
    }

    const workOrder = workOrders[0];

    // Load related data
    const [tasks, job, boat] = await Promise.all([
      base44.entities.Task.filter({ work_order_id }),
      workOrder.job_id ? base44.entities.Job.filter({ id: workOrder.job_id }).then(jobs => jobs[0]) : null,
      workOrder.job_id ? base44.entities.Job.filter({ id: workOrder.job_id })
        .then(async (jobs) => {
          if (jobs && jobs[0]?.boat_id) {
            const boats = await base44.entities.Boat.filter({ id: jobs[0].boat_id });
            return boats[0];
          }
          return null;
        }) : null
    ]);

    // Build context for AI
    let contextText = `Work Order: ${workOrder.title}\n`;
    contextText += `Description: ${workOrder.description}\n\n`;

    if (tasks && tasks.length > 0) {
      contextText += `Tasks:\n`;
      tasks.forEach((task, idx) => {
        contextText += `${idx + 1}. ${task.title}`;
        if (task.description) contextText += ` - ${task.description}`;
        if (task.notes) contextText += ` (Notes: ${task.notes})`;
        contextText += `\n`;
      });
      contextText += `\n`;
    }

    if (boat) {
      contextText += `Boat: ${boat.vessel_name || 'Unknown'}`;
      if (boat.manufacturer) contextText += ` ${boat.manufacturer}`;
      if (boat.model) contextText += ` ${boat.model}`;
      if (boat.engine_manufacturer) contextText += ` | Engine: ${boat.engine_manufacturer}`;
      if (boat.engine_model) contextText += ` ${boat.engine_model}`;
      contextText += `\n`;
    }

    // Call AI for requirements
    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a yacht service expert. Analyze this work order and generate a comprehensive requirements checklist.

${contextText}

Generate a list of requirements needed to complete this work. For each item provide:
1. type: SparePart (replacement parts), Material (consumables), Tool (equipment), Vehicle (transport), or Other
2. name: clear, specific name
3. quantity: realistic number (especially for SpareParts - usually 1-2 pcs unless context suggests more)
4. unit: pcs, l, m, kg, set, box, roll, meter
5. priority: High (critical), Medium (important), Low (nice to have)
6. procurement_status: 
   - ToOrder: for SpareParts that need ordering
   - Available: for common tools/materials
   - NeedsClarification: if quantity/spec is unclear
7. notes: brief explanation, assumptions, or clarifications

IMPORTANT:
- Prioritize SpareParts (replacement components, wearing parts)
- Always suggest realistic quantities for SpareParts (default 1-2 unless job clearly needs more)
- For common items like oil, filters, sealant - suggest practical quantities
- If unsure about specs, set procurement_status to NeedsClarification with notes
- Include specialized tools if job requires them

Return JSON array of requirement items.`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { 
                  type: 'string',
                  enum: ['SparePart', 'Material', 'Tool', 'Vehicle', 'Other']
                },
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { 
                  type: 'string',
                  enum: ['pcs', 'l', 'm', 'kg', 'set', 'box', 'roll', 'meter']
                },
                priority: {
                  type: 'string',
                  enum: ['High', 'Medium', 'Low']
                },
                procurement_status: {
                  type: 'string',
                  enum: ['NeedsClarification', 'ToOrder', 'Ordered', 'Available', 'Packed', 'NotNeeded']
                },
                notes: { type: 'string' }
              },
              required: ['type', 'name', 'quantity', 'unit', 'priority', 'procurement_status']
            }
          }
        }
      }
    });

    // Create or update requirement list
    let requirementList = await base44.entities.WorkOrderRequirementList.filter({ work_order_id });
    
    if (!requirementList || requirementList.length === 0) {
      requirementList = await base44.asServiceRole.entities.WorkOrderRequirementList.create({
        work_order_id,
        status: 'Draft',
        ai_generated_at: new Date().toISOString(),
        ai_generation_version: 'v1-yacht-service-2026'
      });
    } else {
      requirementList = requirementList[0];
      // Update AI generation timestamp
      await base44.asServiceRole.entities.WorkOrderRequirementList.update(requirementList.id, {
        ai_generated_at: new Date().toISOString(),
        ai_generation_version: 'v1-yacht-service-2026'
      });
    }

    // Create requirement items
    const itemsToCreate = (aiResponse.items || []).map(item => ({
      requirement_list_id: requirementList.id,
      work_order_id,
      type: item.type,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      priority: item.priority,
      procurement_status: item.procurement_status,
      checklist_state: 'Missing',
      checked: false,
      notes: item.notes || '',
      origin: 'AI'
    }));

    if (itemsToCreate.length > 0) {
      await base44.asServiceRole.entities.WorkOrderRequirementItem.bulkCreate(itemsToCreate);
    }

    return Response.json({
      success: true,
      requirement_list_id: requirementList.id,
      items_generated: itemsToCreate.length,
      items: itemsToCreate
    });

  } catch (error) {
    console.error('Error generating work order requirements:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});