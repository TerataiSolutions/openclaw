const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verify() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding&limit=5`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const memories = await response.json();
    console.log('Checking embeddings for 5 random split memories:\n');
    for (const mem of memories) {
        let arr;
        try {
            arr = typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding;
        } catch (e) {
            console.log(`Memory ${mem.id}: cannot parse embedding`);
            continue;
        }
        const magnitude = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
        const sumAbs = arr.reduce((sum, v) => sum + Math.abs(v), 0);
        console.log(`ID: ${mem.id}`);
        console.log(`  Content: ${mem.content.substring(0, 70)}...`);
        console.log(`  Embedding length: ${arr.length}`);
        console.log(`  Euclidean norm: ${magnitude.toFixed(6)} (expected ~1.0)`);
        console.log(`  Sum of absolute values: ${sumAbs.toFixed(6)} (non-zero)`);
        console.log();
    }
}
verify().catch(err => console.error(err));