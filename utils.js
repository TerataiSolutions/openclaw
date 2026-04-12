// Shared utilities for HEARTBEAT system
const TIMEZONE = 'America/New_York';

/**
 * Returns the hour (0‑23) in Eastern time for a given Date.
 */
function getEasternHour(date = new Date()) {
    return parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        hour: 'numeric',
        hour12: false
    }).format(date));
}

/**
 * Returns true if current Eastern time is within active hours (7:00 AM – 11:00 PM).
 * Quiet hours are 11:00 PM – 7:00 AM Eastern.
 */
function isActiveHours() {
    const hour = getEasternHour();
    return hour >= 7 && hour < 23;
}

/**
 * Returns true if the given Date object is within quiet hours (Eastern).
 */
function isQuietHours(date = new Date()) {
    const hour = getEasternHour(date);
    return hour >= 23 || hour < 7;
}

/**
 * Log a late‑session memory (user messaging after 11:00 PM Eastern).
 * Call this when a user message is received during quiet hours.
 * Requires Supabase environment variables.
 */
async function logLateSession(userMessage) {
    // Only log if currently in quiet hours (Eastern)
    if (!isQuietHours()) return;
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Missing Supabase environment variables');
        return;
    }
    
    const memory = {
        type: 'conversation',
        content: `User sent message during quiet hours (Eastern): "${userMessage.substring(0, 200)}"`,
        importance: 3,
        tags: ['late_session']
    };
    
    try {
        await saveMemoryWithEmbedding(memory);
        console.log('Late session logged.');
    } catch (err) {
        console.error('Error logging late session:', err.message);
    }
}

/**
 * Generate a Cohere embedding for text.
 */
async function generateEmbedding(text) {
    const COHERE_ENDPOINT = process.env.COHERE_ENDPOINT || 'https://api.cohere.ai/v1/embed';
    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    if (!COHERE_API_KEY) {
        throw new Error('COHERE_API_KEY environment variable is not set');
    }
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            texts: [text],
            model: 'embed-english-v3.0',
            input_type: 'search_document',
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cohere API error: ${err}`);
    }
    const data = await response.json();
    return data.embeddings[0];
}

/**
 * Save a memory to Supabase with an automatically generated embedding.
 * @param {object} memory - Memory object (must contain type, content, importance, tags etc.)
 * @returns {Promise<object>} The saved memory (including id, created_at)
 */
async function saveMemoryWithEmbedding(memory) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set');
    }
    // Ensure required fields
    if (!memory.type || !memory.content) {
        throw new Error('Memory must have type and content');
    }
    // Generate embedding
    const embedding = await generateEmbedding(memory.content);
    const memoryWithEmbedding = {
        ...memory,
        embedding,
    };
    const url = `${SUPABASE_URL}/rest/v1/memories`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        body: JSON.stringify(memoryWithEmbedding),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Supabase insert error: ${err}`);
    }
    const saved = await response.json();
    return saved[0];
}

module.exports = { getEasternHour, isActiveHours, isQuietHours, logLateSession, generateEmbedding, saveMemoryWithEmbedding };