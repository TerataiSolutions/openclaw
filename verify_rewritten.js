const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verify() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,type,importance,tags&order=created_at.desc&limit=15`;
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
    console.log(`Total memories in database: ${memories.length}\n`);
    
    memories.forEach((mem, idx) => {
        console.log(`${idx + 1}. ID: ${mem.id}`);
        console.log(`   Type: ${mem.type}, Importance: ${mem.importance}`);
        console.log(`   Content: ${mem.content.substring(0, 100)}...`);
        console.log(`   Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
        console.log();
    });
}

verify().catch(err => console.error(err));