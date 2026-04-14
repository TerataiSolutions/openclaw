#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { isActiveHours, retrySupabaseCall } = require('../utils.js');
const { sendMessage } = require('./message_bridge.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sendDM(message) {
    try {
        await sendMessage(message);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

async function fetchOpenTasks() {
    // First get all task memories
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,importance,created_at&order=importance.desc`;
    const tasks = await retrySupabaseCall(async () => {
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
        return await response.json();
    });
    if (!tasks) {
        console.error('Failed to fetch tasks after retry');
        return [];
    }
    
    // Get all memories that have a parent_id referencing a task (resolution memories)
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resolved = await retrySupabaseCall(async () => {
        const response = await fetch(resUrl, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (!response.ok) {
            // If this fails, treat as empty resolved list
            throw new Error(`Failed to fetch resolved tasks: ${response.statusText}`);
        }
        return await response.json();
    }) || [];
    
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    // Filter out tasks that have a resolution
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function fetchRedFlagCampaigns() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.campaign_metric&tags=cs.{red_flag}&select=content,importance,created_at&order=importance.desc`;
    const campaigns = await retrySupabaseCall(async () => {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch red‑flag campaigns: ${response.statusText}`);
        }
        return await response.json();
    });
    if (!campaigns) {
        console.warn('Failed to fetch red‑flag campaigns after retry');
        return [];
    }
    return campaigns;
}

async function fetchGoalOrFrustrationMemory(queryText) {
    // Use semantic search to find a relevant memory about professional goals or frustrations
    try {
        const { stdout } = await execPromise(
            `node /data/.openclaw/workspace/semantic_search_enhanced.js "${queryText}" 3 0.25`
        );
        const results = JSON.parse(stdout);
        if (Array.isArray(results) && results.length > 0) {
            // Filter for memories that mention goal/frustration/work/improve
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
    
    // Determine most pressing task
    const mostPressingTask = openTasks.length > 0 ? openTasks[0] : null;
    
    // Build insight components
    const components = [];
    
    // Red‑flag summary
    if (redFlagCampaigns.length > 0) {
        const topFlag = redFlagCampaigns[0];
        components.push(`🚨 **Red‑flag campaign**: ${topFlag.content.substring(0, 100)}`);
        if (redFlagCampaigns.length > 1) {
            components.push(`(${redFlagCampaigns.length - 1} more red‑flag${redFlagCampaigns.length > 2 ? 's' : ''} outstanding)`);
        }
    }
    
    // Task connection
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
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM UTC). Skipping.');
        return;
    }
    
    console.log('Fetching open tasks...');
    const openTasks = await fetchOpenTasks();
    console.log('Open tasks count:', openTasks.length);
    
    if (openTasks.length === 0) {
        await sendDM('No open tasks. Clean slate.');
        return;
    }
    
    console.log('Fetching red‑flag campaigns...');
    const redFlagCampaigns = await fetchRedFlagCampaigns();
    
    // Format tasks
    const taskList = openTasks.map(t => 
        `• ${t.content.substring(0, 120)} (importance: ${t.importance})`
    ).join('\n');
    
    // Generate daily insight
    const insight = await generateDailyInsight(openTasks, redFlagCampaigns);
    
    let message = `Good morning. Here is what is open:\n${taskList}\nWhat are we closing today?`;
    if (insight) {
        message += `\n\n🔍 **Today’s focus**\n${insight}`;
    }
    
    console.log('Sending morning briefing...');
    const sent = await sendDM(message);
    if (!sent) {
        console.error('Failed to send morning briefing.');
        process.exit(1);
    }
    console.log('Morning briefing sent.');
}

main().catch(err => {
    console.error('Morning briefing error:', err);
    process.exit(1);
});