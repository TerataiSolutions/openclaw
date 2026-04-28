#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { getSupabaseClient } = require('../lib/clients/supabase');
const { logJson } = require('../utils.js');
const { applyDependencyResults } = require('./capability_monitor.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const LAST_ALERT = '/data/.openclaw/workspace/.last_dependency_alert.json';
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

async function sendDiscordAlert(message) {
  try {
    const { sendMessage } = require('./message_bridge.js');
    if (typeof sendMessage === 'function') {
      await sendMessage(message);
    }
  } catch (e) {
    console.error('[dependency_healthcheck] Failed to send alert:', e.message);
  }
}

/**
 * Detect configuration drift between openclaw.json (gateway) and config.json (workspace).
 * Strips token/secrets before comparing to avoid noise from expected differences.
 */
function loadLastAlert() {
  try {
    if (fs.existsSync(LAST_ALERT)) {
      return JSON.parse(fs.readFileSync(LAST_ALERT, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function shouldAlert(service) {
  const lastAlert = loadLastAlert();
  const lastTime = lastAlert[service] || 0;
  const now = Date.now();

  if (now - lastTime < ALERT_COOLDOWN_MS) {
    return false; // Cooldown active, suppress
  }

  lastAlert[service] = now;
  try {
    fs.writeFileSync(LAST_ALERT, JSON.stringify(lastAlert), 'utf8');
  } catch (_) {}
  return true;
}

function detectConfigDrift() {
  try {
    const openclaw = JSON.parse(fs.readFileSync('/data/.openclaw/openclaw.json', 'utf8'));
    const workspace = JSON.parse(fs.readFileSync('/data/.openclaw/workspace/config.json', 'utf8'));

    const drifts = [];

    // Compare primary model
    const ocModel = openclaw.agents?.defaults?.model?.primary;
    const wsModel = workspace.agents?.defaults?.model?.primary;
    if (ocModel !== wsModel) {
      drifts.push(`Primary model: gateway=${ocModel} vs workspace=${wsModel}`);
    }

    // Compare discord config (strip token from gateway config first)
    const ocDiscord = openclaw.channels?.discord ? { ...openclaw.channels.discord } : null;
    if (ocDiscord) {
      delete ocDiscord.token; // not stored in workspace config
    }
    const wsDiscord = workspace.channels?.discord || null;
    if (JSON.stringify(ocDiscord) !== JSON.stringify(wsDiscord)) {
      drifts.push('Discord channel config mismatch');
      logJson('warn', { event: 'config_drift', ocDiscord, wsDiscord });
    }

    // Compare gateway port
    const ocPort = openclaw.gateway?.port;
    const wsPort = workspace.gateway?.port;
    if (ocPort !== wsPort) {
      drifts.push(`Gateway port: gateway=${ocPort} vs workspace=${wsPort}`);
    }

    if (drifts.length > 0) {
      logJson('warn', { event: 'config_drift_detected', drifts });
    }

    return drifts;
  } catch (e) {
    logJson('error', { event: 'config_drift_check_failed', error: e.message });
    return [`Config drift check failed: ${e.message}`];
  }
}

async function checkDependencies() {
  const results = {};
  let anyFailed = false;

  // Supabase
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      results.supabase = { status: 'SKIPPED', reason: 'Missing env vars' };
    } else {
      const sb = getSupabaseClient();
      const { count, error } = await sb.from('memories').select('id', { count: 'exact', head: true });
      if (error) {
        results.supabase = { status: 'FAIL', error: error.message };
        anyFailed = true;
      } else {
        results.supabase = { status: 'OK', count };
      }
    }
  } catch (e) {
    results.supabase = { status: 'FAIL', error: e.message };
    anyFailed = true;
  }

  // Cohere
  try {
    if (!COHERE_API_KEY) {
      results.cohere = { status: 'SKIPPED', reason: 'Missing COHERE_API_KEY' };
    } else {
      const res = await fetch('https://api.cohere.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${COHERE_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        results.cohere = { status: `FAIL (${res.status})`, body: await res.text().catch(() => '') };
        anyFailed = true;
      } else {
        results.cohere = { status: 'OK' };
      }
    }
  } catch (e) {
    results.cohere = { status: 'FAIL', error: e.message };
    anyFailed = true;
  }

  // DeepSeek
  try {
    if (!DEEPSEEK_API_KEY) {
      results.deepseek = { status: 'SKIPPED', reason: 'Missing DEEPSEEK_API_KEY' };
    } else {
      const res = await fetch('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        results.deepseek = { status: `FAIL (${res.status})`, body: await res.text().catch(() => '') };
        anyFailed = true;
      } else {
        results.deepseek = { status: 'OK' };
      }
    }
  } catch (e) {
    results.deepseek = { status: 'FAIL', error: e.message };
    anyFailed = true;
  }

  // Config drift detection
  const drifts = detectConfigDrift();
  if (drifts.length > 0) {
    results.configDrift = { status: 'DRIFT', items: drifts };
    anyFailed = true;
  } else {
    results.configDrift = { status: 'OK' };
  }

  // Webhook server health
  try {
    const res = await fetch('http://localhost:4242/health');
    results.webhook = { status: res.ok ? 'OK' : `FAIL (${res.status})` };
    if (!res.ok) anyFailed = true;
  } catch (e) {
    results.webhook = { status: 'FAIL', error: e.message };
    anyFailed = true;
  }

  // Update capability status from dependency results
  const depMap = {
    supabase: results.supabase,
    cohere: results.cohere,
    deepseek: results.deepseek,
  };
  try { applyDependencyResults(depMap); } catch (e) {
    logJson('error', { event: 'capability_update_failed', error: e.message });
  }

  // Log results
  logJson('info', { event: 'dependency_healthcheck', results, anyFailed });

  // Alert on failures with per-service cooldown
  if (anyFailed) {
    const failures = Object.entries(results).filter(([_, r]) => r.status !== 'OK');
    for (const [service, result] of failures) {
      if (shouldAlert(service)) {
        const detail = result.error || result.body || (result.items ? result.items.join('; ') : result.status);
        await sendDiscordAlert(`⚠️ **${service.toUpperCase()} Degraded**: ${detail}`);
      }
    }
  }

  // Webhook-specific alert (separate from generic failure loop for dedup clarity)
  if (results.webhook && !results.webhook.status.includes('OK')) {
    if (shouldAlert('webhook', false, true)) {
      await sendDiscordAlert(`⚠️ **Webhook server is DOWN**. Last error: ${results.webhook.error || results.webhook.status}`);
    }
  }

  return results;
}

if (require.main === module) {
  checkDependencies()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[dependency_healthcheck] Fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { checkDependencies };
