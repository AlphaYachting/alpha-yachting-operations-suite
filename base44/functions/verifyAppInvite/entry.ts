import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, action } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Use service role to find invite (no auth required)
    const invites = await base44.asServiceRole.entities.AppInvite.filter({ token_hash });

    if (!invites || invites.length === 0) {
      return Response.json({ valid: false, error: 'Invalid or expired invite link' }, { status: 200 });
    }

    const invite = invites[0];

    // Check status
    if (invite.status === 'REVOKED') {
      return Response.json({ valid: false, error: 'This invite has been revoked' });
    }

    if (invite.status === 'ACCEPTED') {
      return Response.json({ valid: false, already_accepted: true, role: invite.role, error: 'This invite has already been used' });
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      await base44.asServiceRole.entities.AppInvite.update(invite.id, { status: 'EXPIRED' });
      return Response.json({ valid: false, error: 'This invite link has expired' });
    }

    // If action is 'open' — mark as opened
    if (action === 'open' && invite.status !== 'OPENED') {
      await base44.asServiceRole.entities.AppInvite.update(invite.id, {
        status: 'OPENED',
        opened_at: new Date().toISOString()
      });
    }

    // If action is 'accept' — mark as accepted and return role
    if (action === 'accept') {
      // Verify user is authenticated
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      // SECURITY: Ensure the logged-in user's email matches the invite email
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        return Response.json({ 
          valid: false, 
          error: 'Diese Einladung gilt nur für ' + invite.email + '. Bitte melden Sie sich mit der richtigen E-Mail-Adresse an.' 
        }, { status: 403 });
      }

      await base44.asServiceRole.entities.AppInvite.update(invite.id, {
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString()
      });

      // Set user role
      const roleToSet = invite.role === 'CUSTOMER' ? 'customer' : 'technician';
      await base44.auth.updateMe({ role: roleToSet });

      return Response.json({ success: true, role: invite.role });
    }

    return Response.json({ valid: true, role: invite.role, invite_id: invite.id, invite_email: invite.email });

  } catch (error) {
    console.error('verifyAppInvite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});