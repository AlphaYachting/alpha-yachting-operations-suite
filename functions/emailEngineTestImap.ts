// EMAIL ENGINE SANDBOX - IMAP Connection Test
// Phase 1: Secure isolated module. No production entity writes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.167';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
    const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
    const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
    const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

    if (!host || !imapUser || !imapPass) {
      return Response.json({
        success: false,
        error: 'IMAP secrets not configured. Required: EMAIL_ENGINE_IMAP_HOST, EMAIL_ENGINE_IMAP_USER, EMAIL_ENGINE_IMAP_PASSWORD'
      });
    }

    const client = new ImapFlow({
      host,
      port,
      secure: true, // SSL/TLS
      auth: { user: imapUser, pass: imapPass },
      logger: false, // NEVER log credentials
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });

    await client.connect();

    // Get inbox status without storing any data
    const status = await client.status('INBOX', { messages: true, unseen: true });

    await client.logout();

    return Response.json({
      success: true,
      message: 'IMAP connection successful',
      inbox_total: status.messages,
      inbox_unseen: status.unseen,
      // credentials never returned
    });

  } catch (error) {
    // Sanitize error - never expose credentials
    const safeError = (error.message || 'Connection failed')
      .replace(/pass(word)?\s*[=:][^\s]*/gi, 'pass=[REDACTED]')
      .replace(/password[^\s]*/gi, '[REDACTED]')
      .substring(0, 400);
    return Response.json({ success: false, error: `IMAP test failed: ${safeError}` });
  }
});