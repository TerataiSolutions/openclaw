const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,type,importance,tags&order=id`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

async function main() {
    const memories = await fetchMemories();
    console.log(`Total memories: ${memories.length}\n`);
    memories.forEach((mem, idx) => {
        console.log(`${idx + 1}. ID: ${mem.id}`);
        console.log(`   Type: ${mem.type}, Importance: ${mem.importance}`);
        console.log(`   Content: ${mem.content}`);
        console.log(`   Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
        console.log();
    });
}

main().catch(err => console.error(err));