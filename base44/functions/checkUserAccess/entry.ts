import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SECURITY GATE: Checks if the authenticated user is allowed to access the app.
 * A user is allowed if they:
 *   1. Are an admin (always allowed)
 *   2. Have an accepted AppInvite matching their email
 *
 * This is a second line of defense — the primary control is Base44 App Visibility = Private.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ allowed: false, reason: 'not_authenticated' }, { status: 401 });
    }

    // Admins always have access
    if (user.role === 'admin') {
      return Response.json({ allowed: true, role: user.role });
    }

    // Check for accepted invite matching this email (case-insensitive)
    // Filter directly by email to avoid pagination issues with large invite lists
    const invites = await base44.asServiceRole.entities.AppInvite.filter({
      status: 'ACCEPTED',
      email: user.email
    });
    const hasAccess = invites && invites.length > 0;

    if (hasAccess) {
      return Response.json({ allowed: true, role: user.role });
    }

    // No accepted invite found — deny access
    console.warn(`[checkUserAccess] DENIED: ${user.email} (role: ${user.role}) — no accepted invite found`);
    return Response.json({ 
      allowed: false, 
      reason: 'no_invite',
      message: 'Kein gültiger Zugang. Bitte kontaktieren Sie Alpha Yachting für eine Einladung.'
    });

  } catch (error) {
    console.error('[checkUserAccess] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});