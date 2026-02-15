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
    // Use APP_DOMAIN env variable if set, otherwise fall back to request host
    const appDomain = Deno.env.get('APP_DOMAIN') || req.headers.get('host');
    const protocol = 'https';
    const magicLink = `${protocol}://${appDomain}/invite?token=${rawToken}`;

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

    // Generate email subject and body
    const emailSubject = role === 'CUSTOMER' 
      ? '🚢 Welcome to Alpha Yachting App'
      : '🔧 Welcome to Alpha Team App';
    const getPlainTextEmail = (link, name, role) => {
      const greeting = name ? `Hello ${name},` : 'Hello,';
      
      if (role === 'CUSTOMER') {
        return `${greeting}

You've been invited to access your yacht service projects through our secure mobile app.

Track work orders, view photos, and stay updated on your boat's maintenance - all in one place.

🔗 ACCESS YOUR PROJECTS:
${link}

📱 INSTALL ON YOUR PHONE (Recommended):
• iPhone (Safari): Tap Share → "Add to Home Screen"
• Android (Chrome): Tap Menu → "Install app"

🔒 This link is personal and secure. It expires in 7 days.

Questions? Reply to this email.

---
Alfons Pirker
Alpha Yachting
📧 info@alpha-yachting.hr
📞 +385 52 757 907`;
      } else {
        return `${greeting}

Welcome to the Alpha Team! You've been invited to access our mobile technician app.

Manage your work orders, complete tasks, log time, and capture photos - all from your phone.

🔗 ACCESS TEAM APP:
${link}

📱 INSTALL ON YOUR PHONE (Required):
• iPhone (Safari): Tap Share → "Add to Home Screen"
• Android (Chrome): Tap Menu → "Install app"

✅ What you can do:
View assignments, complete tasks, log hours, upload photos, add notes, and track your work - all offline-ready.

🔒 This link is personal and secure. It expires in 7 days.

---
Alfons Pirker
Alpha Yachting
📧 info@alpha-yachting.hr
📞 +385 52 757 907`;
      }
    };
    
    // Try to send email via Base44
    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'Alpha Yachting',
        to: email,
        subject: emailSubject,
        body: getPlainTextEmail(magicLink, recipientName, role)
      });
      emailSent = true;
    } catch (base44EmailError) {
      console.error('Base44 email failed:', base44EmailError);
      // Email failed but invite is created - don't throw error
    }

    // Update invite status
    const now = new Date().toISOString();
    if (emailSent) {
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
    } else {
      // Keep status as CREATED - can be resent later
      return Response.json({ 
        success: true,
        invite_id: invite.id,
        magic_link: magicLink,
        warning: 'Invite created but email rate limited. You can copy the link above or resend from the invitations page in a few minutes.'
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating invite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});