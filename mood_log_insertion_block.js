// Deduplicated mood_log insertion block
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { generateEmbedding } = require('./lib/clients/cohere');

async function insertMoodLog() {
  // --- DEDUP CHECK ---
  // Build 24-hour window boundary
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/memories?type=eq.mood_log&created_at=gte.${since}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!checkRes.ok) {
    console.error('[mood_log] Dedup check failed:', await checkRes.text());
    // Fail open -- skip insert rather than risk another duplicate
    return;
  }

  const existing = await checkRes.json();
  if (existing.length > 0) {
    console.log('[mood_log] Already exists within 24h -- skipping insert');
    return;
  }
  // --- END DEDUP CHECK ---

  const content = 'Mood check placeholder – no explicit mood logged today.';

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
      type: 'mood_log',
      content,
      embedding,
      importance: 3,
      tags: ['mood_log', 'system_health']
    })
  });

  if (!memoryRes.ok) {
    throw new Error(`[mood_log] Insert failed: ${await memoryRes.text()}`);
  }

  console.log('[mood_log] Saved successfully');
}

// If run directly, execute
if (require.main === module) {
  insertMoodLog().catch(e => console.error('[mood_log] Fatal error:', e));
}

module.exports = { insertMoodLog };