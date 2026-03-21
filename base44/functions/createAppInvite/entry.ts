import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { Resend } from 'npm:resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  try {
    console.log('=== INVITE CREATE START ===');
    const base44 = createClientFromRequest(req);
    console.log('✓ SDK initialized');
    
    const user = await base44.auth.me();
    console.log('✓ User authenticated:', user?.email);

    if (!user || user.role !== 'admin') {
      console.log('✗ Unauthorized user');
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { email, role, customer_id, technician_id, job_id, work_order_id } = await req.json();
    console.log('✓ Payload:', { email, role });

    // Validate required fields
    if (!email || !role) {
      return Response.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['CUSTOMER', 'TECHNICIAN'].includes(role)) {
      return Response.json({ error: 'Invalid role. Must be CUSTOMER or TECHNICIAN' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
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

    console.log('→ Creating invite record...');
    const invite = await base44.asServiceRole.entities.AppInvite.create(inviteData);
    console.log('✓ Invite created:', invite.id);

    // Generate magic link
    const appDomain = Deno.env.get('APP_DOMAIN') || req.headers.get('host');
    const protocol = 'https';
    const magicLink = `${protocol}://${appDomain}/invite-accept?token=${rawToken}`;

    // Send email via Resend using template
    const fromEmail = Deno.env.get('CUSTOM_EMAIL_FROM') || 'onboarding@resend.dev';

    console.log('→ Sending email via Resend REST API...');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Ihre Einladung zur Alpha Yachting App',
        template: {
          id: 'alpha-team-app-invitation',
          variables: { magicLink }
        }
      })
    });
    const emailResult = await emailResponse.json();
    console.log('✓ Resend result:', JSON.stringify(emailResult));
    if (emailResult.error || !emailResult.id) {
      throw new Error(`Resend error: ${JSON.stringify(emailResult)}`);
    }
    console.log('✓ Email sent successfully, id:', emailResult.id);

    // Update invite status to SENT
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.AppInvite.update(invite.id, {
      status: 'SENT',
      sent_at: now,
      last_sent_at: now,
      send_count: 1
    });

    console.log('=== INVITE CREATE SUCCESS ===');
    
    return Response.json({ 
      success: true, 
      invite_id: invite.id,
      message: 'Invitation sent successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('=== INVITE CREATE ERROR ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      status: error.status,
      stack: error.stack
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
});