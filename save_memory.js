const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function saveMemory(type, content, importance = 5, tags = []) {
    const zeroVector = new Array(384).fill(0);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
            type,
            content,
            embedding: zeroVector,
            importance,
            tags,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to save memory: ${response.status} ${response.statusText}`);
    }
    console.log(`Saved memory: ${content.substring(0, 60)}...`);
}

async function main() {
    const memories = [
        {
            type: 'user_fact',
            content: 'User Discord ID is 1122248771208757279, username teratai_solutions, display name Kanji.Yokai.',
            importance: 8,
            tags: ['discord', 'identity']
        },
        {
            type: 'user_fact',
            content: 'User is the Sales Enablement Manager and Revenue Architect at OPP Agency.',
            importance: 8,
            tags: ['job', 'role']
        },
        {
            type: 'user_preference',
            content: 'User prefers direct, substantive communication with no filler phrases.',
            importance: 7,
            tags: ['communication', 'style']
        },
        {
            type: 'user_fact',
            content: 'User is building this AI intentionally, wants it to develop a genuine personality.',
            importance: 8,
            tags: ['relationship', 'purpose']
        },
        {
            type: 'user_fact',
            content: 'User is willing to invest time in this relationship.',
            importance: 6,
            tags: ['relationship']
        },
        {
            type: 'self_insight',
            content: 'The memory system uses Supabase with embeddings, but the Hugging Face embedding endpoint is deprecated.',
            importance: 7,
            tags: ['memory', 'configuration']
        },
        {
            type: 'decision',
            content: 'Patched missing embeddings with zero vectors as placeholder because Hugging Face Inference API is deprecated.',
            importance: 6,
            tags: ['embedding', 'patch']
        },
        {
            type: 'task',
            content: 'Need to update TOOLS.md with a working embedding provider (e.g., OpenAI, Cohere, local model).',
            importance: 7,
            tags: ['todo', 'configuration']
        },
        {
            type: 'user_preference',
            content: 'User wants the memory system to work with proper embeddings for semantic search.',
            importance: 7,
            tags: ['embedding', 'requirements']
        },
    ];

    for (const mem of memories) {
        await saveMemory(mem.type, mem.content, mem.importance, mem.tags);
        // small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log('All memories saved.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});