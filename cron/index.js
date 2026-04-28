'use strict';

const cron = require('node-cron');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CRON_DIR = __dirname;
const MANIFEST_PATH = path.join(CRON_DIR, 'heartbeat_manifest.json');
const LOCK_FILE = path.join(CRON_DIR, '..', 'cron.lock');
const LOG_PATH = path.join(CRON_DIR, '..', 'logs', 'cron_engine.log');

let sendDiscordAlert;
try {
  sendDiscordAlert = require('../discord').sendMessage;
} catch {
  sendDiscordAlert = (msg) => console.warn('[discord unavailable]', msg);
}

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
    try {
      process.kill(existingPid, 0);
      console.error(`[cron-engine] Lock held by PID ${existingPid}. Exiting.`);
      process.exit(1);
    } catch {
      console.warn(`[cron-engine] Stale lock (PID ${existingPid} dead). Overwriting.`);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch {} });
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

function log(level, behaviorId, message) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    behavior: behaviorId,
    message
  });
  console.log(line);
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch {}
}

function isQuietHours() {
  const hour = new Date().getUTCHours();
  return hour >= 23 || hour < 8;
}

async function writeDeliveryLog(behaviorId) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('memories').insert({
      type: 'delivery_log',
      content: JSON.stringify({
        behavior_id: behaviorId,
        delivered_at: new Date().toISOString(),
        response_window_expires: expiresAt,
        engagement_result: null
      }),
      importance: 2,
      tags: ['delivery_log', behaviorId]
    });
  } catch (err) {
    log('warn', behaviorId, `delivery_log write failed: ${err.message}`);
  }
}

function runScript(behavior) {
  const scriptPath = path.join(CRON_DIR, behavior.handler);
  if (!fs.existsSync(scriptPath)) {
    log('error', behavior.id, `handler not found: ${scriptPath}`);
    return;
  }
  log('info', behavior.id, 'starting');
  exec(`node ${scriptPath}`, { timeout: 120000 }, (err, stdout, stderr) => {
    if (err) {
      log('error', behavior.id, `exec failed: ${err.message}`);
      sendDiscordAlert(`[cron-engine] ${behavior.id} failed: ${err.message}`);
      return;
    }
    if (stderr) log('warn', behavior.id, `stderr: ${stderr.trim()}`);
    log('info', behavior.id, 'completed');
    if (behavior.log_delivery) writeDeliveryLog(behavior.id);
  });
}

function runJob(behavior) {
  const scriptPath = behavior.absolute_path;
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    log('error', behavior.id, `absolute_path missing or not found: ${scriptPath}`);
    return;
  }
  log('info', behavior.id, 'starting (job)');
  const child = spawn('node', [scriptPath], { stdio: 'pipe' });
  child.unref();
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('close', (code) => {
    if (code !== 0) {
      log('error', behavior.id, `job exited ${code}: ${stderr.trim()}`);
      sendDiscordAlert(`[cron-engine] ${behavior.id} exited with code ${code}`);
      return;
    }
    log('info', behavior.id, 'completed (job)');
    if (behavior.log_delivery) writeDeliveryLog(behavior.id);
  });
}

function dispatch(behavior) {
  if (isQuietHours()) {
    if (behavior.category !== 'system_maintenance') {
      log('info', behavior.id, 'skipped (quiet hours)');
      return;
    }
  }
  switch (behavior.execution_model) {
    case 'runScript': runScript(behavior); break;
    case 'runJob': runJob(behavior); break;
    default: log('error', behavior.id, `unknown execution_model: ${behavior.execution_model}`);
  }
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[cron-engine] FATAL: manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.error(`[cron-engine] FATAL: manifest parse error: ${err.message}`);
    process.exit(1);
  }
}

function start() {
  acquireLock();
  const manifest = loadManifest();
  const behaviors = manifest.behaviors;
  let registered = 0;
  let skipped = 0;

  for (const behavior of behaviors) {
    if (behavior.status !== 'live') {
      log('info', behavior.id, `skipped registration (status: ${behavior.status})`);
      skipped++;
      continue;
    }
    if (!behavior.schedule) {
      log('info', behavior.id, 'no schedule — programmatic trigger only');
      skipped++;
      continue;
    }
    if (!cron.validate(behavior.schedule)) {
      log('error', behavior.id, `invalid cron expression: ${behavior.schedule}`);
      skipped++;
      continue;
    }
    cron.schedule(behavior.schedule, () => dispatch(behavior), { timezone: 'UTC' });
    log('info', behavior.id, `registered: ${behavior.schedule}`);
    registered++;
  }

  log('info', 'cron-engine', `started. ${registered} behaviors registered. ${skipped} skipped.`);
  sendDiscordAlert(`[cron-engine] Online. ${registered} behaviors active.`);
}

start();
