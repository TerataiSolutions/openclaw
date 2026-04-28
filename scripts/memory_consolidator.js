'use strict';

const fs = require('fs');
const path = require('path');
const { saveMemoryWithEmbedding, retrySupabaseCall, logJson } = require('../utils.js');
const { execSync } = require('child_process');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SIMILARITY_THRESHOLD = 0.75;
const CLUSTER_MIN_SIZE = 5;
const DAYS_OLD = 14;
const CHECKPOINT_FILE = path.join(__dirname, '..', '.consolidator_checkpoint.json');

function saveCheckpoint(lastProcessedId, status, detail = '') {
  const data = { lastProcessedId, status, timestamp: new Date().toISOString(), detail };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf8');
  logJson('info', { event: 'consolidator_checkpoint', ...data });
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      logJson('info', { event: 'consolidator_resume', from: data.lastProcessedId, status: data.status });
      return data;
    }
  } catch (e) {
    logJson('error', { event: 'consolidator_checkpoint_load_failed', error: e.message });
  }
  return { lastProcessedId: null, status: 'ready' };
}

async function fetchOldMemories(lastProcessedId = null) {
  const cutoff = new Date(Date.now() - DAYS_OLD * 24 * 60 * 60 * 1000).toISOString();
  let url = `${SUPABASE_URL}/rest/v1/memories?created_at=lt.${cutoff}&tags=not.cs.{consolidated}&select=id,type,content,embedding,importance,tags,created_at,client_id&order=id.asc`;
  if (lastProcessedId) {
    url += `&id=gt.${lastProcessedId}`;
  }
  return retrySupabaseCall(async () => {
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`);
    return res.json();
  });
}

async function tagAsConsolidated(ids) {
  for (const id of ids) {
    await retrySupabaseCall(async () => {
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/memories?id=eq.${id}&select=tags`, { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
      const rows = await getRes.json();
      const currentTags = rows[0]?.tags || [];
      if (currentTags.includes('consolidated')) return;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`, { method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: [...currentTags, 'consolidated'] }) });
      if (!patchRes.ok) throw new Error(`Tag update failed: ${await patchRes.text()}`);
    });
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function clusterMemories(memories) {
  const clusters = [];
  const assigned = new Set();
  for (let i = 0; i < memories.length; i++) {
    if (assigned.has(i) || !memories[i].embedding) continue;
    const cluster = [i];
    for (let j = i + 1; j < memories.length; j++) {
      if (!assigned.has(j) && memories[j].embedding && cosineSimilarity(memories[i].embedding, memories[j].embedding) >= SIMILARITY_THRESHOLD) cluster.push(j);
    }
    if (cluster.length >= CLUSTER_MIN_SIZE) { cluster.forEach(idx => assigned.add(idx)); clusters.push(cluster.map(idx => memories[idx])); }
  }
  return clusters;
}

function summarizeCluster(cluster) {
  const types = [...new Set(cluster.map(m => m.type))].join(', ');
  const oldest = cluster.reduce((a, b) => a.created_at < b.created_at ? a : b).created_at.slice(0, 10);
  const newest = cluster.reduce((a, b) => a.created_at > b.created_at ? a : b).created_at.slice(0, 10);
  const keyPoints = [...cluster].sort((a, b) => b.importance - a.importance).slice(0, 3).map(m => m.content.slice(0, 200)).join(' | ');
  return `Consolidated memory from ${cluster.length} related entries (types: ${types}, spanning ${oldest} to ${newest}). Key recurring themes: ${keyPoints}`;
}

async function sendDiscordDM(message) {
  try { execSync(`node /data/.openclaw/workspace/cron/message_bridge.js ${JSON.stringify(message)}`, { stdio: 'inherit' }); }
  catch (err) { logJson('error', { event: 'discord_send_failed', error: err.message }); }
}

async function main() {
  logJson('info', { event: 'memory_consolidator_start' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

  // Resume from checkpoint if exists
  const checkpoint = loadCheckpoint();
  if (checkpoint.status === 'processing') {
    logJson('info', { event: 'consolidator_resuming', lastId: checkpoint.lastProcessedId });
  }

  const memories = await fetchOldMemories(checkpoint.lastProcessedId);
  if (!memories || memories.length === 0) {
    // Nothing old enough, or all caught up from checkpoint
    if (checkpoint.lastProcessedId) {
      // Finished previously interrupted batch — clean up checkpoint
      try { fs.unlinkSync(CHECKPOINT_FILE); } catch (_) {}
    }
    await sendDiscordDM('Memory consolidation ran — nothing old enough to cluster yet.');
    return;
  }

  const clusters = clusterMemories(memories);
  if (clusters.length === 0) {
    // Clean up checkpoint if we got here from a resume
    try { fs.unlinkSync(CHECKPOINT_FILE); } catch (_) {}
    await sendDiscordDM(`Memory consolidation complete. ${memories.length} old memories scanned, no clusters of ${CLUSTER_MIN_SIZE}+ above ${SIMILARITY_THRESHOLD} similarity.`);
    return;
  }

  let consolidatedCount = 0;
  for (const cluster of clusters) {
    const lastId = cluster[cluster.length - 1].id;
    saveCheckpoint(lastId, 'processing', `Cluster ${consolidatedCount + 1}/${clusters.length}`);

    const clientIds = [...new Set(cluster.map(m => m.client_id).filter(Boolean))];
    await saveMemoryWithEmbedding({
      type: 'memory_summary',
      content: summarizeCluster(cluster),
      importance: 8,
      tags: ['memory_summary', 'consolidated'],
      ...(clientIds.length === 1 ? { client_id: clientIds[0] } : {})
    });
    await tagAsConsolidated(cluster.map(m => m.id));
    consolidatedCount++;
  }

  // Clear checkpoint on full success
  try { fs.unlinkSync(CHECKPOINT_FILE); } catch (_) {}

  await sendDiscordDM(`Memory consolidation complete. ${memories.length} memories scanned, ${clusters.length} cluster(s) found, ${consolidatedCount} cluster summaries created.`);
  logJson('info', { event: 'memory_consolidator_complete', clusters_consolidated: consolidatedCount });
}

main().catch(err => {
  logJson('error', { event: 'memory_consolidator_fatal', error: err.message });
  process.exit(1);
});