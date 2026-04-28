#!/usr/bin/env node

// Full heartbeat poll with deduplication for both heartbeat_sent and mood_log
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { execSync } = require('child_process');
const { insertMoodLog } = require('./mood_log_insertion_block.js');
const { insertHeartbeatSent } = require('./heartbeat_sent_insertion_block.js');

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

async function checkCount(querySuffix, label) {
  const query = `${SUPABASE_URL}/rest/v1/memories?${querySuffix}&select=count`;
  const cmd = `curl -s -H 'apikey: ${SUPABASE_ANON_KEY}' -H 'Authorization: Bearer ${SUPABASE_ANON_KEY}' '${query}'`;
  try {
    const result = execSync(cmd, { encoding: 'utf8' });
    const data = JSON.parse(result);
    const count = data[0]?.count || 0;
    log(`${label}: ${count}`);
    return count;
  } catch (e) {
    log(`Error checking ${label}: ${e.message}`);
    return 0;
  }
}

async function run() {
  log('=== Heartbeat poll with dedup started ===');
  
  // Update watchdog state (last_user_ts)
  try {
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(__dirname, 'watchdog_state.json');
    let state = {};
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
    state.last_user_ts = new Date().toISOString();
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    log('Updated watchdog state (last_user_ts)');
  } catch (e) {
    log(`Failed to update watchdog state: ${e.message}`);
  }
  
  // 1. Check needs_follow_up
  const followUpCount = await checkCount('tags=cs.\\{needs_follow_up\\}', 'needs_follow_up count');
  
  // 2. Check NULL embeddings
  const nullEmbedCount = await checkCount('embedding=is.null', 'NULL embeddings');
  
  // 3. Check stale tasks (older than 4 days)
  const staleTaskCount = await checkCount('type=eq.task&created_at=lt.2026-04-15', 'Tasks older than 4 days');
  
  // 4. Check mood logs today
  const today = new Date().toISOString().split('T')[0];
  const moodLogCount = await checkCount(`type=eq.mood_log&created_at=gte.${today}`, 'Mood logs today');
  
  // 5. Insert mood_log if none today (dedup handled inside insertMoodLog)
  log('Checking/inserting mood_log...');
  try {
    await insertMoodLog();
  } catch (e) {
    log(`Mood log insertion error: ${e.message}`);
  }
  
  // 6. Insert heartbeat_sent (dedup handled inside insertHeartbeatSent)
  const content = `Heartbeat poll with dedup at ${new Date().toISOString()}: follow-ups=${followUpCount}, NULL embeds=${nullEmbedCount}, stale tasks=${staleTaskCount}, mood logs today=${moodLogCount}`;
  log('Checking/inserting heartbeat_sent...');
  try {
    await insertHeartbeatSent(content);
  } catch (e) {
    log(`Heartbeat sent insertion error: ${e.message}`);
  }
  
  // 7. Semantic search self-test (optional)
  log('Running semantic search self-test...');
  try {
    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';
    const embedRes = await fetch(COHERE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts: ['user wants assistant to be proactive'],
        model: 'embed-english-v3.0',
        input_type: 'search_query'
      })
    });
    if (!embedRes.ok) throw new Error(`Embedding failed: ${await embedRes.text()}`);
    const embedData = await embedRes.json();
    const embedding = embedData.embeddings[0];
    
    // Call semantic_search RPC (simplified)
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/semantic_search`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: 10
      })
    });
    if (!rpcRes.ok) throw new Error(`RPC failed: ${await rpcRes.text()}`);
    const results = await rpcRes.json();
    log(`Semantic search self-test returned ${results.length} results`);
  } catch (e) {
    log(`Semantic search self-test error: ${e.message}`);
  }
  
  log('=== Heartbeat poll completed ===');
}

if (require.main === module) {
  run().catch(e => {
    console.error('Fatal error in heartbeat poll:', e);
    process.exit(1);
  });
}

module.exports = { run };