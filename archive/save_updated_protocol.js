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
    const content = `My memory saving protocol prioritizes completeness over brevity. I write as much content as necessary to fully capture the situation, never compressing, truncating, or summarizing at the expense of detail. For simple facts, three or four sentences are acceptable. For complex situations, decisions, projects, or nuanced contexts, I write the full picture without length constraints. The goal is complete fidelity to what actually happened or was discussed.`;
    
    console.log('Generating embedding for updated protocol memory...');
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
    
    console.log('Updated protocol memory saved successfully.');
}

saveMemory().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});