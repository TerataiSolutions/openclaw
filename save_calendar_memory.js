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
    try {
        await saveMemory(
            'task',
            'User requested calendar block for Tuesday April 14 2026, 2-3 PM. Created event "Blocked Out" on primary calendar (ken@terataisolutions.co).',
            7,
            ['calendar', 'task', 'automation']
        );
        console.log('Memory saved.');
    } catch (err) {
        console.error('Error saving memory:', err.message);
    }
})();