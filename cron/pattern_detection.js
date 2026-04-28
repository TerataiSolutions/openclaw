#!/usr/bin/env node
'use strict';

/**
 * pattern_detection.js — Aether-7 Pattern Detection v2.0
 *
 * Changes from v1:
 * - Broader seed types (frustration, insight, decision, campaign_update, goal, objection)
 * - Tighter similarity threshold (0.65) for meaningful clusters
 * - Lower importance floor (5) with recency-weighted scoring
 * - Centroid-based topic label (no external LLM call required)
 * - Pattern decay: re-flags patterns older than 14 days if theme resurfaces
 * - Incremental fetch: only last 30 days as seed candidates
 * - Cluster scored by composite: weighted importance + similarity + size
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const { saveMemoryWithEmbedding, retrySupabaseCall, logJson } = require('../utils.js');
const { sendDiscordAlert } = require('../lib/clients/discord');

// --- CONFIG ---
const SIMILARITY_THRESHOLD = 0.65;
const MIN_CLUSTER_SIZE     = 2;       // 2 others + seed = 3 total minimum
const MIN_IMPORTANCE       = 5;
const RECENCY_WINDOW_DAYS  = 30;      // Only seed from memories in last 30 days
const PATTERN_DECAY_DAYS   = 14;      // Re-flag a pattern if last flag > 14 days ago
const MAX_MEMORIES_FETCHED = 500;

const ALLOWED_SEED_TYPES = new Set([
  'user_preference',
  'task',
  'client_update',
  'frustration',
  'insight',
  'decision',
  'campaign_update',
  'goal',
  'objection',
]);

// --- ALERT NEW PATTERNS ---
async function alertNewPatterns(patterns) {
  const newPatterns = patterns.filter(p => p.isNew !== false);
  for (const pattern of newPatterns) {
    await sendDiscordAlert(
      `🔍 **New Pattern Detected**\n${pattern.label}\n(${pattern.count} memories, score: ${pattern.score.toFixed(2)})`
    );
  }
}

// --- MATH ---
function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function computeCentroid(vectors) {
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += vec[i];
  }
  // Normalize
  const mag = Math.sqrt(centroid.reduce((s, v) => s + v * v, 0));
  return centroid.map(v => v / mag);
}

function recencyScore(createdAt) {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  return Math.max(0.5, 1.0 - ageDays / 60);
}

function weightedImportance(memory) {
  return memory.importance * recencyScore(memory.created_at);
}

function clusterScore(seed, cluster) {
  const all = [seed, ...cluster];
  const avgWeightedImportance =
    all.reduce((s, m) => s + weightedImportance(m), 0) / all.length;
  const avgSimilarity =
    cluster.reduce((s, m) => s + m.similarity, 0) / cluster.length;
  const sizeBonus = Math.min(cluster.length / 5, 1.0);
  return (avgWeightedImportance * 0.5) + (avgSimilarity * 10 * 0.3) + (sizeBonus * 0.2);
}

// --- TOPIC LABEL via centroid ---
// Finds the memory whose embedding is closest to the cluster centroid.
// That memory is the most representative of the shared theme.
function synthesizeTopic(seed, cluster) {
  const all = [seed, ...cluster];
  const centroid = computeCentroid(all.map(m => m.embedding));
  let best = all[0];
  let bestSim = -1;
  for (const m of all) {
    const sim = cosineSimilarity(centroid, m.embedding);
    if (sim > bestSim) { bestSim = sim; best = m; }
  }
  // Clean up: trim to 100 chars at a sentence boundary if possible
  const raw = best.content.substring(0, 200);
  const sentenceEnd = raw.search(/[.!?]/);
  return sentenceEnd > 20 ? raw.substring(0, sentenceEnd + 1) : raw.substring(0, 120).trim();
}

// --- FETCH: candidate memories (last 30 days) ---
async function fetchCandidateMemories() {
  const since = new Date(
    Date.now() - RECENCY_WINDOW_DAYS * 86400000
  ).toISOString();

  const url =
    `${SUPABASE_URL}/rest/v1/memories` +
    `?select=id,content,embedding,type,importance,created_at` +
    `&created_at=gte.${since}` +
    `&limit=${MAX_MEMORIES_FETCHED}` +
    `&order=created_at.desc`;

  const memories = await retrySupabaseCall(async () => {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  });

  if (!memories) return [];

  return memories
    .filter(m => m.embedding != null && m.importance >= MIN_IMPORTANCE)
    .map(m => ({
      ...m,
      embedding: typeof m.embedding === 'string'
        ? JSON.parse(m.embedding)
        : m.embedding,
    }));
}

// --- FETCH: recent pattern memories for decay check ---
async function fetchRecentPatternMemories() {
  const since = new Date(
    Date.now() - PATTERN_DECAY_DAYS * 86400000
  ).toISOString();

  const url =
    `${SUPABASE_URL}/rest/v1/memories` +
    `?tags=cs.%7Bpattern_detected%7D` +
    `&created_at=gte.${since}` +
    `&select=id,content,created_at`;

  const memories = await retrySupabaseCall(async () => {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Pattern fetch failed: ${res.status}`);
    return res.json();
  });

  return memories || [];
}

// --- MAIN ---
async function main() {
  logJson('info', { message: 'Pattern detection v2.0 starting' });

  const [memories, existingPatterns] = await Promise.all([
    fetchCandidateMemories(),
    fetchRecentPatternMemories(),
  ]);

  if (memories.length === 0) {
    logJson('info', { message: 'No candidate memories in window' });
    return;
  }

  logJson('info', { message: `Loaded ${memories.length} candidate memories` });

  const recentTopics = existingPatterns.map(p => p.content.toLowerCase());
  const seeds = memories.filter(m => ALLOWED_SEED_TYPES.has(m.type));
  const processed = new Set();
  const patterns = [];

  for (const seed of seeds) {
    if (processed.has(seed.id)) continue;

    const cluster = memories
      .filter(m =>
        m.id !== seed.id &&
        !processed.has(m.id) &&
        ALLOWED_SEED_TYPES.has(m.type)
      )
      .map(m => ({
        ...m,
        similarity: cosineSimilarity(seed.embedding, m.embedding),
      }))
      .filter(m => m.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    if (cluster.length < MIN_CLUSTER_SIZE) continue;

    const score = clusterScore(seed, cluster);
    const topic = synthesizeTopic(seed, cluster);
    const topicLower = topic.toLowerCase();

    const alreadyFlagged = recentTopics.some(existing =>
      existing.includes(topicLower.substring(0, 40))
    );

    if (alreadyFlagged) {
      logJson('info', { message: `Already flagged recently: ${topic}` });
      processed.add(seed.id);
      cluster.forEach(m => processed.add(m.id));
      continue;
    }

    logJson('info', {
      message: `New pattern: "${topic}"`,
      clusterSize: cluster.length + 1,
      score: score.toFixed(2),
    });

    patterns.push({ topic, score, count: cluster.length + 1 });
    processed.add(seed.id);
    cluster.forEach(m => processed.add(m.id));
  }

  if (patterns.length === 0) {
    logJson('info', { message: 'No new patterns found' });
    return;
  }

  // Surface highest signal first
  patterns.sort((a, b) => b.score - a.score);

  await alertNewPatterns(patterns);

  for (const pattern of patterns) {
    const saved = await saveMemoryWithEmbedding({
      type: 'pattern_detected',
      content: `Recurring theme: ${pattern.topic} (${pattern.count} memories, score: ${pattern.score.toFixed(2)})`,
      importance: 7,
      tags: ['pattern_detected', `score_${Math.round(pattern.score * 10)}`],
    });

    if (saved) {
      logJson('info', { message: `Pattern saved: ${pattern.topic}`, count: pattern.count, score: pattern.score.toFixed(2) });
    }
  }

  logJson('info', { message: `Pattern detection complete. ${patterns.length} new pattern(s) flagged.` });
}

main().catch(err => {
  logJson('error', { message: 'Pattern detection fatal error', error: err.message });
  process.exit(1);
});