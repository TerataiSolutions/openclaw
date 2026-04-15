const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { sanitizeMemoryContent } = require('../security/input_sanitizer.js');
const fs = require('fs');
const path = require('path');

// Rate limiting
const requestCounts = new Map(); // key: minute timestamp, value: count
const memoryInsertCounts = new Map();

function checkRateLimit(ip, type = 'request') {
    const minute = Math.floor(Date.now() / 60000);
    const map = type === 'memory_insert' ? memoryInsertCounts : requestCounts;
    
    if (!map.has(minute)) {
        map.set(minute, new Map());
    }
    const minuteMap = map.get(minute);
    const count = (minuteMap.get(ip) || 0) + 1;
    minuteMap.set(ip, count);
    
    // Clean up old entries (older than 2 minutes)
    const oldMinute = minute - 2;
    if (map.has(oldMinute)) {
        map.delete(oldMinute);
    }
    
    const limit = type === 'memory_insert' ? 10 : 60;
    return count <= limit;
}

function logSecurityEvent(source, result, details = {}) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    const securityLog = path.join(logsDir, 'security.log');
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        source,
        result,
        ...details
    });
    fs.appendFileSync(securityLog, entry + '\n', { encoding: 'utf8' });
}

function sendDiscordAlert(message) {
    // Use message_bridge.js to send alert
    execPromise(`node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`)
        .catch(err => console.error('Failed to send Discord alert:', err.message));
}

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
        logSecurityEvent('webhook_auth', 'FAILED', { ip: req.ip });
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    logSecurityEvent('webhook_auth', 'SUCCESS', { ip: req.ip });
    
    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const minute = Math.floor(Date.now() / 60000);
    
    // Request rate limit
    if (!checkRateLimit(ip, 'request')) {
        logSecurityEvent('rate_limit', 'EXCEEDED', { ip, type: 'request', minute });
        // Check if sustained for more than 2 minutes
        const sustained = Array.from(requestCounts.keys())
            .filter(m => m >= minute - 2)
            .every(m => (requestCounts.get(m)?.get(ip) || 0) > 60);
        if (sustained) {
            sendDiscordAlert(`SUSTAINED HIGH WEBHOOK RATE: ${ip} exceeded 60 RPM for 2+ minutes.`);
        }
        res.status(429).json({ error: 'Too many requests' });
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
    
    // Memory insert rate limit
    if (!checkRateLimit(ip, 'memory_insert')) {
        logSecurityEvent('rate_limit', 'EXCEEDED', { ip, type: 'memory_insert', minute });
        res.status(429).json({ error: 'Too many memory inserts' });
        return;
    }
    
    // Content sanitization
    const sanitized = sanitizeMemoryContent(content);
    if (!sanitized.safe) {
        logSecurityEvent('injection_detected', 'BLOCKED', { memoryId: id, reason: sanitized.reason });
        sendDiscordAlert(`INJECTION DETECTED IN WEBHOOK MEMORY: ${id} -- Reason: ${sanitized.reason}`);
        res.status(400).json({ error: 'Content rejected by security policy' });
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