// Deduplicated heartbeat_sent insertion block
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { generateEmbedding } = require('./lib/clients/cohere');

async function insertHeartbeatSent(content = null) {
  // Default content if none provided
  if (!content) {
    const now = new Date().toISOString();
    content = `Heartbeat check at ${now}: all systems nominal.`;
  }

  // --- DEDUP CHECK ---
  // Build 25-minute window boundary (matching poll interval)
  const since = new Date(Date.now() - 25 * 60 * 1000).toISOString();

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/memories?type=eq.heartbeat_sent&created_at=gte.${since}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!checkRes.ok) {
    console.error('[heartbeat_sent] Dedup check failed:', await checkRes.text());
    // Fail open -- skip insert rather than risk another duplicate
    return;
  }

  const existing = await checkRes.json();
  if (existing.length > 0) {
    console.log('[heartbeat_sent] Already exists within 25m -- skipping insert');
    return;
  }
  // --- END DEDUP CHECK ---

  // Generate embedding
  const embedding = await generateEmbedding(content);

  // Insert memory
  const memoryRes = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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

  if (!memoryRes.ok) {
    throw new Error(`[heartbeat_sent] Insert failed: ${await memoryRes.text()}`);
  }

  console.log('[heartbeat_sent] Saved successfully');
}

// If run directly, execute with default content
if (require.main === module) {
  insertHeartbeatSent().catch(e => console.error('[heartbeat_sent] Fatal error:', e));
}

module.exports = { insertHeartbeatSent };