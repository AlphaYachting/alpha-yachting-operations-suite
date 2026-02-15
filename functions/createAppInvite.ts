import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { email, role, customer_id, technician_id, job_id, work_order_id } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['CUSTOMER', 'TECHNICIAN'].includes(role)) {
      return Response.json({ error: 'Invalid role. Must be CUSTOMER or TECHNICIAN' }, { status: 400 });
    }

    // Generate secure random token (32 bytes = 256 bits)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    // Hash token using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Set expiration to 7 days from now
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create invite record
    const inviteData = {
      email,
      role,
      status: 'CREATED',
      token_hash,
      expires_at,
      created_by_user_id: user.id,
      customer_id: customer_id || null,
      technician_id: technician_id || null,
      job_id: job_id || null,
      work_order_id: work_order_id || null,
      send_count: 0
    };

    const invite = await base44.asServiceRole.entities.AppInvite.create(inviteData);

    // Generate magic link
    const appDomain = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const magicLink = `${protocol}://${appDomain}/invite?token=${rawToken}`;

    // Send email based on role
    const emailContent = role === 'CUSTOMER' 
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

    // Send email
    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'Alpha Yachting',
      to: email,
      subject: emailContent.subject,
      body: emailContent.body
    });

    // Update invite status
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.AppInvite.update(invite.id, {
      status: 'SENT',
      sent_at: now,
      last_sent_at: now,
      send_count: 1
    });

    return Response.json({ 
      success: true, 
      invite_id: invite.id,
      message: 'Invite sent successfully'
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});