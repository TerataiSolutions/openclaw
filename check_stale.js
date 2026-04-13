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

async function main() {
    const tasks = await fetchOpenTasks();
    const now = new Date();
    const stale = tasks.filter(t => {
        const created = new Date(t.created_at);
        const days = (now - created) / (1000 * 60 * 60 * 24);
        return days > 4;
    });
    console.log(`Total open tasks: ${tasks.length}`);
    console.log(`Stale (>4 days): ${stale.length}`);
    stale.forEach(t => {
        const created = new Date(t.created_at);
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        console.log(`- ${t.content.substring(0, 80)} (${days} days old)`);
    });
    process.exit(stale.length > 0 ? 1 : 0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});