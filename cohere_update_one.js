const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { generateEmbedding } = require('./lib/clients/cohere');

async function fetchFirstMemory() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content&limit=1`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data[0];
}

async function updateMemory(id, embedding) {
    const url = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ embedding }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase update failed ${response.status}: ${errorText}`);
    }
}

async function main() {
    console.log('Fetching first memory...');
    const mem = await fetchFirstMemory();
    console.log(`Memory ID: ${mem.id}`);
    console.log(`Content: ${mem.content.substring(0, 80)}...`);
    
    console.log('Generating Cohere embedding...');
    const embedding = await generateEmbedding(mem.content);
    console.log(`Embedding length: ${embedding.length}`);
    console.log(`First 3 values: ${embedding.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
    
    console.log('Updating memory in Supabase...');
    await updateMemory(mem.id, embedding);
    console.log('Update successful.');
}

main().catch(err => console.error('Error:', err));