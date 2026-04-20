import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { offer_id } = await req.json();
    if (!offer_id) return Response.json({ error: 'offer_id required' }, { status: 400 });

    // Fetch all tasks directly from DB - always fresh, always real IDs
    const tasks = await base44.entities.OfferTask.filter({ offer_id });
    const toTranslate = tasks.filter(t =>
      !t.is_optional &&
      t.item_type !== 'Chapter' &&
      !(t.title_hr && t.title_hr.trim())
    );

    if (toTranslate.length === 0) {
      return Response.json({ success: true, translated: 0, message: 'Alle bereits übersetzt' });
    }

    let translated = 0;
    const errors = [];

    for (const task of toTranslate) {
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Translate this yacht service/product title to Croatian. Return ONLY the Croatian translation, nothing else: "${task.title}"`,
        });
        const hrTitle = (typeof result === 'string' ? result : '').trim().replace(/^[".]|[".]$/g, '');
        if (hrTitle) {
          await base44.entities.OfferTask.update(task.id, { title_hr: hrTitle });
          translated++;
        }
      } catch (e) {
        errors.push({ id: task.id, title: task.title, error: e.message });
      }
    }

    return Response.json({
      success: true,
      translated,
      total: toTranslate.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});