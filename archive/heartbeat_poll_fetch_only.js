// Heartbeat poll using fetch only (no execSync)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function checkCount(querySuffix, label) {
  const url = `${SUPABASE_URL}/rest/v1/memories?${querySuffix}&select=count`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const count = data[0]?.count || 0;
    log(`${label}: ${count}`);
    return count;
  } catch (e) {
    log(`Error checking ${label}: ${e.message}`);
    return 0;
  }
}

async function insertMoodLog() {
  // Dedup check first
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const checkUrl = `${SUPABASE_URL}/rest/v1/memories?type=eq.mood_log&created_at=gte.${since}&select=id&limit=1`;
  try {
    const checkRes = await fetch(checkUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!checkRes.ok) {
      log('[mood_log] Dedup check failed, skipping');
      return;
    }
    const existing = await checkRes.json();
    if (existing.length > 0) {
      log('[mood_log] Already exists within 24h -- skipping insert');
      return;
    }
  } catch (e) {
    log('[mood_log] Dedup check error, skipping');
    return;
  }

  const content = 'Mood check placeholder – no explicit mood logged today.';
  const embedRes = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      texts: [content],
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    })
  });
  if (!embedRes.ok) throw new Error('Embedding failed');
  const embedData = await embedRes.json();
  const embedding = embedData.embeddings[0];

  const memoryRes = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      type: 'mood_log',
      content,
      embedding,
      importance: 3,
      tags: ['mood_log', 'system_health']
    })
  });
  if (!memoryRes.ok) throw new Error('Insert failed');
  log('[mood_log] Saved successfully');
}

async function insertHeartbeatSent(content) {
  // Dedup check: 25-minute window
  const since = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  const checkUrl = `${SUPABASE_URL}/rest/v1/memories?type=eq.heartbeat_sent&created_at=gte.${since}&select=id&limit=1`;
  try {
    const checkRes = await fetch(checkUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!checkRes.ok) {
      log('[heartbeat_sent] Dedup check failed, skipping');
      return;
    }
    const existing = await checkRes.json();
    if (existing.length > 0) {
      log('[heartbeat_sent] Already exists within 25m -- skipping insert');
      return;
    }
  } catch (e) {
    log('[heartbeat_sent] Dedup check error, skipping');
    return;
  }

  const embedRes = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      texts: [content],
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    })
  });
  if (!embedRes.ok) throw new Error('Embedding failed');
  const embedData = await embedRes.json();
  const embedding = embedData.embeddings[0];

  const memoryRes = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      type: 'heartbeat_sent',
      content,
      embedding,
      importance: 3,
      tags: ['heartbeat_sent', 'system_health']
    })
  });
  if (!memoryRes.ok) throw new Error('Insert failed');
  log('[heartbeat_sent] Saved successfully');
}

async function semanticSelfTest() {
  try {
    const embedRes = await fetch('https://api.cohere.ai/v1/embed', {
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
    if (!embedRes.ok) throw new Error('Embedding failed');
    const embedData = await embedRes.json();
    const embedding = embedData.embeddings[0];

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
    if (!rpcRes.ok) throw new Error('RPC failed');
    const results = await rpcRes.json();
    log(`Semantic search self-test returned ${results.length} results`);
  } catch (e) {
    log(`Semantic search self-test error: ${e.message}`);
  }
}

async function run() {
  log('=== Heartbeat poll with dedup (fetch-only) started ===');
  
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
  
  // Checks
  const followUpCount = await checkCount('tags=cs.\\{needs_follow_up\\}', 'needs_follow_up count');
  const nullEmbedCount = await checkCount('embedding=is.null', 'NULL embeddings');
  const staleTaskCount = await checkCount('type=eq.task&created_at=lt.2026-04-15', 'Tasks older than 4 days');
  const today = new Date().toISOString().split('T')[0];
  const moodLogCount = await checkCount(`type=eq.mood_log&created_at=gte.${today}`, 'Mood logs today');
  
  // Insert mood_log (dedup)
  log('Checking/inserting mood_log...');
  try {
    await insertMoodLog();
  } catch (e) {
    log(`Mood log insertion error: ${e.message}`);
  }
  
  // Insert heartbeat_sent (dedup)
  const content = `Heartbeat poll with dedup at ${new Date().toISOString()}: follow-ups=${followUpCount}, NULL embeds=${nullEmbedCount}, stale tasks=${staleTaskCount}, mood logs today=${moodLogCount}`;
  log('Checking/inserting heartbeat_sent...');
  try {
    await insertHeartbeatSent(content);
  } catch (e) {
    log(`Heartbeat sent insertion error: ${e.message}`);
  }
  
  // Semantic search self-test
  await semanticSelfTest();
  
  log('=== Heartbeat poll completed ===');
}

if (require.main === module) {
  run().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}