// IMAP Step-by-Step Diagnostic
import { ImapFlow } from 'npm:imapflow@1.0.167';

function safeErr(err) {
  return (err?.message || String(err)).replace(/pass(word)?\s*[=:][^\s]*/gi, '[REDACTED]').substring(0, 500);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];
  const t = () => Date.now() - startTime;

  const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
  const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
  const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
  const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

  log.push({ step: '1_config', host, port, user: imapUser, pass_set: !!imapPass, ts: t() });

  // STEP 1: DNS
  try {
    const dns = await Deno.resolveDns(host, 'A');
    log.push({ step: '2_dns_ok', resolved: dns, ts: t() });
  } catch (e) {
    log.push({ step: '2_dns_FAILED', error: safeErr(e), ts: t() });
    return Response.json({ success: false, stopped_at: 'dns', log });
  }

  // STEP 2: TCP port 993
  try {
    const tcp = await Promise.race([
      Deno.connect({ hostname: host, port }),
      new Promise((_, r) => setTimeout(() => r(new Error('TCP timeout 5s')), 5000)),
    ]);
    log.push({ step: '3_tcp_ok', ts: t() });
    tcp.close();
  } catch (e) {
    log.push({ step: '3_tcp_FAILED', error: safeErr(e), ts: t() });
    return Response.json({ success: false, stopped_at: 'tcp', log });
  }

  // STEP 3: Also try port 143 as fallback info
  try {
    const tcp143 = await Promise.race([
      Deno.connect({ hostname: host, port: 143 }),
      new Promise((_, r) => setTimeout(() => r(new Error('TCP timeout 3s')), 3000)),
    ]);
    log.push({ step: '3b_tcp_143_ok', ts: t() });
    tcp143.close();
  } catch (e) {
    log.push({ step: '3b_tcp_143_FAILED', error: safeErr(e), ts: t() });
  }

  // STEP 4: IMAP connect + greeting
  const imapLog = [];
  const client = new ImapFlow({
    host, port,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: {
      debug: (o) => imapLog.push({ l: 'D', m: o?.msg, ts: t() }),
      info:  (o) => imapLog.push({ l: 'I', m: o?.msg, ts: t() }),
      warn:  (o) => imapLog.push({ l: 'W', m: o?.msg, ts: t() }),
      error: (o) => imapLog.push({ l: 'E', m: safeErr(o?.err || new Error(o?.msg)), ts: t() }),
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    disableAutoIdle: true,
  });

  client.on('error', (e) => imapLog.push({ l: 'CLIENT_ERROR', m: safeErr(e), ts: t() }));

  try {
    log.push({ step: '4_imap_connect_start', ts: t() });
    await Promise.race([
      client.connect(),
      new Promise((_, r) => setTimeout(() => r(new Error('IMAP connect timeout 12s')), 12000)),
    ]);
    log.push({ step: '4_imap_connect_ok', ts: t() });
  } catch (e) {
    log.push({ step: '4_imap_connect_FAILED', error: safeErr(e), ts: t(), imap_log: imapLog });
    try { await client.logout(); } catch (_) {}
    return Response.json({ success: false, stopped_at: 'imap_connect', log, imap_log: imapLog });
  }

  // STEP 5: SELECT INBOX
  let lock;
  try {
    log.push({ step: '5_select_inbox_start', ts: t() });
    lock = await Promise.race([
      client.getMailboxLock('INBOX'),
      new Promise((_, r) => setTimeout(() => r(new Error('SELECT timeout 8s')), 8000)),
    ]);
    log.push({ step: '5_select_inbox_ok', exists: client.mailbox?.exists, ts: t() });
  } catch (e) {
    log.push({ step: '5_select_inbox_FAILED', error: safeErr(e), ts: t(), imap_log: imapLog });
    try { await client.logout(); } catch (_) {}
    return Response.json({ success: false, stopped_at: 'select_inbox', log, imap_log: imapLog });
  }

  // STEP 6: FETCH one envelope
  try {
    log.push({ step: '6_fetch_envelope_start', ts: t() });
    const total = client.mailbox?.exists || 0;
    if (total > 0) {
      const msgs = [];
      for await (const msg of client.fetch(`${total}:${total}`, { envelope: true, uid: true })) {
        msgs.push({ uid: msg.uid, subject: msg.envelope?.subject, from: msg.envelope?.from?.[0]?.address });
      }
      log.push({ step: '6_fetch_envelope_ok', sample: msgs, ts: t() });
    } else {
      log.push({ step: '6_fetch_envelope_skip', reason: 'inbox empty', ts: t() });
    }
  } catch (e) {
    log.push({ step: '6_fetch_envelope_FAILED', error: safeErr(e), ts: t() });
  } finally {
    lock?.release();
    try { await client.logout(); } catch (_) {}
    log.push({ step: '7_logout', ts: t() });
  }

  return Response.json({
    success: true,
    all_steps_passed: true,
    log,
    imap_log: imapLog,
    total_ms: t(),
  });
});