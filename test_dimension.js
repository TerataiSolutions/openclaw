const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function testDimension(dim) {
    const dummyVector = new Array(dim).fill(0.5);
    const url = `${SUPABASE_URL}/rest/v1/memories?id=eq.a1b1f3bc-3108-49be-ac35-5f924554e793`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ embedding: dummyVector }),
    });
    console.log(`Testing dimension ${dim}: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        const text = await response.text();
        console.log(`  Error: ${text}`);
        return false;
    }
    return true;
}

async function main() {
    console.log('Testing vector dimension compatibility...');
    // first try 384 (original)
    const ok384 = await testDimension(384);
    if (!ok384) {
        console.log('  Even 384-dim vector failed, something else wrong.');
        return;
    }
    // try 1024 (Cohere embed-english-v3.0)
    const ok1024 = await testDimension(1024);
    console.log(`\nResult: Supabase column ${ok1024 ? 'accepts' : 'rejects'} 1024‑dimensional vectors.`);
}
main().catch(err => console.error(err));