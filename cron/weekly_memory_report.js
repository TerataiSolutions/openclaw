#!/usr/bin/env node

const { getSupabaseClient } = require('../lib/clients/supabase');
const { logJson } = require('../utils.js');

const supabase = getSupabaseClient();

async function sendDM(message) {
    try {
        const { sendDiscordAlert } = require('../lib/clients/discord');
        return await sendDiscordAlert(message);
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

function isZeroVector(arr) {
    return Array.isArray(arr) && arr.slice(0, 10).every(v => Math.abs(v) < 1e-9);
}

async function fetchZeroVectorCount() {
    const pageSize = 500;
    let zeroCount = 0;
    let page = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('memories')
            .select('embedding')
            .not('embedding', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
            logJson('error', { event: 'zero_vector_fetch_error', error: error.message });
            break;
        }
        
        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }
        
        data.forEach(row => {
            if (row.embedding && isZeroVector(row.embedding)) {
                zeroCount++;
            }
        });
        
        if (data.length < pageSize) {
            hasMore = false;
        } else {
            page++;
        }
    }
    
    return zeroCount;
}

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
        
        // Oldest unresolved task (with needs_follow_up tag)
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

async function main() {
    const healthMessage = await runMemoryHealth();
    const zeroVectors = await fetchZeroVectorCount();
    
    const fullReport = `${healthMessage}\nZero‑vector embeddings: ${zeroVectors}`;
    
    logJson('info', { event: 'weekly_memory_report', zeroVectors });
    
    const sent = await sendDM(fullReport);
    if (!sent) {
        console.error('Failed to send Discord message');
        process.exit(1);
    }
    console.log('Weekly memory report sent.');
    process.exit(0);
}

main().catch(err => {
    logJson('error', { event: 'weekly_memory_report_failed', error: err.message });
    console.error('Error generating weekly memory report:', err);
    process.exit(1);
});