// DEBUG ONLY - fetch raw body of one specific email and return log
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { Buffer } from 'node:buffer';

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];

  const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
  const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
  const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
  const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

  const client = new ImapFlow({
    host, port,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableAutoIdle: true,
  });

  try {
    await client.connect();
    log.push({ step: 'connected', ts: Date.now() - startTime });

    const lock = await client.getMailboxLock('INBOX');
    log.push({ step: 'inbox_locked', exists: client.mailbox.exists, ts: Date.now() - startTime });

    try {
      const total = client.mailbox.exists || 0;
      const targetSeq = total; // latest message

      // 1. Get envelope + uid
      let uid = null;
      let envelope = null;
      for await (const msg of client.fetch(`${targetSeq}`, { envelope: true, uid: true })) {
        uid = msg.uid;
        envelope = msg.envelope;
        break;
      }
      log.push({ step: 'envelope', uid, subject: envelope?.subject, messageId: envelope?.messageId, ts: Date.now() - startTime });

      if (!uid) {
        return Response.json({ success: false, error: 'no uid', log });
      }

      // 2. Try download with '' (RFC822 body)
      log.push({ step: 'trying_download_empty_string', uid, ts: Date.now() - startTime });
      try {
        const dl = await client.download(`${uid}`, '', { uid: true });
        log.push({ step: 'download_opened', meta: dl?.meta, type_content: typeof dl?.content, ts: Date.now() - startTime });
        const chunks = [];
        for await (const chunk of dl.content) {
          chunks.push(chunk);
          if (Buffer.concat(chunks).length > 50000) break; // safety cap
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        log.push({ step: 'download_done', bytes: raw.length, preview: raw.substring(0, 500), ts: Date.now() - startTime });
      } catch (e) {
        log.push({ step: 'download_empty_failed', error: e.message, ts: Date.now() - startTime });
      }

      // 3. Try download with 'TEXT' section
      log.push({ step: 'trying_download_TEXT', uid, ts: Date.now() - startTime });
      try {
        const dl2 = await client.download(`${uid}`, 'TEXT', { uid: true });
        const chunks2 = [];
        for await (const chunk of dl2.content) {
          chunks2.push(chunk);
          if (Buffer.concat(chunks2).length > 50000) break;
        }
        const raw2 = Buffer.concat(chunks2).toString('utf-8');
        log.push({ step: 'download_TEXT_done', bytes: raw2.length, preview: raw2.substring(0, 500), ts: Date.now() - startTime });
      } catch (e2) {
        log.push({ step: 'download_TEXT_failed', error: e2.message, ts: Date.now() - startTime });
      }

      // 4. Try fetch with source:true
      log.push({ step: 'trying_fetch_source', uid, ts: Date.now() - startTime });
      try {
        for await (const msg of client.fetch(`${uid}`, { source: true }, { uid: true })) {
          const src = msg.source;
          log.push({
            step: 'fetch_source_done',
            source_type: typeof src,
            is_buffer: Buffer.isBuffer(src),
            bytes: src ? src.length : 0,
            preview: src ? src.toString('utf-8').substring(0, 500) : null,
            ts: Date.now() - startTime
          });
          break;
        }
      } catch (e3) {
        log.push({ step: 'fetch_source_failed', error: e3.message, ts: Date.now() - startTime });
      }

    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }

    return Response.json({ success: true, log });
  } catch (err) {
    log.push({ step: 'top_error', error: err.message });
    return Response.json({ success: false, error: err.message, log }, { status: 500 });
  }
});