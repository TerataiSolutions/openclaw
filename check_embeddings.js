const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function check() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding&limit=3`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const memories = await response.json();
    for (const mem of memories) {
        const str = mem.embedding;
        let arr;
        try {
            arr = JSON.parse(str);
        } catch (e) {
            console.log(`Memory ${mem.id}: embedding parse error`);
            continue;
        }
        const magnitude = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
        const sumAbs = arr.reduce((sum, v) => sum + Math.abs(v), 0);
        console.log(`Memory ${mem.id}:`);
        console.log(`  Content: ${mem.content.substring(0, 70)}...`);
        console.log(`  Embedding length: ${arr.length}`);
        console.log(`  First 3 values: ${arr.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
        console.log(`  Euclidean norm: ${magnitude.toFixed(6)} (expected ~1.0)`);
        console.log(`  Sum of absolute values: ${sumAbs.toFixed(6)} (non-zero)`);
        console.log();
    }
}
check().catch(err => console.error(err));