// EMAIL ENGINE - Test Resend API connectivity (no email sent)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return Response.json({ success: false, error: 'RESEND_API_KEY not set' });

    // Call Resend API to get account info (no email sent)
    const res = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json({ success: false, error: `Resend API error: ${data?.message || res.status}` });
    }

    const domains = data?.data || [];
    return Response.json({
      success: true,
      message: 'Resend API key is valid',
      verified_domains: domains.map(d => ({ name: d.name, status: d.status })),
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});