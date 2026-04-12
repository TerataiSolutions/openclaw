const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Language patterns that trigger follow-up nudges
const NUDGE_PATTERNS = [
    'will do',
    'need to',
    'planning to',
    'going to',
    "i'll",
    'follow up',
    'get back to',
    'remind me'
];

function containsNudgePattern(content) {
    const lower = content.toLowerCase();
    return NUDGE_PATTERNS.some(pattern => lower.includes(pattern));
}

async function sendNudge(content, memoryId) {
    // Use message_bridge.js to send a DM (Discord with Telegram fallback)
    const message = `Follow‑up flagged: "${content.substring(0, 200)}"`;
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Discord bridge stderr:', stderr);
        console.log('Nudge sent for memory', memoryId);
        return true;
    } catch (err) {
        console.error('Failed to send nudge:', err.message);
        return false;
    }
}

async function tagMemoryNeedsFollowUp(memoryId) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Missing Supabase credentials');
        return false;
    }
    // Fetch current tags
    const getUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${memoryId}&select=tags`;
    const getRes = await fetch(getUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!getRes.ok) {
        console.error('Failed to fetch memory tags');
        return false;
    }
    const [memory] = await getRes.json();
    const tags = memory.tags || [];
    if (tags.includes('needs_follow_up')) {
        return true; // already tagged
    }
    tags.push('needs_follow_up');
    // Update memory with new tags
    const updateUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${memoryId}`;
    const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ tags }),
    });
    if (!updateRes.ok) {
        console.error('Failed to update memory tags');
        return false;
    }
    console.log('Memory tagged with needs_follow_up:', memoryId);
    return true;
}

function validateWebhookSecret(req) {
    if (!WEBHOOK_SECRET) return true; // no secret configured, allow
    const provided = req.headers['x-webhook-secret'];
    return provided === WEBHOOK_SECRET;
}

module.exports = async function handleMemoryInsert(req, res) {
    // Validate secret
    if (!validateWebhookSecret(req)) {
        console.warn('Invalid webhook secret');
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    
    const payload = req.body;
    if (!payload || !payload.record) {
        res.status(400).json({ error: 'Missing record' });
        return;
    }
    
    const record = payload.record;
    const { id, content, type } = record;
    
    if (!content) {
        res.status(400).json({ error: 'No content in memory' });
        return;
    }
    
    if (containsNudgePattern(content)) {
        console.log(`Memory ${id} contains nudge pattern, triggering follow‑up.`);
        // Send immediate nudge
        await sendNudge(content, id);
        // Tag memory
        await tagMemoryNeedsFollowUp(id);
    }
    
    res.status(200).json({ processed: true, memoryId: id });
};