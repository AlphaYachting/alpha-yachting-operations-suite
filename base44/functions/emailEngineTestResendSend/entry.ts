// EMAIL ENGINE - Test actual email send via Resend
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromAddr = Deno.env.get('EMAIL_ENGINE_FROM_ADDRESS');
    const fromName = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

    if (!apiKey || !fromAddr) {
      return Response.json({ success: false, error: 'RESEND_API_KEY or EMAIL_ENGINE_FROM_ADDRESS not set' });
    }

    // Send test email to self
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: [user.email],
        subject: '[Email Engine Test] Resend connection test',
        text: `This is a test email from the Alpha Yachting Email Engine Sandbox.\n\nIf you receive this, Resend is working correctly.\n\nSent at: ${new Date().toISOString()}`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json({ success: false, error: `Resend send failed: ${data?.message || JSON.stringify(data)}` });
    }

    return Response.json({
      success: true,
      message: `Test email sent to ${user.email}`,
      resend_id: data.id,
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});