import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_ADDRESS = Deno.env.get('CUSTOM_EMAIL_FROM') || 'info@alpha-yachting.hr';
  const FROM_NAME = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

  const { to } = await req.json();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [to],
      subject: 'Test-E-Mail von Alpha Yachting',
      html: `<p>Dies ist eine Test-E-Mail vom Alpha Yachting System. Wenn du das liest, funktioniert der E-Mail-Versand korrekt ✅</p>`
    })
  });

  const body = await res.json();
  return Response.json({ status: res.status, ok: res.ok, body });
});