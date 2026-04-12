#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { isActiveHours } = require('../utils.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sendDM(message) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/discord_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Bridge stderr:', stderr);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

async function fetchOpenTasks() {
    // First get all task memories
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
    
    // Get all memories that have a parent_id referencing a task (resolution memories)
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resResponse = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    const resolved = resResponse.ok ? await resResponse.json() : [];
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    // Filter out tasks that have a resolution
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function generateDailyInsight(openTasks) {
    if (openTasks.length === 0) return null;
    // Combine open task content into a query for semantic search
    const query = openTasks.map(t => t.content).join(' ').substring(0, 200);
    try {
        const { stdout } = await execPromise(
            `node /data/.openclaw/workspace/semantic_search_enhanced.js "${query}" 5 0.25`
        );
        const results = JSON.parse(stdout);
        if (Array.isArray(results) && results.length > 0) {
            // Find a result that is not one of the open tasks
            const insight = results.find(r => 
                !openTasks.some(t => t.content.includes(r.content.substring(0, 50)))
            );
            if (insight) return insight.content;
        }
    } catch (err) {
        console.error('Daily insight generation failed:', err.message);
    }
    return null;
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM UTC). Skipping.');
        return;
    }
    
    console.log('Fetching open tasks...');
    const openTasks = await fetchOpenTasks();
    
    if (openTasks.length === 0) {
        await sendDM('No open tasks. Clean slate.');
        return;
    }
    
    // Format tasks
    const taskList = openTasks.map(t => 
        `• ${t.content.substring(0, 120)} (importance: ${t.importance})`
    ).join('\n');
    
    // Generate daily insight
    const insight = await generateDailyInsight(openTasks);
    
    let message = `Good morning. Here is what is open:\n${taskList}\nWhat are we closing today?`;
    if (insight) {
        message += `\n\nSomething worth considering: ${insight}`;
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