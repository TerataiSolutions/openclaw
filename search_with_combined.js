const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { generateEmbedding } = require('./lib/clients/cohere');

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding,importance`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error(`Failed to fetch memories: ${response.status}`);
    const memories = await response.json();
    return memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        importance: mem.importance,
        embedding: typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding,
    }));
}

async function generateQueryEmbedding(text) {
    return generateEmbedding(text, 'search_query');
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i];
    return dot;
}

function combinedScore(similarity, importance, weightSimilarity = 0.7, weightImportance = 0.3) {
    // Normalize importance from 1-10 to 0-1
    const normImportance = (importance - 1) / 9; // min=1, max=10
    // Combine weighted scores
    return (weightSimilarity * similarity) + (weightImportance * normImportance);
}

async function main() {
    console.log('Fetching memories...');
    const memories = await fetchMemories();
    console.log(`Loaded ${memories.length} memories.\n`);

    const query = 'communication preferences and how to respond to me';
    console.log(`Generating embedding for query: "${query}"`);
    const queryEmbedding = await generateQueryEmbedding(query);
    console.log(`Query embedding length: ${queryEmbedding.length}\n`);

    console.log('Computing scores...');
    const results = memories.map(mem => {
        const similarity = cosineSimilarity(queryEmbedding, mem.embedding);
        const combined = combinedScore(similarity, mem.importance);
        return {
            id: mem.id,
            content: mem.content,
            similarity,
            importance: mem.importance,
            combined,
        };
    });

    results.sort((a, b) => b.similarity - a.similarity);
    const topBySimilarity = results[0];

    results.sort((a, b) => b.combined - a.combined);
    const topByCombined = results[0];

    console.log('=== TOP RESULT BY SIMILARITY ===');
    console.log(`Similarity score: ${topBySimilarity.similarity.toFixed(6)}`);
    console.log(`Importance: ${topBySimilarity.importance}`);
    console.log(`Combined score (70% similarity, 30% importance): ${topBySimilarity.combined.toFixed(6)}`);
    console.log(`Memory ID: ${topBySimilarity.id}`);
    console.log(`Content: ${topBySimilarity.content.substring(0, 120)}...\n`);

    console.log('=== TOP RESULT BY COMBINED SCORE ===');
    console.log(`Similarity score: ${topByCombined.similarity.toFixed(6)}`);
    console.log(`Importance: ${topByCombined.importance}`);
    console.log(`Combined score (70% similarity, 30% importance): ${topByCombined.combined.toFixed(6)}`);
    console.log(`Memory ID: ${topByCombined.id}`);
    console.log(`Content: ${topByCombined.content.substring(0, 120)}...`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});