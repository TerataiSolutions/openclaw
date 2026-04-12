const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function generateEmbedding(text) {
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
    return result.embeddings[0];
}

async function saveMemory() {
    const content = `I now follow an updated memory saving protocol. For simple facts, preferences, and observations, I keep content to one or two precise sentences. For complex situations, decisions, projects, strategies, or anything with multiple moving parts, I write as many sentences as necessary to capture full context without compression. For complex memories, I also save a companion summary memory with one precise sentence describing the core takeaway, tagged with the same tags as the full memory plus 'summary'. This gives semantic search two entry points: the precise summary for retrieval and the full record for context.`;
    
    console.log('Generating embedding for protocol memory...');
    const embedding = await generateEmbedding(content);
    console.log(`Embedding generated, length: ${embedding.length}`);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
            type: 'self_insight',
            content,
            embedding,
            importance: 9,
            tags: ['protocol', 'memory', 'core'],
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save memory: ${response.status} ${errorText}`);
    }
    
    console.log('Protocol memory saved successfully.');
}

saveMemory().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});