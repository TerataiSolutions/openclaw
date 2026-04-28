'use strict';

const { getSupabaseClient } = require('../lib/clients/supabase');
const { logJson } = require('../utils.js');

const supabase = getSupabaseClient();

async function runMemoryHealth() {
 const results = await Promise.allSettled([

 // Total count by type
 supabase.from('memories').select('type').then(({ data }) => {
 const counts = {};
 (data || []).forEach(m => { counts[m.type] = (counts[m.type] || 0) + 1; });
 return { label: 'counts_by_type', value: counts };
 }),

 // Added in last 7 days
 supabase.from('memories')
 .select('id', { count: 'exact', head: true })
 .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
 .then(({ count }) => ({ label: 'added_last_7_days', value: count })),

 // NULL embeddings
 supabase.from('memories')
 .select('id', { count: 'exact', head: true })
 .is('embedding', null)
 .then(({ count }) => ({ label: 'null_embeddings', value: count })),

 // Oldest unresolved task
 supabase.from('memories')
 .select('content, created_at')
 .eq('type', 'task')
 .contains('tags', ['needs_follow_up'])
 .is('parent_id', null)
 .order('created_at', { ascending: true })
 .limit(1)
 .then(({ data }) => ({
 label: 'oldest_unresolved_task',
 value: data?.[0]
 ? `"${data[0].content.slice(0, 80)}..." -- logged ${new Date(data[0].created_at).toLocaleDateString()}`
 : 'None'
 })),

 // Total memory count
 supabase.from('memories')
 .select('id', { count: 'exact', head: true })
 .then(({ count }) => ({ label: 'total_memories', value: count }))

 ]);

 const report = {};
 results.forEach(r => {
 if (r.status === 'fulfilled') report[r.value.label] = r.value.value;
 else report['error'] = r.reason?.message;
 });

 const counts = report.counts_by_type || {};
 const countLines = Object.entries(counts)
 .sort((a, b) => b[1] - a[1])
 .map(([type, n]) => ` ${type}: ${n}`)
 .join('\n');

 const message =
 `**Memory Health Report**\n` +
 `Total memories: ${report.total_memories ?? 'error'}\n` +
 `Added last 7 days: ${report.added_last_7_days ?? 'error'}\n` +
 `NULL embeddings: ${report.null_embeddings ?? 'error'}\n` +
 `Oldest unresolved task: ${report.oldest_unresolved_task ?? 'error'}\n\n` +
 `**By Type:**\n${countLines || ' No data'}`;

 logJson('info', { event: 'memory_health_report', report });
 return message;
}

module.exports = { runMemoryHealth };