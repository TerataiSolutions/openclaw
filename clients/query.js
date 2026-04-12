#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

/**
 * Generate embedding for a query using Cohere.
 */
async function generateEmbedding(text) {
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            texts: [text],
            model: 'embed-english-v3.0',
            input_type: 'search_query',
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cohere API error: ${err}`);
    }
    const data = await response.json();
    return data.embeddings[0];
}

/**
 * Perform semantic search for a client.
 * @param {string} clientId - client ID from registry
 * @param {string} query - natural language question
 * @param {number} limit - max results (default 5)
 * @returns {Array} memories sorted by similarity
 */
async function queryClient(clientId, query, limit = 5) {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Call semantic_search RPC filtered by client tag
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/semantic_search`;
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query_embedding: embedding,
            match_threshold: 0.25,
            match_count: 20, // fetch more then filter
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`RPC call failed: ${err}`);
    }
    let results = await response.json();
    
    // Filter results to only those tagged with the client ID
    results = results.filter(r => r.tags && r.tags.includes(clientId));
    
    // Limit and return
    return results.slice(0, limit);
}

/**
 * Command-line interface.
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node query.js <client-id> "<question>" [limit]');
        console.error('Example: node query.js opp "What does OPP Agency do?"');
        process.exit(1);
    }
    const clientId = args[0];
    const question = args[1];
    const limit = args[2] ? parseInt(args[2]) : 5;
    
    try {
        const results = await queryClient(clientId, question, limit);
        console.log(`Top ${results.length} memories for ${clientId}:`);
        results.forEach((r, i) => {
            console.log(`\n--- Result ${i + 1} (similarity: ${r.similarity.toFixed(3)}) ---`);
            console.log(`Type: ${r.type}, Importance: ${r.importance}`);
            console.log(`Content: ${r.content}`);
            console.log(`Tags: ${r.tags ? r.tags.join(', ') : 'none'}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { queryClient };