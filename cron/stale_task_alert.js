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

async function fetchStaleTasks() {
    // Get all task memories
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,created_at`;
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
    
    // Get resolution memories
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resResponse = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    const resolved = resResponse.ok ? await resResponse.json() : [];
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    // Filter unresolved tasks older than 4 days
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    return tasks.filter(t => 
        !resolvedIds.has(t.id) && new Date(t.created_at) < fourDaysAgo
    );
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM UTC). Skipping.');
        return;
    }
    
    console.log('Fetching stale tasks...');
    const staleTasks = await fetchStaleTasks();
    
    if (staleTasks.length === 0) {
        console.log('No stale tasks found.');
        return;
    }
    
    const messages = staleTasks.map(t => {
        const days = Math.floor((new Date() - new Date(t.created_at)) / (1000 * 60 * 60 * 24));
        return `Stale task flagged: "${t.content.substring(0, 120)}" — ${days} days old. Still relevant?`;
    });
    
    // Send each stale task as separate message (or combine)
    for (const msg of messages) {
        console.log(`Sending stale task alert: ${msg.substring(0, 80)}...`);
        const sent = await sendDM(msg);
        if (!sent) {
            console.error('Failed to send stale task alert.');
            process.exit(1);
        }
    }
    console.log('All stale task alerts sent.');
}

main().catch(err => {
    console.error('Stale task alert error:', err);
    process.exit(1);
});