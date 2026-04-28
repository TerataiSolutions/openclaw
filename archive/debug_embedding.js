const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function debug() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=embedding&id=eq.a1b1f3bc-3108-49be-ac35-5f924554e793`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Raw response:', text);
    if (response.ok) {
        const json = JSON.parse(text);
        console.log('Parsed:', JSON.stringify(json, null, 2));
        const emb = json[0]?.embedding;
        console.log('Type of embedding:', typeof emb);
        if (Array.isArray(emb)) {
            console.log('Array length:', emb.length);
            console.log('First few:', emb.slice(0, 5));
        }
    }
}
debug().catch(err => console.error(err));