const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verify() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,importance,tags,created_at&order=created_at.desc&limit=1`;
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
    console.log('Latest memory (should be protocol):');
    const mem = memories[0];
    console.log(`ID: ${mem.id}`);
    console.log(`Type: ${mem.type}`);
    console.log(`Importance: ${mem.importance}`);
    console.log(`Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
    console.log(`Content: ${mem.content.substring(0, 150)}...`);
}

verify().catch(err => console.error(err));