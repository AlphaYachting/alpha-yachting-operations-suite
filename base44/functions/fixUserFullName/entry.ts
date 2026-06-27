import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// One-time helper: if the logged-in user has no space in full_name,
// try to update it from their linked Technician record.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only act if full_name has no space (email-username pattern like "panger.v")
    if (user.full_name && user.full_name.includes(' ')) {
      return Response.json({ ok: true, message: 'full_name already has space', full_name: user.full_name });
    }

    // Look up the linked Technician record
    const techs = await base44.asServiceRole.entities.Technician.filter({
      $or: [{ user_id: user.id }, { email: user.email }]
    });

    let newName = null;
    if (techs?.[0]) {
      const t = techs[0];
      const candidate = [t.first_name?.trim(), t.last_name?.trim()].filter(Boolean).join(' ');
      if (candidate && candidate.includes(' ')) {
        newName = candidate;
      }
    }

    // Fallback: split email username at dot and capitalize
    if (!newName && user.email) {
      const localPart = user.email.split('@')[0]; // e.g. "panger.v"
      const parts = localPart.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1));
      if (parts.length >= 2) {
        newName = parts.join(' '); // e.g. "Panger V"
      }
    }

    if (!newName) {
      return Response.json({ ok: false, message: 'Could not derive a proper full_name' });
    }

    await base44.auth.updateMe({ full_name: newName });
    return Response.json({ ok: true, full_name: newName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});