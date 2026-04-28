const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function fetchMemories(limit = 3) {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding&limit=${limit}`;
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

async function generateEmbedding(text, inputType) {
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'embed-english-v3.0',
            texts: [text],
            input_type: inputType,
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
    console.log('Checking embedding input types for 3 random memories...\n');
    const memories = await fetchMemories(3);
    
    for (const mem of memories) {
        console.log(`Memory ID: ${mem.id}`);
        console.log(`Content: ${mem.content.substring(0, 80)}...`);
        
        // generate new embeddings with both input types
        const embedDoc = await generateEmbedding(mem.content, 'search_document');
        const embedQuery = await generateEmbedding(mem.content, 'search_query');
        
        // compare with stored embedding
        const simDoc = cosineSimilarity(mem.embedding, embedDoc);
        const simQuery = cosineSimilarity(mem.embedding, embedQuery);
        
        console.log(`  Similarity with new search_document embedding: ${simDoc.toFixed(6)}`);
        console.log(`  Similarity with new search_query embedding:    ${simQuery.toFixed(6)}`);
        
        if (simDoc > simQuery) {
            console.log(`  ⇒ Stored embedding is closer to search_document (likely correct).`);
        } else if (simQuery > simDoc) {
            console.log(`  ⇒ Stored embedding is closer to search_query (possibly wrong).`);
        } else {
            console.log(`  ⇒ No clear difference.`);
        }
        
        // also compute similarity between the two new embeddings
        const simDocQuery = cosineSimilarity(embedDoc, embedQuery);
        console.log(`  Similarity between search_document and search_query: ${simDocQuery.toFixed(6)}`);
        console.log();
    }
}

main().catch(err => console.error(err));