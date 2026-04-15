const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding,importance`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
    }
    return await response.json();
}

async function main() {
    const memories = await fetchMemories();
    const nullEmbeddings = memories.filter(m => m.embedding === null || m.embedding === undefined);
    const zeroVectors = memories.filter(m => Array.isArray(m.embedding) && m.embedding.slice(0,10).every(v => v === 0));
    console.log(`Total memories: ${memories.length}`);
    console.log(`NULL embeddings: ${nullEmbeddings.length}`);
    console.log(`Zero vectors (first 10 values zero): ${zeroVectors.length}`);
    // show some examples
    if (nullEmbeddings.length > 0) {
        console.log('\nExample NULL embedding entries:');
        nullEmbeddings.slice(0,3).forEach(m => {
            console.log(`- ${m.id}: ${m.content.substring(0,80)}... (importance ${m.importance})`);
        });
    }
}

main().catch(err => console.error(err));