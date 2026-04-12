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
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Bridge stderr:', stderr);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

async function fetchOpenTasks() {
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
    
    // Get resolution memories (parent_id not null)
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resResponse = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    const resolved = resResponse.ok ? await resResponse.json() : [];
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    // Filter out resolved tasks
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function fetchFollowUpsFlaggedToday() {
    // For now, return empty array; we can later tag memories with `flagged_today`
    return [];
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM UTC). Skipping.');
        return;
    }
    
    console.log('Fetching open items...');
    const openTasks = await fetchOpenTasks();
    const followUps = await fetchFollowUpsFlaggedToday();
    
    if (openTasks.length === 0 && followUps.length === 0) {
        await sendDM('End of day. Nothing open to wrap.');
        return;
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    // Filter tasks created today (optional, but we want "flagged during the day")
    const todayTasks = openTasks.filter(t => new Date(t.created_at) >= new Date(todayStart));
    
    const items = [];
    if (todayTasks.length > 0) {
        items.push(...todayTasks.map(t => `• ${t.content.substring(0, 100)}`));
    }
    if (followUps.length > 0) {
        items.push(...followUps.map(f => `• ${f.content.substring(0, 100)}`));
    }
    
    const message = `End of day. Let's close the loop:\n${items.join('\n')}\nWhat got done? What's carrying over?`;
    
    console.log('Sending end-of-day wrap...');
    const sent = await sendDM(message);
    if (!sent) {
        console.error('Failed to send end-of-day wrap.');
        process.exit(1);
    }
    console.log('End-of-day wrap sent.');
}

main().catch(err => {
    console.error('End-of-day wrap error:', err);
    process.exit(1);
});