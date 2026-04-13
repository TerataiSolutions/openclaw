#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchOpenTasks() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,importance,created_at&order=importance.desc`;
    const tasks = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    }).then(r => r.ok ? r.json() : []);
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resolved = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    }).then(r => r.ok ? r.json() : []);
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function fetchMemoriesWithTag(tag) {
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{${tag}}&select=id,content,created_at`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    return res.ok ? await res.json() : [];
}

async function main() {
    console.log('Checking heartbeat triggers...');
    const openTasks = await fetchOpenTasks();
    console.log(`Open tasks: ${openTasks.length}`);
    if (openTasks.length > 0) {
        // Check for stale tasks (>4 days)
        const now = new Date();
        const stale = openTasks.filter(t => {
            const created = new Date(t.created_at);
            const days = (now - created) / (1000 * 60 * 60 * 24);
            return days > 4;
        });
        if (stale.length > 0) {
            console.log(`Stale tasks (>4 days): ${stale.length}`);
            stale.forEach(t => {
                const days = Math.floor((now - new Date(t.created_at)) / (1000 * 60 * 60 * 24));
                console.log(`  - ${t.content.substring(0, 80)} (${days} days old)`);
            });
        }
    }
    // Check for memories with needs_follow_up tag
    const followUps = await fetchMemoriesWithTag('needs_follow_up');
    console.log(`Memories tagged needs_follow_up: ${followUps.length}`);
    if (followUps.length > 0) {
        followUps.forEach(m => {
            const days = Math.floor((new Date() - new Date(m.created_at)) / (1000 * 60 * 60 * 24));
            console.log(`  - ${m.content.substring(0, 80)} (${days} days ago)`);
        });
    }
    // Check for red-flag campaigns
    const redFlagUrl = `${SUPABASE_URL}/rest/v1/memories?type=eq.campaign_metric&tags=cs.{red_flag}&select=content`;
    const redFlags = await fetch(redFlagUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    }).then(r => r.ok ? r.json() : []);
    console.log(`Red-flag campaigns: ${redFlags.length}`);
    // Check for pattern_detected
    const patterns = await fetchMemoriesWithTag('pattern_detected');
    console.log(`Pattern detected memories: ${patterns.length}`);
    // Check for recurring_frustration
    const frustrations = await fetchMemoriesWithTag('recurring_frustration');
    console.log(`Recurring frustration memories: ${frustrations.length}`);
    // Determine if any action needed
    const totalActions = openTasks.length + followUps.length + redFlags.length + patterns.length + frustrations.length;
    if (totalActions === 0) {
        console.log('No pending heartbeat actions.');
        process.exit(0); // HEARTBEAT_OK
    } else {
        console.log(`Pending actions: ${totalActions}`);
        process.exit(1); // Not OK, need to alert
    }
}

main().catch(err => {
    console.error('Error checking heartbeat:', err);
    process.exit(1);
});