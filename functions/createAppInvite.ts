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
    const appDomain = Deno.env.get('APP_DOMAIN') || req.headers.get('host');
    const protocol = 'https';
    const magicLink = `${protocol}://${appDomain}/invite?token=${rawToken}`;

    // Generate email subject and body
    const emailSubject = role === 'CUSTOMER' 
      ? '🚢 Welcome to Alpha Yachting App'
      : '🔧 Welcome to Alpha Team App';
    
    const emailBody = role === 'CUSTOMER' 
      ? `Hello,\n\nYou've been invited to access your yacht service projects through our secure mobile app.\n\nAccess your projects:\n${magicLink}\n\n🔒 This link expires in 7 days.\n\nAlpha Yachting`
      : `Hello,\n\nWelcome to the Alpha Team! Access the technician app:\n${magicLink}\n\n🔒 This link expires in 7 days.\n\nAlpha Yachting`;

    // Send email (non-blocking, don't fail if it doesn't work)
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'Alpha Yachting',
        to: email,
        subject: emailSubject,
        body: emailBody
      });
      
      // Mark as SENT if email succeeded
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
    } catch (emailError) {
      // Email failed but invite is created - still return success
      console.log('Email send skipped (rate limited or not configured)');
      return Response.json({ 
        success: true,
        invite_id: invite.id,
        magic_link: magicLink,
        message: 'Invite created. Email sending temporarily unavailable - use the link above.'
      });
    }
  } catch (error) {
    console.error('Invite creation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});