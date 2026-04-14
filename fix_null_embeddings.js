const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

async function fetchNullEmbeddingMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?embedding=is.null&select=id,content,importance`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch NULL embedding memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

async function generateEmbedding(text) {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            texts: [text],
            model: 'embed-english-v3.0',
            input_type: 'search_document',
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cohere API error: ${err}`);
    }
    const data = await response.json();
    return data.embeddings[0];
}

async function updateMemoryEmbedding(id, embedding) {
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
        const err = await response.text();
        throw new Error(`Supabase update error: ${err}`);
    }
}

async function main() {
    console.log('Fetching NULL embedding memories...');
    const memories = await fetchNullEmbeddingMemories();
    console.log(`Found ${memories.length} NULL embedding memories`);
    
    let skipped = 0;
    let processed = 0;
    for (const mem of memories) {
        if (mem.importance === null || mem.importance < 7) {
            console.log(`Skipping low-importance memory ${mem.id} (importance ${mem.importance})`);
            skipped++;
            continue;
        }
        console.log(`Processing: ${mem.id}`);
        try {
            const embedding = await generateEmbedding(mem.content);
            await updateMemoryEmbedding(mem.id, embedding);
            console.log(`Fixed: ${mem.id}`);
            processed++;
        } catch (err) {
            console.error(`Error processing ${mem.id}:`, err.message);
        }
    }
    console.log(`All NULL embeddings processed. Processed ${processed}, skipped ${skipped} low-importance memories.`);
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});