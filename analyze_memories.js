const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,importance,tags&order=created_at`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const memories = await response.json();
    console.log('=== CURRENT MEMORIES ===\n');
    memories.forEach((mem, idx) => {
        console.log(`${idx + 1}. ID: ${mem.id}`);
        console.log(`   Type: ${mem.type}, Importance: ${mem.importance}`);
        console.log(`   Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
        console.log(`   Content: ${mem.content}`);
        console.log();
    });
}
main().catch(err => console.error(err));