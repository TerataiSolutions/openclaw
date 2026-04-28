'use strict';

const https = require('https');
const { saveMemoryWithEmbedding, logJson } = require('../utils.js');
const { execSync } = require('child_process');

const CLIENTS = [
  { id: 'opp', name: 'Opp Agency', blogUrl: 'https://opp.agency/blog' },
  { id: 'customer_contact_services', name: 'Customer Contact Services', blogUrl: 'https://yourccsteam.com/blog' },
  { id: 'sturdy', name: 'Sturdy', blogUrl: 'https://www.sturdy.ai/blog' },
  { id: 'seneca_global', name: 'SenecaGlobal', blogUrl: 'https://www.senecaglobal.com/blog' },
  { id: 'pecan', name: 'Pecan', blogUrl: 'https://www.pecan.ai/blog' },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Aether-7/1.0)', 'Accept': 'text/html' }, timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(fetchPage(res.headers.location));
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

function extractRecentContent(html) {
  const signals = [];
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const datePatterns = [/(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/gi, /(\d{4}-\d{2}-\d{2})/g, /(\d{1,2}\/\d{1,2}\/\d{4})/g];
  const now = Date.now();
  const found = new Set();
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(stripped)) !== null) {
      const parsed = new Date(match[1]);
      if (isNaN(parsed.getTime()) || now - parsed.getTime() > SEVEN_DAYS_MS) continue;
      const context = stripped.slice(Math.max(0, match.index - 100), Math.min(stripped.length, match.index + 150)).trim().replace(/\s+/g, ' ');
      const key = match[1] + context.slice(0, 40);
      if (!found.has(key)) { found.add(key); signals.push({ date: match[1], context }); }
    }
  }
  return signals;
}

async function sendDiscordDM(message) {
  try { execSync(`node /data/.openclaw/workspace/cron/message_bridge.js ${JSON.stringify(message)}`, { stdio: 'inherit' }); }
  catch (err) { logJson('error', { event: 'discord_send_failed', error: err.message }); }
}

async function main() {
  logJson('info', { event: 'market_pulse_start' });
  const results = await Promise.allSettled(CLIENTS.map(async client => {
    try {
      const { status, body } = await fetchPage(client.blogUrl);
      if (status !== 200) return { client, found: false, reason: `HTTP ${status}` };
      const signals = extractRecentContent(body);
      return { client, found: signals.length > 0, signals };
    } catch (err) { return { client, found: false, reason: err.message }; }
  }));
  const summaryParts = [];
  let signalsFound = 0;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { client, found, signals, reason } = result.value;
    if (found && signals.length > 0) {
      signalsFound++;
      for (const sig of signals.slice(0, 3)) {
        await saveMemoryWithEmbedding({ type: 'market_signal', content: `Market signal for ${client.name}: Recent content on ${client.blogUrl}. Date: ${sig.date}. Context: ${sig.context}`, client_id: client.id, importance: 7, tags: ['market_signal', `client_${client.id}`] });
      }
      summaryParts.push(`${client.name}: ${signals.length} recent item(s). Latest around ${signals[0].date}.`);
    } else {
      summaryParts.push(`${client.name}: No new content in last 7 days.${reason ? ` (${reason})` : ''}`);
    }
  }
  const now = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  await sendDiscordDM(`${signalsFound > 0 ? `Market pulse for ${now} — ${signalsFound} client(s) with new activity:` : `Market pulse for ${now} — nothing new across all 5 clients.`}\n\n${summaryParts.join('\n')}`);
  logJson('info', { event: 'market_pulse_complete', signals_found: signalsFound });
}

main().catch(err => { logJson('error', { event: 'market_pulse_fatal', error: err.message }); process.exit(1); });