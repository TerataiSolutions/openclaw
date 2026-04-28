'use strict';

const http = require('http');
const crypto = require('crypto');
const { saveMemoryWithEmbedding, logJson } = require('../utils.js');
const { runPostIngestAnalysis } = require('./post_ingest_analysis.js');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.FATHOM_WEBHOOK_PORT || 4242;
const WEBHOOK_SECRET = process.env.FATHOM_WEBHOOK_SECRET;
const CHUNK_WORD_LIMIT = 800;

// ── Client Name Map ───────────────────────────────────────────────────────────
// Loaded from client_map.json at startup.
// Keys are lowercase substrings that appear in Fathom meeting titles.
// Values are the client_id strings used in Supabase.
const CLIENT_MAP = require('./client_map.json');

// ── Meeting type classification ───────────────────────────────────────────────
// "Sales Enablement Sync" = internal (Opp + BDR team only, no client present)
// "Calibration Sync"      = external (client + internal team)
// Both get ingested. The meeting_type tag differentiates them in memory.
function classifyMeetingType(title) {
 const t = title.toLowerCase();
 if (t.includes('calibration sync')) return 'client_calibration';
 if (t.includes('sales enablement sync')) return 'internal_enablement';
 if (t.includes('cole') || t.includes('cro')) return 'executive_cro';
 if (t.includes('lance') || t.includes('ceo')) return 'executive_ceo';
 return 'general';
}

// ── Client ID resolution ──────────────────────────────────────────────────────
function resolveClientId(title) {
  const t = title.toLowerCase();
  for (const [keyword, clientId] of Object.entries(CLIENT_MAP)) {
    if (t.includes(keyword.toLowerCase())) return clientId;
  }
  return null; // triggers Discord override flow
}

