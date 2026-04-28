const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const memories = await response.json();
    return memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        embedding: typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding,
    }));
}

async function embedQuery(text) {
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'embed-english-v3.0',
            texts: [text],
            input_type: 'search_query',
        }),
    });
    const result = await response.json();
    return result.embeddings[0];
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i];
    return dot;
}

async function main() {
    const memories = await fetchMemories();
    const query = 'communication preferences and how to respond to me';
    const queryEmbedding = await embedQuery(query);
    const results = memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        similarity: cosineSimilarity(queryEmbedding, mem.embedding),
    })).sort((a, b) => b.similarity - a.similarity);
    
    console.log('Top 3 matches for query: "' + query + '"');
    results.slice(0, 3).forEach((r, idx) => {
        console.log(`\n${idx + 1}. Similarity: ${r.similarity.toFixed(6)}`);
        console.log(`   ID: ${r.id}`);
        console.log(`   Content: ${r.content.substring(0, 100)}...`);
    });
}
main().catch(err => console.error(err));