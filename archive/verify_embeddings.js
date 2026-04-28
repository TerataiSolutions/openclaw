const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verify() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding&limit=3`;
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
    console.log(`Retrieved ${memories.length} memories with embeddings.`);
    for (const mem of memories) {
        const emb = mem.embedding;
        if (!emb || !Array.isArray(emb)) {
            console.log(`Memory ${mem.id}: embedding missing or not array`);
            continue;
        }
        const sum = emb.reduce((a, b) => a + Math.abs(b), 0);
        const magnitude = Math.sqrt(emb.reduce((a, b) => a + b * b, 0));
        console.log(`Memory ${mem.id}:`);
        console.log(`  Length: ${emb.length}`);
        console.log(`  First 3: ${emb.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
        console.log(`  Sum of absolute values: ${sum.toFixed(6)}`);
        console.log(`  Euclidean norm: ${magnitude.toFixed(6)}`);
        console.log(`  Is zero vector? ${sum === 0 ? 'YES' : 'NO'}`);
    }
}
verify().catch(err => console.error(err));