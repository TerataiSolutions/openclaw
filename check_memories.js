const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchMemories() {
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
    return await response.json();
}

async function main() {
    console.log('Fetching memories...');
    const memories = await fetchMemories();
    console.log(`Total memories: ${memories.length}`);
    let withEmbedding = 0;
    let withoutEmbedding = 0;
    memories.forEach(mem => {
        if (mem.embedding && mem.embedding.length > 0) {
            withEmbedding++;
        } else {
            withoutEmbedding++;
        }
    });
    console.log(`With embedding: ${withEmbedding}`);
    console.log(`Without embedding: ${withoutEmbedding}`);
    if (withoutEmbedding > 0) {
        console.log('Missing embedding memories:');
        memories.filter(m => !m.embedding || m.embedding.length === 0).slice(0, 5).forEach(m => {
            console.log(`  ${m.id}: ${m.content.substring(0, 60)}...`);
        });
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});