#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function fetchOpenTasks() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,importance,created_at&order=importance.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
    }
    const tasks = await response.json();
    
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resResponse = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    const resolved = resResponse.ok ? await resResponse.json() : [];
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function fetchRedFlagCampaigns() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.campaign_metric&tags=cs.{red_flag}&select=content,importance,created_at&order=importance.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        console.warn('Failed to fetch red‑flag campaigns:', response.statusText);
        return [];
    }
    return await response.json();
}

async function fetchGoalOrFrustrationMemory(queryText) {
    try {
        const { stdout } = await execPromise(
            `node /data/.openclaw/workspace/semantic_search_enhanced.js "${queryText}" 3 0.25`
        );
        const results = JSON.parse(stdout);
        if (Array.isArray(results) && results.length > 0) {
            const relevant = results.find(r => 
                r.content.toLowerCase().includes('goal') ||
                r.content.toLowerCase().includes('frustrat') ||
                r.content.toLowerCase().includes('workflow') ||
                r.content.toLowerCase().includes('improve') ||
                r.content.toLowerCase().includes('professional') ||
                r.content.toLowerCase().includes('career')
            );
            return relevant ? relevant.content : results[0].content;
        }
    } catch (err) {
        console.error('Semantic search for goals/frustrations failed:', err.message);
    }
    return null;
}

async function generateDailyInsight(openTasks, redFlagCampaigns) {
    if (openTasks.length === 0 && redFlagCampaigns.length === 0) return null;
    
    const mostPressingTask = openTasks.length > 0 ? openTasks[0] : null;
    
    const components = [];
    
    if (redFlagCampaigns.length > 0) {
        const topFlag = redFlagCampaigns[0];
        components.push(`🚨 **Red‑flag campaign**: ${topFlag.content.substring(0, 100)}`);
        if (redFlagCampaigns.length > 1) {
            components.push(`(${redFlagCampaigns.length - 1} more red‑flag${redFlagCampaigns.length > 2 ? 's' : ''} outstanding)`);
        }
    }
    
    if (mostPressingTask) {
        const query = `professional goal frustration ${mostPressingTask.content.substring(0, 50)}`;
        const goalMemory = await fetchGoalOrFrustrationMemory(query);
        if (goalMemory) {
            components.push(`📌 **Task link**: "${mostPressingTask.content.substring(0, 80)}…"`);
            components.push(`   ↳ *Connected to*: ${goalMemory.substring(0, 120)}…`);
        } else {
            components.push(`📌 **Top task**: ${mostPressingTask.content.substring(0, 100)} (importance ${mostPressingTask.importance})`);
        }
    }
    
    if (components.length === 0) return null;
    return components.join('\n');
}

async function main() {
    console.log('Testing morning insight logic...');
    const openTasks = await fetchOpenTasks();
    console.log(`Open tasks: ${openTasks.length}`);
    const redFlagCampaigns = await fetchRedFlagCampaigns();
    console.log(`Red‑flag campaigns: ${redFlagCampaigns.length}`);
    const insight = await generateDailyInsight(openTasks, redFlagCampaigns);
    console.log('\n--- Generated Insight ---');
    console.log(insight || '(no insight generated)');
    console.log('--- End ---');
}

main().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});