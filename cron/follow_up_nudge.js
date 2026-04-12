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

async function fetchNeedsFollowUpMemories() {
    // Fetch memories with tag 'needs_follow_up'
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{needs_follow_up}&select=id,content,created_at`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch needs_follow_up memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

async function fetchResolvedParentIds() {
    // Get all memories that have a parent_id (resolutions)
    const url = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!response.ok) {
        // If parent_id column doesn't exist yet, return empty
        return [];
    }
    const resolved = await response.json();
    return resolved.map(r => r.parent_id);
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM Eastern). Skipping.');
        return;
    }
    
    console.log('Fetching unresolved follow‑up memories...');
    const followUps = await fetchNeedsFollowUpMemories();
    const resolvedIds = await fetchResolvedParentIds();
    
    // Filter out those that have a resolution memory
    const unresolved = followUps.filter(m => !resolvedIds.includes(m.id));
    
    if (unresolved.length === 0) {
        console.log('No unresolved follow‑up memories.');
        return;
    }
    
    const now = new Date();
    for (const mem of unresolved) {
        const created = new Date(mem.created_at);
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        
        let message = `Still open: "${mem.content.substring(0, 200)}" — logged ${days} day(s) ago. Resolved?`;
        if (days >= 3) {
            message = `This has been open for ${days} days.\n` + message;
        }
        
        console.log(`Sending nudge for memory ${mem.id} (${days} days old)...`);
        const sent = await sendDM(message);
        if (!sent) {
            console.error(`Failed to send nudge for ${mem.id}`);
        }
    }
    console.log(`Sent ${unresolved.length} follow‑up nudges.`);
}

main().catch(err => {
    console.error('Follow‑up nudge error:', err);
    process.exit(1);
});