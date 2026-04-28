// Shared utilities for HEARTBEAT system
const TIMEZONE = 'America/New_York';
const fs = require('fs');
const path = require('path');
const { sanitizeMemoryContent } = require('./security/input_sanitizer.js');
const { setCapabilityStatus } = require('./cron/capability_monitor.js');
const { generateEmbedding: generateEmbeddingFromLib } = require('./lib/clients/cohere');

/**
 * Retry a Supabase REST call with one retry after delay.
 * On second failure, log error to logs/errors.log and return null.
 */
async function retrySupabaseCall(fn, attempts = 2, delay = 2000) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === attempts - 1) {
                // Last attempt failed
                const logEntry = `${new Date().toISOString()} - Supabase call failed: ${err.message}\n`;
                const logPath = path.join(__dirname, 'logs', 'errors.log');
                fs.appendFileSync(logPath, logEntry, { encoding: 'utf8' });
                console.error('Supabase call failed after retries, logged to', logPath);
                return null;
            }
            console.warn(`Supabase call failed (attempt ${i + 1}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

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
 * Returns true if current Eastern time is within active hours (8:00 AM – 11:00 PM).
 * Quiet hours are 11:00 PM – 8:00 AM Eastern.
 */
function isActiveHours() {
    const hour = getEasternHour();
    return hour >= 8 && hour < 23;
}

/**
 * Returns true if the given Date object is within quiet hours (Eastern).
 */
function isQuietHours(date = new Date()) {
    const hour = getEasternHour(date);
    return hour >= 23 || hour < 8;
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
 * Delegates to lib/clients/cohere with capability tracking.
 */
async function generateEmbedding(text) {
    try {
        return await generateEmbeddingFromLib(text);
    } catch (cohereError) {
        setCapabilityStatus('semanticSearch', false, `Cohere API unavailable: ${cohereError.message}`);
        throw cohereError;
    }
}

/**
 * Save a memory to Supabase with an automatically generated embedding.
 * @param {object} memory - Memory object (must contain type, content, importance, tags etc.)
 * @returns {Promise<object>} The saved memory (including id, created_at) or null on failure.
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
    // Validation: client memory types require client_id
    if (memory.type.startsWith('client_') && !memory.client_id) {
        throw new Error('client_id is required for client memory types.');
    }
    // Security sanitization
    const sanitized = sanitizeMemoryContent(memory.content);
    if (sanitized.tagged) {
        // Add injection_suspect tag if not already present
        if (!memory.tags) memory.tags = [];
        if (!memory.tags.includes('injection_suspect')) {
            memory.tags.push('injection_suspect');
        }
    }
    // Generate embedding (no retry for Cohere)
    const embedding = await generateEmbedding(memory.content);
    const memoryWithEmbedding = {
        ...memory,
        embedding,
    };
    const url = `${SUPABASE_URL}/rest/v1/memories`;
    const saved = await retrySupabaseCall(async () => {
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
        return await response.json();
    });
    return saved ? saved[0] : null;
}

function logJson(level, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        ...data
    };
    console.log(JSON.stringify(entry));
}

module.exports = { getEasternHour, isActiveHours, isQuietHours, logLateSession, generateEmbedding, saveMemoryWithEmbedding, retrySupabaseCall, logJson };