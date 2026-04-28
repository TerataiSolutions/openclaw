#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { generateEmbedding } = require('./lib/clients/cohere');

async function rpcSemanticSearch(queryEmbedding, match_threshold = 0.25, match_count = 10) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/semantic_search`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query_embedding: queryEmbedding,
            match_threshold,
            match_count,
        }),
    });
    if (response.ok) {
        return await response.json();
    }
    // If function doesn't exist (404/405), fall back to client-side
    const errorText = await response.text();
    console.error(`RPC call failed (${response.status}): ${errorText}. Falling back to client-side similarity.`);
    return null;
}

async function fetchAllMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding`;
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
    const memories = await response.json();
    // parse embedding strings into arrays, filter out nulls
    return memories
        .filter(mem => mem.embedding != null)
        .map(mem => ({
            id: mem.id,
            content: mem.content,
            embedding: typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding,
        }));
}

function cosineSimilarity(vecA, vecB) {
    // assume vectors are normalized (Cohere returns normalized vectors)
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
    }
    return dot; // because ||vecA|| = ||vecB|| = 1
}

async function clientSideSemanticSearch(queryEmbedding, limit) {
    const memories = await fetchAllMemories();
    const results = memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        similarity: cosineSimilarity(queryEmbedding, mem.embedding),
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node semantic_search_enhanced.js <query> [limit] [threshold]');
        console.error('  limit: max results (default 10)');
        console.error('  threshold: similarity threshold (default 0.25)');
        process.exit(1);
    }
    const query = args[0];
    const limit = args[1] ? parseInt(args[1], 10) : 10;
    const threshold = args[2] ? parseFloat(args[2]) : 0.25;

    console.error(`Generating embedding for query: "${query}"`);
    const queryEmbedding = await generateEmbedding(query, 'search_query');
    console.error(`Query embedding length: ${queryEmbedding.length}`);

    // Try RPC first
    console.error('Attempting server‑side semantic search via RPC...');
    let results = await rpcSemanticSearch(queryEmbedding, threshold, limit);
    if (results === null) {
        console.error('Falling back to client‑side similarity computation.');
        results = await clientSideSemanticSearch(queryEmbedding, limit);
    } else {
        console.error('Server‑side search successful.');
    }

    // Ensure client‑side threshold filtering (safety net)
    if (Array.isArray(results)) {
        results = results.filter(r => r.similarity >= threshold);
    }

    // Output as JSON
    console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});