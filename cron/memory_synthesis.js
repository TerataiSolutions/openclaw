#!/usr/bin/env node
'use strict';

/**
 * memory_synthesis.js — Cross-reference new memories against old ones to
 * surface synthesized insights.
 *
 * Runs once daily. For each memory created in the last 24 hours (importance > 2),
 * it semantically searches for related old memories above threshold 0.65.
 * When a connection is found (≥2 related memories), it calls DeepSeek through
 * the OpenClaw gateway to generate a 1-2 sentence insight, saves it as a new
 * `synthesis` memory, and alerts on Discord.
 *
 * Schedule: cron/index.js 25 8 * * * (8:25 AM ET, after pattern daily summary)
 */

const { getSupabaseClient } = require('../lib/clients/supabase');
const { searchMemories } = require('../lib/session-primer');
const { sendDiscordAlert } = require('../lib/clients/discord');
const { saveMemoryWithEmbedding, logJson } = require('../utils.js');

// ── Config ────────────────────────────────────────────────────────────────────
const OPENCLAW_API_URL =
  process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080/v1/chat/completions';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';
const WINDOW_HOURS = 24;
const MIN_RELATED = 2;       // require at least this many related memories
const SIM_THRESHOLD = 0.65;  // only consider strong semantic matches
const MAX_NEW_MEMORIES = 20; // cap per run to control cost/time

// ── LLM call via DeepSeek through OpenClaw gateway ───────────────────────────
async function callDeepSeek(prompt) {
  const response = await fetch(OPENCLAW_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(OPENCLAW_API_KEY && { Authorization: `Bearer ${OPENCLAW_API_KEY}` }),
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`DeepSeek call failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Insight generation prompt ─────────────────────────────────────────────────
function buildInsightPrompt(newMemory, related) {
  return [
    'You are a pattern-recognition assistant. Given one new memory and several related memories from the past,',
    'synthesize a 1-2 sentence insight that connects them. Focus on actionable observations.',
    'Respond with ONLY the insight text. No preamble, no labels, no bullet points.',
    '',
    `New memory (${newMemory.type}): ${newMemory.content}`,
    '',
    'Related memories:',
    ...related.map((m, i) => `${i + 1}. [${m.type}] ${m.content}`),
    '',
    'Insight:',
  ].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function synthesizeInsights() {
  const sb = getSupabaseClient();

  // 1. Fetch memories from the last WINDOW_HOURS with importance > 2
  const startTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: newMemories, error } = await sb
    .from('memories')
    .select('id, content, type, importance')
    .gte('created_at', startTime)
    .gt('importance', 2)
    .order('importance', { ascending: false })
    .limit(MAX_NEW_MEMORIES);

  if (error) {
    logJson('error', { event: 'synthesis_fetch_failed', error: error.message });
    return;
  }

  if (!newMemories || newMemories.length === 0) {
    logJson('info', { event: 'synthesis_skip', reason: 'no_new_memories' });
    return;
  }

  logJson('info', {
    event: 'synthesis_start',
    candidateCount: newMemories.length,
    window: `${WINDOW_HOURS}h`,
  });

  let insightsCreated = 0;
  let insightsSkipped = 0;

  for (const memory of newMemories) {
    // 2. Search for related old memories
    const related = await searchMemories(memory.content, {
      limit: MIN_RELATED + 1,  // fetch extra to account for self-match
      threshold: SIM_THRESHOLD,
    });

    // Filter out the memory itself (self-match)
    const filtered = related.filter(r => r.content !== memory.content);

    if (filtered.length < MIN_RELATED) {
      insightsSkipped++;
      continue;
    }

    // 3. Generate insight via DeepSeek
    const prompt = buildInsightPrompt(memory, filtered.slice(0, 3));
    let insight;
    try {
      insight = await callDeepSeek(prompt);
    } catch (err) {
      logJson('error', {
        event: 'synthesis_llm_failed',
        memoryId: memory.id,
        error: err.message,
      });
      insightsSkipped++;
      continue;
    }

    if (!insight.trim()) {
      insightsSkipped++;
      continue;
    }

    // 4. Save as a synthesis memory
    const saved = await saveMemoryWithEmbedding({
      type: 'synthesis',
      content: insight,
      importance: Math.min(10, (memory.importance || 5) + 1),
      tags: ['auto-generated', 'insight', `source_${memory.type}`],
    });

    if (saved) {
      insightsCreated++;
      // 5. Alert via Discord
      await sendDiscordAlert(`💡 **Insight**\n${insight}`);
      logJson('info', {
        event: 'synthesis_created',
        memoryId: memory.id,
        insight: insight.slice(0, 100),
      });
    }
  }

  logJson('info', {
    event: 'synthesis_complete',
    created: insightsCreated,
    skipped: insightsSkipped,
    totalCandidates: newMemories.length,
  });
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  synthesizeInsights().catch(err => {
    console.error('[memory_synthesis] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { synthesizeInsights };
