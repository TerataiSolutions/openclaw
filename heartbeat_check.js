#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchOpenTasks() {
    // First get all task memories
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,importance,created_at&order=importance.desc`;
    const tasks = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    }).then(r => r.ok ? r.json() : []);
    
    // Get all memories that have a parent_id referencing a task (resolution memories)
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resolved = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    }).then(r => r.ok ? r.json() : []);
    
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    // Filter out tasks that have a resolution
    return tasks.filter(t => !resolvedIds.has(t.id));
}

async function fetchStaleTasks() {
    // Get all task memories
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.task&select=id,content,created_at`;
    const tasks = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    }).then(r => r.ok ? r.json() : []);
    
    // Get resolution memories
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resolved = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    }).then(r => r.ok ? r.json() : []);
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    // Filter unresolved tasks older than 4 days
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    return tasks.filter(t => 
        !resolvedIds.has(t.id) && new Date(t.created_at) < fourDaysAgo
    );
}

async function fetchUnresolvedFollowUps() {
    // Fetch memories with tag 'needs_follow_up'
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.\{needs_follow_up\}&select=id,content,created_at`;
    const followUps = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    }).then(r => r.ok ? r.json() : []);
    
    // Get all memories that have a parent_id (resolutions)
    const resUrl = `${SUPABASE_URL}/rest/v1/memories?parent_id=not.is.null&select=parent_id`;
    const resolved = await fetch(resUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    }).then(r => r.ok ? r.json() : []);
    const resolvedIds = new Set(resolved.map(r => r.parent_id));
    
    // Filter out those that have a resolution memory
    return followUps.filter(m => !resolvedIds.has(m.id));
}

async function main() {
    try {
        const openTasks = await fetchOpenTasks();
        const staleTasks = await fetchStaleTasks();
        const unresolvedFollowUps = await fetchUnresolvedFollowUps();
        
        console.log(JSON.stringify({
            openTasks: openTasks.length,
            staleTasks: staleTasks.length,
            unresolvedFollowUps: unresolvedFollowUps.length,
            needsAttention: openTasks.length > 0 || staleTasks.length > 0 || unresolvedFollowUps.length > 0,
            openTaskContents: openTasks.map(t => ({
                content: t.content.substring(0, 100),
                importance: t.importance,
                created: t.created_at
            })),
            staleTaskContents: staleTasks.map(t => ({
                content: t.content.substring(0, 100),
                created: t.created_at
            })),
            followUpContents: unresolvedFollowUps.map(m => ({
                content: m.content.substring(0, 100),
                created: m.created_at
            }))
        }));
    } catch (err) {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
    }
}

main();