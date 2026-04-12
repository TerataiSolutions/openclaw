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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(memory)
        });
        if (!response.ok) {
            console.error('Failed to log late session:', response.statusText);
        } else {
            console.log('Late session logged.');
        }
    } catch (err) {
        console.error('Error logging late session:', err.message);
    }
}

module.exports = { getEasternHour, isActiveHours, isQuietHours, logLateSession };