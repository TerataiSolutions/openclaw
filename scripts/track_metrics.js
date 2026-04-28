#!/usr/bin/env node
'use strict';

/**
 * track_metrics.js — Collect and persist system health metrics.
 *
 * Every run appends a JSON line to metrics.jsonl with:
 *   - Gateway RSS (MB)
 *   - Memory count (Supabase row count)
 *   - Message queue depth
 *   - Cron success rate (last 24h from cron log entries)
 *   - Cohere error rate (last 24h from error-log memories)
 *
 * Threshold alerts: gateway RSS > 1200 MB triggers Discord alert.
 *
 * Usage:
 *   node scripts/track_metrics.js          # run once
 *   (cron): 45 23 * * *                    # nightly at 11:45 PM UTC
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendDiscordAlert } = require('../lib/clients/discord');
const { logJson } = require('../utils.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const METRICS_FILE = path.join(__dirname, '..', 'metrics.jsonl');
const QUEUE_FILE = path.join(__dirname, '..', 'message_queue.jsonl');

// ── Metric collectors ─────────────────────────────────────────────────────────

/**
 * Find the openclaw-gateway PID and return its RSS in MB.
 * Falls back to 0 if the process is not found.
 */
function getGatewayRssMb() {
  try {
    const pid = require('child_process')
      .execSync("pgrep -f 'openclaw-gateway$'", { encoding: 'utf8', timeout: 3000 })
      .trim()
      .split('\n')[0];

    if (!pid) return 0;

    const rssKb = parseInt(
      require('child_process')
        .execSync(`ps -p ${pid} -o rss=`, { encoding: 'utf8', timeout: 3000 })
        .trim(),
      10
    );
    return Math.round((rssKb / 1024) * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Count all rows in the memories table.
 */
async function getMemoryCount() {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { count, error } = await sb
      .from('memories')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  } catch (err) {
    logJson('error', { event: 'metrics_memory_count_failed', error: err.message });
    return -1;
  }
}

/**
 * Count queued (unflushed) messages in the message queue file.
 */
function getQueueDepth() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return 0;
    const content = fs.readFileSync(QUEUE_FILE, 'utf8').trim();
    if (!content) return 0;
    return content.split('\n').length;
  } catch {
    return -1;
  }
}

/**
 * Calculate cron job success rate over the last 24 hours.
 * Reads type=conversation memories with 'cron_completed' or 'cron_failed' tags.
 */
async function getCronSuccessRate() {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from('memories')
      .select('content, tags')
      .gte('created_at', since)
      .contains('tags', ['cron']);

    if (error) throw error;
    if (!data || data.length === 0) return { rate: 1.0, total: 0, successes: 0 };

    let successes = 0;
    let total = 0;
    for (const m of data) {
      const tags = Array.isArray(m.tags) ? m.tags : [];
      if (tags.includes('cron_completed')) { successes++; total++; }
      else if (tags.includes('cron_failed')) { total++; }
      // Also check content for success/failure patterns
      else if (m.content && m.content.toLowerCase().includes('completed')) { successes++; total++; }
      else if (m.content && m.content.toLowerCase().includes('failed')) { total++; }
    }

    return {
      rate: total > 0 ? Math.round((successes / total) * 10000) / 10000 : 1.0,
      total,
      successes,
    };
  } catch (err) {
    logJson('error', { event: 'metrics_cron_rate_failed', error: err.message });
    return { rate: -1, total: 0, successes: 0 };
  }
}

/**
 * Calculate Cohere API error rate over the last 24 hours.
 * Reads error-log memories or logs tagged with 'cohere_error'.
 */
async function getCohereErrorRate() {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from('memories')
      .select('tags')
      .gte('created_at', since)
      .contains('tags', ['cohere']);

    if (error) throw error;
    if (!data || data.length === 0) return { rate: 0, total: 0, errors: 0 };

    let errors = 0;
    let total = 0;
    for (const m of data) {
      const tags = Array.isArray(m.tags) ? m.tags : [];
      if (tags.includes('cohere_error')) { errors++; total++; }
      else if (tags.includes('cohere_ok') || tags.includes('cohere_success')) { total++; }
    }

    return {
      rate: total > 0 ? Math.round((errors / total) * 10000) / 10000 : 0,
      total,
      errors,
    };
  } catch (err) {
    logJson('error', { event: 'metrics_cohere_rate_failed', error: err.message });
    return { rate: -1, total: 0, errors: 0 };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function trackMetrics() {
  const [memoryCount, cronStatus, cohereStatus] = await Promise.all([
    getMemoryCount(),
    getCronSuccessRate(),
    getCohereErrorRate(),
  ]);

  const metrics = {
    timestamp: new Date().toISOString(),
    gateway_rss_mb: getGatewayRssMb(),
    memory_count: memoryCount,
    message_queue_depth: getQueueDepth(),
    cron_success_rate: cronStatus.rate,
    cron_jobs_24h: cronStatus.total,
    cron_successes_24h: cronStatus.successes,
    cohere_error_rate: cohereStatus.rate,
    cohere_calls_24h: cohereStatus.total,
    cohere_errors_24h: cohereStatus.errors,
  };

  // Append to metrics.jsonl
  fs.appendFileSync(METRICS_FILE, JSON.stringify(metrics) + '\n');

  logJson('info', { event: 'metrics_recorded', ...metrics });

  // Alert if gateway RSS approaches OOM territory
  if (metrics.gateway_rss_mb > 1200) {
    await sendDiscordAlert(
      `⚠️ **Gateway Memory Alert**\nRSS: ${metrics.gateway_rss_mb} MB (approaching OOM limit)`
    );
  }

  // Alert if cron failure rate > 10%
  if (cronStatus.total > 0 && cronStatus.rate < 0.9) {
    await sendDiscordAlert(
      `⚠️ **Cron Failure Rate High**\n${cronStatus.successes}/${cronStatus.total} jobs succeeded ` +
      `(${(cronStatus.rate * 100).toFixed(0)}%) in the last 24h`
    );
  }

  // Alert if Cohere error rate > 20%
  if (cohereStatus.total > 0 && cohereStatus.rate > 0.2) {
    await sendDiscordAlert(
      `⚠️ **Cohere Error Rate High**\n${cohereStatus.errors}/${cohereStatus.total} calls failed ` +
      `(${(cohereStatus.rate * 100).toFixed(0)}%) in the last 24h`
    );
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  trackMetrics().catch(err => {
    console.error('[track_metrics] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { trackMetrics };
