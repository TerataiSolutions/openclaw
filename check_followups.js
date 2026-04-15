const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchMemoriesWithTag(tag) {
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{${tag}}&order=created_at.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
    }
    return await response.json();
}

async function main() {
    const memories = await fetchMemoriesWithTag('needs_follow_up');
    console.log(`Found ${memories.length} memories with needs_follow_up tag`);
    memories.forEach(m => {
        console.log(`- ${m.type}: ${m.content.substring(0, 100)}... (${m.created_at})`);
    });
    // also check for tasks with no resolution
    const tasks = await fetchMemoriesWithTag('task');
    const openTasks = tasks.filter(t => !t.tags.includes('resolved'));
    console.log(`\nOpen tasks: ${openTasks.length}`);
    openTasks.forEach(t => {
        console.log(`- ${t.content.substring(0, 100)}... (${t.created_at})`);
    });
}

main().catch(err => console.error(err));