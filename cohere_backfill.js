const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,type,importance,tags`;
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
    return await response.json();
}

async function generateCohereEmbedding(text) {
    console.log(`  Calling Cohere embed-english-v3.0...`);
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
        throw new Error(`Cohere response missing embeddings: ${JSON.stringify(result)}`);
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
    console.log('Fetching memories...');
    const memories = await fetchMemories();
    console.log(`Found ${memories.length} memories.`);
    
    let success = 0;
    let failed = 0;
    const errors = [];
    
    for (let i = 0; i < memories.length; i++) {
        const mem = memories[i];
        console.log(`\nProcessing memory ${i+1}/${memories.length}: ${mem.id}`);
        console.log(`  Content: ${mem.content.substring(0, 80)}...`);
        
        try {
            const embedding = await generateCohereEmbedding(mem.content);
            console.log(`  Embedding generated, length: ${embedding.length}`);
            console.log(`  First 3 values: ${embedding.slice(0, 3).map(v => v.toFixed(6)).join(', ')}`);
            
            await updateMemory(mem.id, embedding);
            console.log(`  Memory updated successfully.`);
            success++;
        } catch (err) {
            console.error(`  ERROR: ${err.message}`);
            errors.push({ id: mem.id, error: err.message });
            failed++;
            // If it's an auth error, stop further processing because all will fail
            if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                console.error('  Stopping due to authentication failure.');
                break;
            }
        }
        
        // Delay to avoid rate limiting (Cohere has rate limits)
        if (i < memories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total memories processed: ${memories.length}`);
    console.log(`Successfully embedded: ${success}`);
    console.log(`Failed: ${failed}`);
    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  ${e.id}: ${e.error}`));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});