/**
 * cleanup_low_importance.js — Purge stale, low-value memories.
 *
 * Deletes memories with importance <= 3 that are older than 30 days.
 * These are operational noise (heartbeats, mood logs, low-grade conversation summaries)
 * that consume ~40% of storage but provide negligible retrieval value.
 *
 * Designed to run weekly via cron or on-demand.
 *
 * Usage: node scripts/cleanup_low_importance.js [dry-run]
 *   dry-run: print what would be deleted without actually removing
 */

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function cleanupLowValue() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const isDryRun = process.argv[2] === 'dry-run';

  // First, count what we're about to remove
  const { count, error: countError } = await supabase
    .from('memories')
    .select('*', { count: 'exact', head: true })
    .lt('importance', 4)
    .lt('created_at', cutoff);

  if (countError) {
    console.error('Count failed:', countError.message);
    process.exit(1);
  }

  if (count === 0) {
    console.log('No low-importance memories older than 30 days to clean up.');
    return;
  }

  if (isDryRun) {
    const { data: samples } = await supabase
      .from('memories')
      .select('type, importance, created_at, content')
      .lt('importance', 4)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`Dry-run: would delete ${count} memories.`);
    console.log('Sample entries:');
    for (const s of samples || []) {
      console.log(`  [${s.created_at.slice(0, 10)}] imp=${s.importance} type=${s.type} — ${(s.content || '').slice(0, 80)}`);
    }
    console.log(`\nTo execute: node ${process.argv[1]}`);
    return;
  }

  // Hard delete low-value memories
  const { data, error } = await supabase
    .from('memories')
    .delete()
    .lt('importance', 4)
    .lt('created_at', cutoff);

  if (error) {
    console.error('Deletion failed:', error.message);
    process.exit(1);
  }

  console.log(`Deleted ${count} low-importance memories (importance ≤ 3, created before ${cutoff.slice(0, 10)}).`);
}

cleanupLowValue().catch(e => {
  console.error('Unexpected error:', e.message);
  process.exit(1);
});
