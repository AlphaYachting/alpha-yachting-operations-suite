// DEBUG: Fetch body for a specific UID — step by step timing
import { ImapFlow } from 'npm:imapflow@1.0.167';

Deno.serve(async (req) => {
  const startTime = Date.now();
  const log = [];
  const t = () => Date.now() - startTime;

  const host = Deno.env.get('EMAIL_ENGINE_IMAP_HOST');
  const port = parseInt(Deno.env.get('EMAIL_ENGINE_IMAP_PORT') || '993');
  const imapUser = Deno.env.get('EMAIL_ENGINE_IMAP_USER');
  const imapPass = Deno.env.get('EMAIL_ENGINE_IMAP_PASSWORD');

  const body = await req.json().catch(() => ({}));
  const targetUid = body.uid || 47;
  const fetchMode = body.mode || 'structure'; // 'structure' | 'bodyparts' | 'source' | 'text_only' | 'part1'

  log.push({ step: 'config', host, port, user: imapUser, target_uid: targetUid, mode: fetchMode, ts: t() });

  const imapLog = [];
  const client = new ImapFlow({
    host, port,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: {
      debug: (o) => imapLog.push({ l: 'D', m: o?.msg?.substring(0, 200), ts: t() }),
      info:  (o) => imapLog.push({ l: 'I', m: o?.msg, ts: t() }),
      warn:  (o) => imapLog.push({ l: 'W', m: o?.msg, ts: t() }),
      error: (o) => imapLog.push({ l: 'E', m: String(o?.err || o?.msg || '').substring(0, 200), ts: t() }),
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 120000,
    disableAutoIdle: true,
  });

  try {
    log.push({ step: 'connecting', ts: t() });
    await client.connect();
    log.push({ step: 'connected', ts: t() });

    const lock = await client.getMailboxLock('INBOX');
    log.push({ step: 'inbox_locked', exists: client.mailbox?.exists, ts: t() });

    try {
      let result = null;

      if (fetchMode === 'structure') {
        // Fetch ONLY bodyStructure + envelope — fast, no body content
        log.push({ step: 'fetch_structure_start', uid: targetUid, ts: t() });
        for await (const msg of client.fetch(
          { uid: `${targetUid}` },
          { bodyStructure: true, envelope: true },
          { uid: true }
        )) {
          result = {
            uid: msg.uid,
            subject: msg.envelope?.subject,
            bodyStructure: JSON.stringify(msg.bodyStructure, null, 2)?.substring(0, 3000),
          };
          break;
        }
        log.push({ step: 'fetch_structure_done', ts: t() });

      } else if (fetchMode === 'part1') {
        // Use raw IMAP command to fetch BODY.PEEK[1] directly — avoids imapflow buffering issues
        log.push({ step: 'fetch_raw_body1_start', uid: targetUid, ts: t() });
        const rawResponse = await client.search({ uid: `${targetUid}` }); // just to confirm uid
        log.push({ step: 'uid_confirmed', found: rawResponse?.includes(targetUid), ts: t() });
        
        // Use imapflow's fetchOne for a single message
        const singleMsg = await client.fetchOne(`${targetUid}`, { bodyParts: ['1'] }, { uid: true });
        log.push({ step: 'fetchOne_done', ts: t() });
        const p1 = singleMsg?.bodyParts?.['1'];
        result = {
          uid: targetUid,
          part1_size: p1?.length || 0,
          part1_preview: (p1?.toString('utf-8') || '').substring(0, 1000),
        };
        log.push({ step: 'fetch_part1_done', size: result?.part1_size, ts: t() });

      } else if (fetchMode === 'fetchone_envelope') {
        // fetchOne with envelope only
        log.push({ step: 'fetchone_envelope_start', uid: targetUid, ts: t() });
        const msg = await client.fetchOne(`${targetUid}`, { envelope: true, bodyStructure: true }, { uid: true });
        log.push({ step: 'fetchone_envelope_done', ts: t() });
        result = {
          uid: targetUid,
          subject: msg?.envelope?.subject,
          bodyStructure: JSON.stringify(msg?.bodyStructure)?.substring(0, 1000),
        };

      } else if (fetchMode === 'bodyparts') {
        // Try fetching TEXT section only
        log.push({ step: 'fetch_bodyparts_start', uid: targetUid, ts: t() });
        for await (const msg of client.fetch(
          { uid: `${targetUid}` },
          { bodyParts: ['TEXT', '1', '1.1', '1.2', '2'], envelope: true },
          { uid: true }
        )) {
          const parts = {};
          if (msg.bodyParts) {
            for (const [k, v] of Object.entries(msg.bodyParts)) {
              parts[k] = `[${v?.length || 0} bytes] ${(v?.toString('utf-8') || '').substring(0, 200)}`;
            }
          }
          result = { uid: msg.uid, subject: msg.envelope?.subject, parts };
          break;
        }
        log.push({ step: 'fetch_bodyparts_done', result_keys: result ? Object.keys(result.parts || {}) : [], ts: t() });

      } else if (fetchMode === 'source') {
        // Full source fetch
        log.push({ step: 'fetch_source_start', uid: targetUid, ts: t() });
        for await (const msg of client.fetch(
          { uid: `${targetUid}` },
          { source: true },
          { uid: true }
        )) {
          result = {
            uid: msg.uid,
            source_size: msg.source?.length || 0,
            source_preview: msg.source?.toString('utf-8')?.substring(0, 500),
          };
          break;
        }
        log.push({ step: 'fetch_source_done', source_size: result?.source_size, ts: t() });

      } else if (fetchMode === 'text_only') {
        // Fetch BODY[TEXT] specifically
        log.push({ step: 'fetch_text_start', uid: targetUid, ts: t() });
        for await (const msg of client.fetch(
          { uid: `${targetUid}` },
          { bodyParts: ['TEXT'] },
          { uid: true }
        )) {
          const textPart = msg.bodyParts?.['TEXT'];
          result = {
            uid: msg.uid,
            text_size: textPart?.length || 0,
            text_preview: (textPart?.toString('utf-8') || '').substring(0, 500),
          };
          break;
        }
        log.push({ step: 'fetch_text_done', text_size: result?.text_size, ts: t() });
      }

      lock.release();
      await client.logout().catch(() => {});

      return Response.json({
        success: true,
        result,
        log,
        imap_log: imapLog,
        total_ms: t(),
      });

    } catch (err) {
      lock.release();
      throw err;
    }

  } catch (err) {
    try { await client.logout().catch(() => {}); } catch (_) {}
    log.push({ step: 'ERROR', error: String(err).substring(0, 300), ts: t() });
    return Response.json({ success: false, error: String(err).substring(0, 300), log, imap_log: imapLog, total_ms: t() }, { status: 500 });
  }
});