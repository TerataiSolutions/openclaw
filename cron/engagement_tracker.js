'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const USER_MESSAGE_TYPES = ['user_message', 'exchange', 'conversation'];
const MIN_SAMPLES = 10;
const ALERT_THRESHOLD = 0.3;

async function getOpenDeliveryLogs() {
  const { data, error } = await supabase
    .from('memories')
    .select('id, content, created_at')
    .eq('type', 'delivery_log')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`getOpenDeliveryLogs failed: ${error.message}`);
  return (data || [])
    .map(row => {
      const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
      return { rowId: row.id, createdAt: row.created_at, ...content };
    })
    .filter(log => log.engagement_result === null);
}

async function checkUserResponseAfter(deliveredAt, windowExpires) {
  const { data, error } = await supabase
    .from('memories')
    .select('id')
    .in('type', USER_MESSAGE_TYPES)
    .gt('created_at', deliveredAt)
    .lte('created_at', windowExpires)
    .limit(1);

  if (error) throw new Error(`checkUserResponse failed: ${error.message}`);
  return data && data.length > 0;
}

async function scoreDeliveryLog(log) {
  const now = new Date();
  const windowExpires = new Date(log.response_window_expires);
  const windowOpen = now < windowExpires;
  let result = null;

  if (windowOpen) {
    const responded = await checkUserResponseAfter(log.delivered_at, log.response_window_expires);
    if (responded) { result = 'engaged'; } else { return null; }
  } else {
    const responded = await checkUserResponseAfter(log.delivered_at, log.response_window_expires);
    result = responded ? 'engaged' : 'ignored';
  }

  const updatedContent = {
    behavior_id: log.behavior_id,
    delivered_at: log.delivered_at,
    response_window_expires: log.response_window_expires,
    engagement_result: result,
    scored_at: now.toISOString()
  };

  await supabase
    .from('memories')
    .update({ content: JSON.stringify(updatedContent) })
    .eq('id', log.rowId);

  return { behaviorId: log.behavior_id, result };
}

async function computeEngagementScores() {
  const { data, error } = await supabase
    .from('memories')
    .select('content')
    .eq('type', 'delivery_log')
    .limit(1000);

  if (error) throw new Error(`computeEngagementScores failed: ${error.message}`);

  const scored = (data || [])
    .map(row => typeof row.content === 'string' ? JSON.parse(row.content) : row.content)
    .filter(log => log.engagement_result !== null);

  const byBehavior = {};
  for (const log of scored) {
    const id = log.behavior_id;
    if (!byBehavior[id]) byBehavior[id] = { engaged: 0, ignored: 0 };
    if (log.engagement_result === 'engaged') byBehavior[id].engaged++;
    if (log.engagement_result === 'ignored') byBehavior[id].ignored++;
  }

  const scores = {};
  for (const [id, counts] of Object.entries(byBehavior)) {
    const total = counts.engaged + counts.ignored;
    scores[id] = {
      total_samples: total,
      engaged: counts.engaged,
      ignored: counts.ignored,
      engagement_rate: total > 0 ? Math.round((counts.engaged / total) * 100) / 100 : null,
      needs_review: total >= MIN_SAMPLES && (counts.engaged / total) < ALERT_THRESHOLD
    };
  }
  return scores;
}

async function writeEngagementSummary(scores) {
  const flagged = Object.entries(scores)
    .filter(([, s]) => s.needs_review)
    .map(([id, s]) => `${id} (${Math.round(s.engagement_rate * 100)}% engagement, ${s.total_samples} samples)`);

  const summary = {
    computed_at: new Date().toISOString(),
    scores,
    flagged_for_review: flagged
  };

  await supabase.from('memories').delete().eq('type', 'engagement_summary');
  await supabase.from('memories').insert({
    type: 'engagement_summary',
    content: JSON.stringify(summary),
    importance: 3,
    tags: ['engagement_summary', 'system']
  });

  return { flagged };
}

async function alertIfFlagged(flagged) {
  if (flagged.length === 0) return;
  let sendDiscordAlert;
  try {
    sendDiscordAlert = require('../discord').sendMessage;
  } catch {
    console.warn('[engagement_tracker] Discord unavailable for alert');
    return;
  }
  const lines = flagged.map(f => ` - ${f}`).join('\n');
  await sendDiscordAlert(
    `[engagement_tracker] ${flagged.length} behavior(s) below ${Math.round(ALERT_THRESHOLD * 100)}% engagement threshold after ${MIN_SAMPLES}+ samples:\n${lines}\nReview heartbeat_manifest.json to adjust or disable.`
  );
}

async function run() {
  console.log('[engagement_tracker] Starting...');
  try {
    const openLogs = await getOpenDeliveryLogs();
    console.log(`[engagement_tracker] ${openLogs.length} open delivery logs to evaluate`);

    let newlyScored = 0;
    for (const log of openLogs) {
      const result = await scoreDeliveryLog(log);
      if (result) {
        console.log(`[engagement_tracker] ${result.behaviorId}: ${result.result}`);
        newlyScored++;
      }
    }

    console.log(`[engagement_tracker] Scored ${newlyScored} logs this run`);
    const scores = await computeEngagementScores();
    const { flagged } = await writeEngagementSummary(scores);

    if (flagged.length > 0) {
      console.log(`[engagement_tracker] ${flagged.length} behavior(s) flagged for review`);
      await alertIfFlagged(flagged);
    } else {
      console.log('[engagement_tracker] No behaviors flagged');
    }
    console.log('[engagement_tracker] Done');
  } catch (err) {
    console.error('[engagement_tracker] Fatal error:', err.message);
    process.exit(1);
  }
}

run();
