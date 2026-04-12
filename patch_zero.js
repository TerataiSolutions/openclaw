const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function patchZeroEmbedding(id) {
    const zeroVector = new Array(384).fill(0);
    const url = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ embedding: zeroVector }),
    });
    if (!response.ok) {
        throw new Error(`Failed to update memory ${id}: ${response.status} ${response.statusText}`);
    }
    console.log(`Patched memory ${id} with zero embedding`);
}

async function main() {
    // fetch memories missing embedding
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,embedding&embedding=is.null`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const memories = await response.json();
    console.log(`Found ${memories.length} memories missing embeddings`);
    for (const mem of memories) {
        await patchZeroEmbedding(mem.id);
        // small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Done.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});