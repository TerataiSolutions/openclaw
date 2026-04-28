const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function testSave() {
    const zeroVector = new Array(384).fill(0.0);
    const body = {
        type: 'user_preference',
        content: 'Test memory',
        embedding: zeroVector,
        importance: 5,
        tags: ['test']
    };
    console.log('Body:', JSON.stringify(body).substring(0, 200));
    const response = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
    });
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text);
    if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
    }
}

testSave().catch(err => console.error(err));