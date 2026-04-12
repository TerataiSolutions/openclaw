const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const HUGGINGFACE_ENDPOINT = process.env.HUGGINGFACE_ENDPOINT;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL;

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

async function generateEmbedding(text) {
    // Try deprecated inference endpoint first
    console.log(`  Trying endpoint: ${HUGGINGFACE_ENDPOINT}`);
    let response = await fetch(HUGGINGFACE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
    });
    if (response.ok) {
        const result = await response.json();
        // Expect array of arrays: [[...]]
        if (Array.isArray(result) && Array.isArray(result[0])) {
            return result[0];
        } else if (Array.isArray(result) && typeof result[0] === 'number') {
            return result;
        } else if (result.error) {
            throw new Error(`API error: ${result.error}`);
        } else {
            throw new Error(`Unexpected response format: ${JSON.stringify(result).substring(0, 100)}`);
        }
    } else if (response.status === 410 || response.status === 404) {
        console.log(`  Endpoint deprecated, trying router...`);
        // Try router's OpenAI-compatible embeddings endpoint
        const routerUrl = 'https://router.huggingface.co/v1/embeddings';
        response = await fetch(routerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: HUGGINGFACE_MODEL,
                input: text,
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.data && Array.isArray(result.data[0].embedding)) {
                return result.data[0].embedding;
            } else {
                throw new Error(`Router embeddings unexpected format`);
            }
        } else {
            const errorText = await response.text();
            throw new Error(`Router embeddings failed: ${response.status} ${errorText}`);
        }
    } else {
        const errorText = await response.text();
        throw new Error(`Inference API failed: ${response.status} ${errorText}`);
    }
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
        throw new Error(`Update failed: ${response.status} ${response.statusText}`);
    }
}

async function main() {
    console.log('Fetching memories...');
    const memories = await fetchMemories();
    console.log(`Found ${memories.length} memories.`);
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < memories.length; i++) {
        const mem = memories[i];
        console.log(`Processing memory ${i+1}/${memories.length}: ${mem.id}`);
        console.log(`  Content: ${mem.content.substring(0, 80)}...`);
        
        try {
            const embedding = await generateEmbedding(mem.content);
            console.log(`  Embedding generated, length: ${embedding.length}`);
            console.log(`  First 3 values: ${embedding.slice(0, 3).map(v => v.toFixed(6)).join(', ')}`);
            
            await updateMemory(mem.id, embedding);
            console.log(`  Memory updated successfully.`);
            success++;
        } catch (err) {
            console.error(`  ERROR: ${err.message}`);
            failed++;
        }
        
        // Delay to avoid rate limiting
        if (i < memories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('---');
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total memories processed: ${memories.length}`);
    console.log(`Successfully embedded: ${success}`);
    console.log(`Failed: ${failed}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});