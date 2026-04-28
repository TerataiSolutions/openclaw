#!/usr/bin/env node

/**
 * deduplicate_memories.js — Merge or delete near-duplicate memories.
 *
 * Two-pass strategy:
 *   1. Exact-content dedup: same normalized content text → keep highest importance
 *   2. Semantic dedup: embeddings with cosine similarity > 0.95 → keep highest importance
 *
 * Usage:
 *   node scripts/deduplicate_memories.js            # real run
 *   node scripts/deduplicate_memories.js dry-run     # preview only
 */

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function parseEmbedding(embedding) {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === 'string') {
    try { return JSON.parse(embedding); } catch { return null; }
  }
  return null;
}

function normalizeContent(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

async function deduplicateMemories() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const isDryRun = process.argv[2] === 'dry-run';

  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  // Fetch all memories
  const { data: memories, error } = await sb
    .from('memories')
    .select('id, content, type, importance, embedding, created_at');

  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  console.log(`Loaded ${memories.length} memories.\n`);

  // --- Pass 1: Exact content dedup ---
  const contentGroups = new Map();
  for (const m of memories) {
    const key = normalizeContent(m.content);
    if (!contentGroups.has(key)) contentGroups.set(key, []);
    contentGroups.get(key).push(m);
  }

  let exactDupes = 0;
  const toDelete = new Set();

  for (const [key, group] of contentGroups) {
    if (group.length <= 1) continue;
    // Sort by importance desc, then created_at desc (keep fresher high-value)
    group.sort((a, b) => (b.importance || 0) - (a.importance || 0)
      || new Date(b.created_at) - new Date(a.created_at));
    const keep = group[0];
    for (const dup of group.slice(1)) {
      toDelete.add(dup.id);
      exactDupes++;
      console.log(`  Exact dup: [${dup.type}] imp=${dup.importance} "${(dup.content || '').slice(0, 50)}..." → keep [${keep.type}] imp=${keep.importance}`);
    }
  }

  if (exactDupes > 0) {
    console.log(`\nPass 1: ${exactDupes} exact-content duplicates found.`);
  } else {
    console.log('Pass 1: No exact-content duplicates.\n');
  }

  // --- Pass 2: Semantic dedup (only for remaining memories) ---
  const remaining = memories.filter(m => !toDelete.has(m.id));
  let semanticDupes = 0;
  const compared = new Set();

  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i];
    if (toDelete.has(a.id) || compared.has(a.id)) continue;
    const embA = parseEmbedding(a.embedding);
    if (!embA) continue;

    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j];
      if (toDelete.has(b.id) || compared.has(b.id)) continue;
      const embB = parseEmbedding(b.embedding);
      if (!embB) continue;

      const sim = cosineSimilarity(embA, embB);
      if (sim > 0.95) {
        // Keep the one with higher importance
        const [keep, dup] = (a.importance || 0) >= (b.importance || 0) ? [a, b] : [b, a];
        toDelete.add(dup.id);
        compared.add(dup.id);
        semanticDupes++;
        console.log(`  Semantic dup (${(sim * 100).toFixed(1)}%): [${dup.type}] "${(dup.content || '').slice(0, 40)}..." → keep [${keep.type}] "${(keep.content || '').slice(0, 40)}..."`);
      }
    }
    compared.add(a.id);
  }

  if (semanticDupes > 0) {
    console.log(`Pass 2: ${semanticDupes} semantic duplicates found.\n`);
  } else {
    console.log('Pass 2: No semantic duplicates.\n');
  }

  const total = exactDupes + semanticDupes;
  if (total === 0) {
    console.log('No duplicates found. DB is clean.');
    return;
  }

  if (isDryRun) {
    console.log(`\nDRY RUN: Would delete ${total} duplicate memories.`);
    return;
  }

  // Batch delete in chunks of 50 (avoid URI too long)
  const ids = [...toDelete];
  console.log(`Deleting ${ids.length} duplicates in batches...`);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { error: delErr } = await sb.from('memories').delete().in('id', batch);
    if (delErr) {
      console.error(`  Batch ${i / 50 + 1} failed:`, delErr.message);
    } else {
      deleted += batch.length;
    }
  }

  console.log(`Done. Deleted ${deleted}/${ids.length} duplicate memories.`);
}

deduplicateMemories().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
