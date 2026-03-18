// EMAIL ENGINE SANDBOX - SMTP Connection Test
// Phase 1: Secure isolated module. No production entity writes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import nodemailer from 'npm:nodemailer@6.9.16';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = Deno.env.get('EMAIL_ENGINE_SMTP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('EMAIL_ENGINE_SMTP_USER');
    const smtpPass = Deno.env.get('EMAIL_ENGINE_SMTP_PASSWORD');

    if (!host || !smtpUser || !smtpPass) {
      return Response.json({
        success: false,
        error: 'SMTP secrets not configured. Required: EMAIL_ENGINE_SMTP_HOST, EMAIL_ENGINE_SMTP_USER, EMAIL_ENGINE_SMTP_PASSWORD'
      });
    }

    const useSSL = port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: useSSL, // SSL for 465, STARTTLS for 587
      requireTLS: !useSSL,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });

    // Verify connection only — does not send any email
    await transporter.verify();

    return Response.json({
      success: true,
      message: 'SMTP connection verified via STARTTLS',
      // credentials never returned
    });

  } catch (error) {
    const safeError = (error.message || 'Verification failed')
      .replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]')
      .replace(/password[^\s]*/gi, '[REDACTED]')
      .substring(0, 400);
    return Response.json({ success: false, error: `SMTP test failed: ${safeError}` });
  }
});