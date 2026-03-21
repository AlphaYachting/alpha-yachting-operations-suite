import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { Resend } from 'npm:resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { to } = await req.json();
    if (!to) {
      return Response.json({ error: 'to email is required' }, { status: 400 });
    }

    const fromEmail = Deno.env.get('CUSTOM_EMAIL_FROM') || 'onboarding@resend.dev';
    const appDomain = Deno.env.get('APP_DOMAIN') || req.headers.get('host');

    console.log('Testing Resend with:');
    console.log('  FROM:', fromEmail);
    console.log('  TO:', to);
    console.log('  APP_DOMAIN:', appDomain);
    console.log('  RESEND_API_KEY set:', !!Deno.env.get('RESEND_API_KEY'));

    const result = await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: '✅ Alpha Yachting – Resend Test erfolgreich',
      text: `Dies ist eine Test-E-Mail vom Alpha Yachting System.

Wenn Sie diese E-Mail erhalten, ist Resend korrekt eingebunden und der E-Mail-Versand funktioniert.

APP_DOMAIN: ${appDomain}
FROM: ${fromEmail}
Datum: ${new Date().toISOString()}

Alpha Yachting Team`
    });

    console.log('Resend result:', JSON.stringify(result));

    return Response.json({
      success: true,
      message: `Test-E-Mail erfolgreich gesendet an ${to}`,
      resend_id: result?.data?.id || null,
      from: fromEmail,
      app_domain: appDomain
    });
  } catch (error) {
    console.error('Resend test error:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});