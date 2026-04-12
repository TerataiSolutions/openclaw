const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

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

async function generateCohereEmbedding(text) {
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'embed-english-v3.0',
            texts: [text],
            input_type: 'search_document',
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error ${response.status}: ${errorText}`);
    }
    const result = await response.json();
    if (!result.embeddings || !Array.isArray(result.embeddings) || result.embeddings.length === 0) {
        throw new Error(`Cohere response missing embeddings`);
    }
    return result.embeddings[0];
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
    const embedding = await generateCohereEmbedding(mem.content);
    console.log(`Embedding length: ${embedding.length}`);
    console.log(`First 3 values: ${embedding.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
    
    console.log('Updating memory in Supabase...');
    await updateMemory(mem.id, embedding);
    console.log('Update successful.');
}

main().catch(err => console.error('Error:', err));