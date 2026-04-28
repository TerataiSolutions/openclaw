'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '1122248771208757279';

const SESSION_ACTIVE_WINDOW_MINUTES = 30;
const RESPONSE_TIMEOUT_MINUTES = 10;
const ALERT_COOLDOWN_MINUTES = 60;

const QUIET_START_EASTERN = 23;
const QUIET_END_EASTERN = 7;
const STATE_FILE = '/data/.openclaw/aof/watchdog_state.json';

function getEasternHour() {
  const now = new Date();
  return parseInt(now.toLocaleString('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit'
  }));
}

function isQuietHours() {
  const hour = getEasternHour();
  return hour >= QUIET_START_EASTERN || hour < QUIET_END_EASTERN;
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.last_message_ts !== 'number') {
      return { last_message_ts: Date.now(), last_user_ts: 0, last_alert_ts: 0 };
    }
    return {
      last_message_ts: parsed.last_message_ts || Date.now(),
      last_user_ts: parsed.last_user_ts || 0,
      last_alert_ts: parsed.last_alert_ts || 0
    };
  } catch (_) {
    return { last_message_ts: Date.now(), last_user_ts: 0, last_alert_ts: 0 };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function discordRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10${endpoint}`,
      method,
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: res.statusCode < 300, body: data, status: res.statusCode }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sendDiscordDM(message) {
  const dmRes = await discordRequest('POST', '/users/@me/channels', { recipient_id: DISCORD_USER_ID }, DISCORD_TOKEN);
  if (!dmRes.ok) { console.error('[watchdog] DM channel error:', dmRes.body); return; }
  const channelId = JSON.parse(dmRes.body).id;
  await discordRequest('POST', `/channels/${channelId}/messages`, { content: message }, DISCORD_TOKEN);
}

async function checkLastActivity() {
  if (isQuietHours()) { console.log('[watchdog] quiet hours, skipping'); return; }
  if (!DISCORD_TOKEN) { console.error('[watchdog] no Discord token'); return; }

  const state = loadState();
  const now = Date.now();

  const minutesSinceAether = (now - state.last_message_ts) / 60000;
  const minutesSinceUser = state.last_user_ts ? (now - state.last_user_ts) / 60000 : Infinity;
  const minutesSinceAlert = state.last_alert_ts ? (now - state.last_alert_ts) / 60000 : Infinity;

  console.log(`[watchdog] mins since Aether msg: ${minutesSinceAether.toFixed(1)} | mins since user msg: ${minutesSinceUser.toFixed(1)} | mins since last alert: ${minutesSinceAlert.toFixed(1)}`);

  const sessionIsActive = minutesSinceUser <= SESSION_ACTIVE_WINDOW_MINUTES;
  const aetherIsLate = minutesSinceAether >= RESPONSE_TIMEOUT_MINUTES;
  const cooldownExpired = minutesSinceAlert >= ALERT_COOLDOWN_MINUTES;

  if (sessionIsActive && aetherIsLate && cooldownExpired) {
    console.log('[watchdog] active session with no Aether response -- sending alert');
    await sendDiscordDM(
      `🦞 **Silence alert** — Aether-7 has not responded in ${Math.round(minutesSinceAether)} minutes during an active session.\n\nSend \`ping\` to check if I am alive, or \`/reset\` if the context window is full.`
    );
    state.last_alert_ts = now;
    saveState(state);
  } else if (!sessionIsActive) {
    console.log('[watchdog] no active session -- skipping alert');
  } else if (!aetherIsLate) {
    console.log('[watchdog] Aether responded recently -- no alert needed');
  } else if (!cooldownExpired) {
    console.log(`[watchdog] alert cooldown active -- ${Math.round(ALERT_COOLDOWN_MINUTES - minutesSinceAlert)} min remaining`);
  }
}

checkLastActivity().catch(e => console.error('[watchdog] error:', e.message));
