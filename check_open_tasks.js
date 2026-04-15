const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchMemories(type, tags = null) {
    let url = `${SUPABASE_URL}/rest/v1/memories?type=eq.${type}&order=created_at.desc`;
    if (tags) {
        url += `&tags=cs.{${tags}}`;
    }
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

async function checkOpenTasks() {
    // Get all tasks
    const tasks = await fetchMemories('task');
    if (tasks.length === 0) {
        console.log('No tasks found');
        return [];
    }
    // Get all resolution memories (type could be 'task_resolution' or any with parent_id)
    // For simplicity, we'll assume any memory with parent_id is a resolution
    const allMemories = await fetchMemories('');
    const resolutionParentIds = new Set();
    allMemories.forEach(m => {
        if (m.parent_id) {
            resolutionParentIds.add(m.parent_id);
        }
    });
    const openTasks = tasks.filter(t => !resolutionParentIds.has(t.id));
    return openTasks;
}

async function main() {
    try {
        const openTasks = await checkOpenTasks();
        console.log(JSON.stringify(openTasks, null, 2));
        console.error(`Open tasks: ${openTasks.length}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();