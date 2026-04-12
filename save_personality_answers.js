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

(async () => {
    const memories = [
        {
            type: 'user_preference',
            content: 'User finds generic, robotic, or boring AI responses most annoying.',
            importance: 8,
            tags: ['ai', 'annoyance', 'communication']
        },
        {
            type: 'user_preference',
            content: 'User is a research freak who wants precise, elaborate information; wants to be the most educated in the room.',
            importance: 9,
            tags: ['personality', 'research', 'precision']
        },
        {
            type: 'user_preference',
            content: 'User\'s biggest frustration with current AI tools is the complexity of integrating them together.',
            importance: 7,
            tags: ['ai', 'frustration', 'integration']
        },
        {
            type: 'user_preference',
            content: 'Professionally, user wants to make workflows more efficient to complete more work. Personally, wants to be better at taking care of self, working out more, and being a better dad.',
            importance: 8,
            tags: ['goals', 'professional', 'personal', 'self-improvement']
        },
    ];

    for (const mem of memories) {
        await saveMemory(mem.type, mem.content, mem.importance, mem.tags);
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log('All personality answers saved.');
})();