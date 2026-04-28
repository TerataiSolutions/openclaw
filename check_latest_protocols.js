const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function check() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,importance,tags,created_at&type=eq.self_insight&tags=cs.\{protocol,memory,core}&order=created_at.desc&limit=5`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const memories = await response.json();
    console.log('=== PROTOCOL MEMORIES (most recent first) ===\n');
    memories.forEach((mem, idx) => {
        console.log(`${idx + 1}. ID: ${mem.id}`);
        console.log(`   Created: ${mem.created_at}`);
        console.log(`   Importance: ${mem.importance}`);
        console.log(`   Content: ${mem.content.substring(0, 180)}...`);
        console.log();
    });
}

check().catch(err => console.error(err));