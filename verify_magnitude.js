const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verify() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,embedding&limit=3`;
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
        if (typeof str === 'string') {
            let arr;
            try {
                arr = JSON.parse(str);
            } catch (e) {
                console.log(`Memory ${mem.id}: cannot parse embedding string`);
                continue;
            }
            const magnitude = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
            const sumAbs = arr.reduce((sum, v) => sum + Math.abs(v), 0);
            console.log(`Memory ${mem.id}:`);
            console.log(`  Parsed array length: ${arr.length}`);
            console.log(`  First 3 values: ${arr.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
            console.log(`  Euclidean norm: ${magnitude.toFixed(6)}`);
            console.log(`  Sum of absolute values: ${sumAbs.toFixed(6)}`);
            console.log(`  Is zero vector? ${sumAbs === 0 ? 'YES' : 'NO'}`);
        } else if (Array.isArray(str)) {
            console.log(`Memory ${mem.id}: embedding is already array (length ${str.length})`);
        } else {
            console.log(`Memory ${mem.id}: embedding type ${typeof str}`);
        }
    }
}
verify().catch(err => console.error(err));