import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Generate magic link - use correct invite-accept page
    // Use APP_DOMAIN env variable if set, otherwise fall back to request host
    const appDomain = Deno.env.get('APP_DOMAIN') || req.headers.get('host');
    const protocol = 'https';
    const magicLink = `${protocol}://${appDomain}/invite-accept?token=${rawToken}`;

    // Get recipient name if available
    let recipientName = null;
    if (customer_id) {
      try {
        const customer = await base44.asServiceRole.entities.Customer.get(customer_id);
        recipientName = customer.first_name || null;
      } catch (e) {
        console.log('Could not fetch customer name');
      }
    } else if (technician_id) {
      try {
        const tech = await base44.asServiceRole.entities.Technician.get(technician_id);
        recipientName = tech.first_name || null;
      } catch (e) {
        console.log('Could not fetch technician name');
      }
    }

    // Generate email subject
    const emailSubject = role === 'CUSTOMER' 
      ? 'Accept Your Invitation - Alpha Yachting'
      : 'Accept Your Team Invitation - Alpha Yachting';
    
    // Properly formatted email body with correct line breaks
    const getPlainTextEmail = (link, name, role) => {
      const greeting = name ? `Hello ${name},` : 'Hello,';
      
      if (role === 'CUSTOMER') {
        return `${greeting}\n\nYou have been invited to access your yacht service projects on the Alpha Yachting platform.\n\nACCEPT YOUR INVITATION:\n${link}\n\nIf the link above doesn't work, copy and paste this URL into your browser:\n${link}\n\nIMPORTANT:\n• This link is valid for 7 days\n• You'll need to create a password after accepting\n• Keep this link confidential - don't share it\n\nTROUBLESHOOTING:\nIf you cannot access the link, please contact us at info@alpha-yachting.hr\n\nBest regards,\nAlpha Yachting Team\n📧 info@alpha-yachting.hr\n📞 +385 52 757 907`;
      } else {
        return `${greeting}\n\nWelcome to the Alpha Yachting Team! You have been invited to access the technician management platform.\n\nACCEPT YOUR INVITATION:\n${link}\n\nIf the link above doesn't work, copy and paste this URL into your browser:\n${link}\n\nIMPORTANT:\n• This link is valid for 7 days\n• You'll need to create a password after accepting\n• Keep this link confidential - don't share it\n\nONCE YOU JOIN:\n• View your assigned work orders\n• Manage daily tasks\n• Log work hours and expenses\n• Upload photos and notes\n• Access offline\n\nTROUBLESHOOTING:\nIf you cannot access the link, please contact your supervisor.\n\nBest regards,\nAlpha Yachting Management\n📧 info@alpha-yachting.hr\n📞 +385 52 757 907`;
      }
    };
    
    // Try to send email via Base44
    let emailSent = false;
    console.log('→ Attempting to send email...');
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'Alpha Yachting',
        to: email,
        subject: emailSubject,
        body: getPlainTextEmail(magicLink, recipientName, role)
      });
      emailSent = true;
      console.log('✓ Email sent successfully');
    } catch (emailError) {
      console.error('✗ Email send failed:', {
        name: emailError.name,
        message: emailError.message,
        status: emailError.status,
        response: emailError.response?.data
      });
    }

    // Update invite status
    const now = new Date().toISOString();
    if (emailSent) {
      console.log('→ Updating invite to SENT...');
      await base44.asServiceRole.entities.AppInvite.update(invite.id, {
        status: 'SENT',
        sent_at: now,
        last_sent_at: now,
        send_count: 1
      });
      console.log('=== INVITE CREATE SUCCESS (SENT) ===');
      
      return Response.json({ 
        success: true, 
        invite_id: invite.id,
        message: 'Invite sent successfully'
      });
    } else {
      console.log('=== INVITE CREATE SUCCESS (EMAIL SKIPPED) ===');
      // Keep status as CREATED - can be resent later
      return Response.json({ 
        success: true,
        invite_id: invite.id,
        magic_link: magicLink,
        warning: 'Invite created but email rate limited. You can copy the link above or resend from the invitations page in a few minutes.'
      }, { status: 201 });
    }
  } catch (error) {
    console.error('=== INVITE CREATE ERROR ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      status: error.status,
      response: error.response,
      stack: error.stack
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
});