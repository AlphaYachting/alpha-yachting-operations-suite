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

    // Generate HTML email content
    const getCustomerEmail = (link, name) => ({
      subject: '🚢 Welcome to Alpha Yachting App',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f5f7fa;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);padding:40px 30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">⚓ Alpha Yachting</h1><p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:16px;">Your Project Portal</p></td></tr><tr><td style="padding:40px 30px;">${name ? `<p style="color:#1e293b;font-size:16px;margin:0 0 20px 0;">Hello ${name},</p>` : ''}<p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px 0;">You've been invited to access your yacht service projects through our secure mobile app. Track work orders, view photos, and stay updated on your boat's maintenance - all in one place.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;"><tr><td align="center"><a href="${link}" style="display:inline-block;background:linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(14, 165, 233, 0.25);">🔐 Access Your Projects</a></td></tr></table><p style="color:#64748b;font-size:14px;text-align:center;margin:20px 0;">Or copy this link: <span style="color:#0ea5e9;word-break:break-all;">${link}</span></p><div style="background-color:#f8fafc;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:30px 0;"><h3 style="color:#1e293b;margin:0 0 12px 0;font-size:16px;">📱 Install on Your Phone (Recommended)</h3><p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 10px 0;"><strong>iPhone (Safari):</strong> Tap Share → "Add to Home Screen"</p><p style="color:#475569;font-size:14px;line-height:1.6;margin:0;"><strong>Android (Chrome):</strong> Tap Menu → "Install app" or "Add to Home Screen"</p></div><p style="color:#64748b;font-size:13px;line-height:1.6;margin:30px 0 0 0;padding-top:20px;border-top:1px solid #e2e8f0;">🔒 This link is personal and secure. It expires in 7 days.<br>Questions? Just reply to this email.</p></td></tr><tr><td style="background-color:#f8fafc;padding:30px;text-align:center;border-top:1px solid #e2e8f0;"><p style="color:#1e293b;margin:0 0 8px 0;font-weight:600;font-size:14px;">Alfons Pirker</p><p style="color:#64748b;margin:0 0 4px 0;font-size:13px;">Alpha Yachting</p><p style="color:#64748b;margin:0;font-size:13px;">📧 info@alpha-jachting.hr | 📞 +385 52 757 907</p></td></tr></table></td></tr></table></body></html>`
    });

    const getTechnicianEmail = (link, name) => ({
      subject: '🔧 Welcome to Alpha Team App',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f5f7fa;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);padding:40px 30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">🔧 Alpha Team</h1><p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:16px;">Mobile Technician App</p></td></tr><tr><td style="padding:40px 30px;">${name ? `<p style="color:#1e293b;font-size:16px;margin:0 0 20px 0;">Hello ${name},</p>` : ''}<p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px 0;">Welcome to the Alpha Team! You've been invited to access our mobile technician app. Manage your work orders, complete tasks, log time, and capture photos - all from your phone.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;"><tr><td align="center"><a href="${link}" style="display:inline-block;background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(139, 92, 246, 0.25);">🚀 Access Team App</a></td></tr></table><p style="color:#64748b;font-size:14px;text-align:center;margin:20px 0;">Or copy this link: <span style="color:#8b5cf6;word-break:break-all;">${link}</span></p><div style="background-color:#faf5ff;border-left:4px solid #8b5cf6;padding:20px;border-radius:6px;margin:30px 0;"><h3 style="color:#1e293b;margin:0 0 12px 0;font-size:16px;">📱 Install on Your Phone (Required)</h3><p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 10px 0;"><strong>iPhone (Safari):</strong> Tap Share → "Add to Home Screen"</p><p style="color:#475569;font-size:14px;line-height:1.6;margin:0;"><strong>Android (Chrome):</strong> Tap Menu → "Install app" or "Add to Home Screen"</p></div><div style="background-color:#f0fdf4;border:1px solid #86efac;padding:16px;border-radius:6px;margin:20px 0;"><p style="color:#166534;font-size:14px;line-height:1.6;margin:0;">✅ <strong>What you can do:</strong> View assignments, complete tasks, log hours, upload photos, add notes, and track your work - all offline-ready.</p></div><p style="color:#64748b;font-size:13px;line-height:1.6;margin:30px 0 0 0;padding-top:20px;border-top:1px solid #e2e8f0;">🔒 This link is personal and secure. It expires in 7 days.<br>Need help? Reply to this email or contact your team lead.</p></td></tr><tr><td style="background-color:#f8fafc;padding:30px;text-align:center;border-top:1px solid #e2e8f0;"><p style="color:#1e293b;margin:0 0 8px 0;font-weight:600;font-size:14px;">Alfons Pirker</p><p style="color:#64748b;margin:0 0 4px 0;font-size:13px;">Alpha Yachting</p><p style="color:#64748b;margin:0;font-size:13px;">📧 info@alpha-jachting.hr | 📞 +385 52 757 907</p></td></tr></table></td></tr></table></body></html>`
    });

    const emailContent = role === 'CUSTOMER' 
      ? getCustomerEmail(magicLink, recipientName)
      : getTechnicianEmail(magicLink, recipientName);

    // Check if custom email service is configured (Resend or SendGrid)
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
    const customFromEmail = Deno.env.get('CUSTOM_EMAIL_FROM') || 'noreply@alpha-jachting.hr';

    try {
      if (resendKey) {
        // Use Resend for custom email
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `Alpha Yachting <${customFromEmail}>`,
            to: [email],
            subject: emailContent.subject,
            html: emailContent.html
          })
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.text();
          console.error('Resend error:', errorData);
          throw new Error('Failed to send email via Resend');
        }
      } else if (sendgridKey) {
        // Use SendGrid for custom email
        const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: customFromEmail, name: 'Alpha Yachting' },
            subject: emailContent.subject,
            content: [{ type: 'text/html', value: emailContent.html }]
          })
        });

        if (!sgResponse.ok) {
          const errorData = await sgResponse.text();
          console.error('SendGrid error:', errorData);
          throw new Error('Failed to send email via SendGrid');
        }
      } else {
        // Fallback to Base44 built-in email (formatted plain text)
        const getPlainTextEmail = (link, name, role) => {
          const greeting = name ? `Hello ${name},\n\n` : '';
          
          if (role === 'CUSTOMER') {
            return `${greeting}You've been invited to access your yacht service projects through our secure mobile app.\n\nTrack work orders, view photos, and stay updated on your boat's maintenance - all in one place.\n\nACCESS YOUR PROJECTS:\n${link}\n\n📱 INSTALL ON YOUR PHONE (Recommended):\n• iPhone (Safari): Tap Share → "Add to Home Screen"\n• Android (Chrome): Tap Menu → "Install app"\n\n🔒 This link is personal and secure. It expires in 7 days.\n\nQuestions? Reply to this email.\n\n---\nAlfons Pirker\nAlpha Yachting\n📧 info@alpha-yachting.hr | 📞 +385 52 757 907`;
          } else {
            return `${greeting}Welcome to the Alpha Team! You've been invited to access our mobile technician app.\n\nManage your work orders, complete tasks, log time, and capture photos - all from your phone.\n\nACCESS TEAM APP:\n${link}\n\n📱 INSTALL ON YOUR PHONE (Required):\n• iPhone (Safari): Tap Share → "Add to Home Screen"\n• Android (Chrome): Tap Menu → "Install app"\n\n✅ What you can do:\nView assignments, complete tasks, log hours, upload photos, add notes, and track your work - all offline-ready.\n\n🔒 This link is personal and secure. It expires in 7 days.\n\n---\nAlfons Pirker\nAlpha Yachting\n📧 info@alpha-yachting.hr | 📞 +385 52 757 907`;
          }
        };
        
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'Alpha Yachting',
          to: email,
          subject: emailContent.subject,
          body: getPlainTextEmail(magicLink, recipientName, role)
        });
      }
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Don't fail the invite creation, just log the error
      // The invite can be resent manually
    }

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