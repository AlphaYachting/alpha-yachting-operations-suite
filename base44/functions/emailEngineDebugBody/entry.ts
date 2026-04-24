// DEBUG: Test RFC822 body download from IMAP
import { ImapFlow } from 'npm:imapflow@1.0.167';
import { Buffer } from 'node:buffer';

function safeErr(err) {
  return (err?.message || 'Unknown error').replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]').substring(0, 500);
}

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
    log.push({ step: 'locked', exists: client.mailbox.exists, ts: Date.now() - startTime });

    try {
      const total = client.mailbox.exists || 0;
      const targetSeq = total; // newest message

      // Step 1: Get UID
      let uid = null;
      for await (const m of client.fetch(`${targetSeq}`, { uid: true, envelope: true })) {
        uid = m.uid;
        log.push({ step: 'envelope', uid, subject: m.envelope?.subject, from: m.envelope?.from?.[0]?.address, ts: Date.now() - startTime });
        break;
      }

      if (!uid) {
        return Response.json({ success: false, error: 'No message found', log });
      }

      // Step 2: Try fetch with bodyParts TEXT
      log.push({ step: 'trying_fetch_body_parts', uid, ts: Date.now() - startTime });
      try {
        let bodyResult = null;
        const fetchPromise = (async () => {
          for await (const m of client.fetch(`${uid}`, { bodyParts: ['TEXT', '1', '1.1', '1.2'] }, { uid: true })) {
            bodyResult = m;
            break;
          }
        })();
        await Promise.race([
          fetchPromise,
          new Promise((_, r) => setTimeout(() => r(new Error('fetch bodyParts timeout')), 12000)),
        ]);
        log.push({ step: 'bodyParts_result', hasBodyParts: !!bodyResult?.bodyParts, keys: bodyResult?.bodyParts ? [...bodyResult.bodyParts.keys()] : [], ts: Date.now() - startTime });
        if (bodyResult?.bodyParts) {
          for (const [part, buf] of bodyResult.bodyParts) {
            const text = buf.toString('utf-8');
            log.push({ step: 'part', part, bytes: buf.length, preview: text.substring(0, 300) });
          }
        }
        return Response.json({ success: true, log });
      } catch (e) {
        log.push({ step: 'fetch_bodyParts_failed', error: safeErr(e), ts: Date.now() - startTime });
      }

    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }

    return Response.json({ success: false, error: 'All download attempts failed', log });

  } catch (err) {
    return Response.json({ success: false, error: safeErr(err), log }, { status: 500 });
  }
});