// ── Webhook signature verification ───────────────────────────────────────────
function verifySignature(secret, headers, rawBody) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signature = headers['webhook-signature'];
  if (!id || !timestamp || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const signed = `${id}.${timestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
  const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');

  const sigs = signature.split(' ').map(s => {
    const parts = s.split(',');
    return parts.length > 1 ? parts[1] : parts[0];
  });

  return sigs.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch { return false; }
  });
}

// ── Transcript chunking (mirrors ingest_transcript.js exactly) ────────────────
function chunkTranscript(text, wordLimit) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let current = '';
  let wordCount = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (wordCount + sentenceWords > wordLimit && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = sentenceWords;
    } else {
      current += sentence;
      wordCount += sentenceWords;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

// ── Transcript extraction from Fathom payload ─────────────────────────────────
// Fathom sends transcript as an array of { speaker, text, timestamp } objects.
// We flatten to plain text: "Speaker: utterance" per line.
function extractPlainText(transcriptArray) {
  if (!Array.isArray(transcriptArray) || transcriptArray.length === 0) return null;
  return transcriptArray
    .map(t => `${t.speaker?.display_name || 'Unknown'}: ${t.text}`)
    .join('\n');
}

// ── Ingest pipeline ───────────────────────────────────────────────────────────
async function ingestTranscript(clientId, plainText, meetingType, meetingTitle) {
  const chunks = chunkTranscript(plainText, CHUNK_WORD_LIMIT);
  logJson('info', { event: 'fathom_ingest_start', client_id: clientId, meeting_title: meetingTitle, meeting_type: meetingType, total_chunks: chunks.length });

  let saved = 0, failed = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await saveMemoryWithEmbedding({
        type: 'meeting_transcript',
        content: chunks[i],
        client_id: clientId,
        importance: 8,
        tags: ['meeting_transcript', `client_${clientId}`, meetingType, 'fathom_auto']
      });
      if (result) { saved++; logJson('info', { event: 'chunk_saved', chunk_index: i + 1, memory_id: result.id }); }
      else { failed++; logJson('warn', { event: 'chunk_save_failed', chunk_index: i + 1 }); }
    } catch (err) {
      failed++;
      logJson('error', { event: 'chunk_error', chunk_index: i + 1, error: err.message });
    }
  }
  logJson('info', { event: 'fathom_ingest_complete', client_id: clientId, saved, failed, total_chunks: chunks.length });

  // Post-ingest analysis -- runs after all chunks are saved
  runPostIngestAnalysis({ clientId, plainText, meetingTitle, meetingType }).catch(err =>
    logJson('error', { event: 'post_ingest_analysis_failed', client_id: clientId, error: err.message })
  );

  return { saved, failed, total: chunks.length };
}

// ── Pending override queue ────────────────────────────────────────────────────
// When client_id cannot be resolved, the payload is held here keyed by a
// short token. The Discord command "Assign meeting: TOKEN CLIENT_ID" resolves it.
const pendingQueue = new Map();

function queuePending(payload, plainText, meetingType) {
  const token = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9C1"
  pendingQueue.set(token, { payload, plainText, meetingType, queuedAt: Date.now() });

  // Auto-expire after 24 hours to prevent unbounded growth
  setTimeout(() => pendingQueue.delete(token), 24 * 60 * 60 * 1000);
  return token;
}

// Exported so the Discord command handler can call it
async function resolveOverride(token, clientId) {
  const entry = pendingQueue.get(token);
  if (!entry) return { ok: false, reason: 'Token not found or expired' };
  pendingQueue.delete(token);
  const meetingType = entry.meetingType;
  const meetingTitle = entry.payload.meeting_title || entry.payload.title || 'Unknown';
  const result = await ingestTranscript(clientId, entry.plainText, meetingType, meetingTitle);
  return { ok: true, ...result };
}

module.exports = { resolveOverride };

// ── Discord alert helper ──────────────────────────────────────────────────────
async function alertDiscord(token, meetingTitle) {
  const DISCORD_WEBHOOK_URL = process.env.AETHER_DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) return;

  const body = JSON.stringify({
    content: `**Fathom meeting ingestion needs your help.**\n\nMeeting: \`${meetingTitle}\`\nToken: \`${token}\`\n\nI couldn't match this meeting to a client. Assign it with:\n\`\`\`\nAssign meeting: ${token} [client_id]\n\`\`\``
  });

  try {
    const url = new URL(DISCORD_WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    await new Promise((resolve, reject) => {
      const req = http.request(options, res => resolve(res));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    logJson('error', { event: 'discord_alert_failed', error: err.message });
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/fathom/webhook') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      // Signature verification
      if (WEBHOOK_SECRET && !verifySignature(WEBHOOK_SECRET, req.headers, rawBody)) {
        logJson('warn', { event: 'fathom_webhook_invalid_signature' });
        res.writeHead(401).end('Unauthorized');
        return;
      }

      let payload;
      try { payload = JSON.parse(rawBody); }
      catch { res.writeHead(400).end('Bad JSON'); return; }

      // Acknowledge immediately -- Fathom expects a fast 200
      res.writeHead(200).end('OK');

      const meetingTitle = payload.meeting_title || payload.title || '';
      const transcriptArray = payload.transcript || [];
      const plainText = extractPlainText(transcriptArray);

      if (!plainText) {
        logJson('warn', { event: 'fathom_webhook_no_transcript', meeting_title: meetingTitle });
        return;
      }

      const meetingType = classifyMeetingType(meetingTitle);
      const clientId = resolveClientId(meetingTitle);

      if (clientId) {
        await ingestTranscript(clientId, plainText, meetingType, meetingTitle);
      } else {
        const token = queuePending(payload, plainText, meetingType);
        logJson('warn', { event: 'fathom_webhook_unresolved_client', meeting_title: meetingTitle, token });
        await alertDiscord(token, meetingTitle);
      }
    });
  } else if (req.method === 'POST' && req.url === '/assign') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(rawBody); } catch {
        res.writeHead(400).end(JSON.stringify({ ok: false, reason: 'Bad JSON' }));
        return;
      }
      const { token, client_id } = payload;
      if (!token || !client_id) {
        res.writeHead(400).end(JSON.stringify({ ok: false, reason: 'Missing token or client_id' }));
        return;
      }
      const result = await resolveOverride(token, client_id);
      res.writeHead(result.ok ? 200 : 404).end(JSON.stringify(result));
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200).end(JSON.stringify({ ok: true, uptime: process.uptime() }));
  } else {
    res.writeHead(404).end();
  }
});

server.listen(PORT, () => {
  logJson('info', { event: 'fathom_webhook_server_started', port: PORT });
});