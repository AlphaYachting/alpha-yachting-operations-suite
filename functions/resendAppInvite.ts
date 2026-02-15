import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { invite_id } = await req.json();

    if (!invite_id) {
      return Response.json({ error: 'invite_id is required' }, { status: 400 });
    }

    // Get invite
    const invites = await base44.asServiceRole.entities.AppInvite.filter({ id: invite_id });
    if (!invites || invites.length === 0) {
      return Response.json({ error: 'Invite not found' }, { status: 404 });
    }

    const invite = invites[0];

    // Check if already accepted or revoked
    if (invite.status === 'ACCEPTED') {
      return Response.json({ error: 'Invite already accepted' }, { status: 400 });
    }
    if (invite.status === 'REVOKED') {
      return Response.json({ error: 'Invite has been revoked' }, { status: 400 });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await base44.asServiceRole.entities.AppInvite.update(invite_id, { status: 'EXPIRED' });
      return Response.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Rate limit: max 3 sends per hour
    if (invite.last_sent_at) {
      const lastSent = new Date(invite.last_sent_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSent > oneHourAgo && invite.send_count >= 3) {
        return Response.json({ error: 'Rate limit exceeded. Please wait before resending.' }, { status: 429 });
      }
    }

    // Generate new token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    // Hash token
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Generate magic link
    const appDomain = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const magicLink = `${protocol}://${appDomain}/invite?token=${rawToken}`;

    // Send email
    const emailContent = invite.role === 'CUSTOMER' 
      ? {
          subject: 'Welcome to Alpha Yachting App',
          body: `Hello,

You've been invited to access your Alpha Yachting project via the Alpha App.

Open your secure link here:
${magicLink}

Install on your phone (recommended):
• iPhone (Safari): Share → "Add to Home Screen"
• Android (Chrome): Menu → "Install app" / "Add to Home Screen"

This link is personal and expires in 7 days. If you have any questions, just reply to this email.

Best regards,
Alfons
Alpha Yachting
info@alpha-jachting.hr`
        }
      : {
          subject: 'Welcome to Alpha Team App',
          body: `Hello,

You've been invited to the Alpha Team App to manage WorkOrders and tasks.

Open your secure link here:
${magicLink}

Install on your phone (recommended):
• iPhone (Safari): Share → "Add to Home Screen"
• Android (Chrome): Menu → "Install app" / "Add to Home Screen"

This link is personal and expires in 7 days. If anything doesn't work, reply to this email.

Best regards,
Alfons
Alpha Yachting
info@alpha-jachting.hr`
        };

    // Update invite record
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.AppInvite.update(invite_id, {
      token_hash,
      last_sent_at: now,
      send_count: (invite.send_count || 0) + 1,
      status: 'SENT'
    });

    return Response.json({ 
      success: true,
      message: 'Invite updated. You can copy the magic link from the invitations page or send email manually.'
    });
  } catch (error) {
    console.error('Error resending invite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});