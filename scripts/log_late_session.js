#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const TIMEZONE = 'America/New_York';

function getEasternHour(date = new Date()) {
    return parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        hour: 'numeric',
        hour12: false
    }).format(date));
}

function isQuietHours() {
    const hour = getEasternHour();
    return hour >= 23 || hour < 7;
}

async function main() {
    if (!isQuietHours()) {
        console.log('Not quiet hours, skipping.');
        return;
    }
    
    const message = process.argv.slice(2).join(' ');
    if (!message) {
        console.error('Usage: node log_late_session.js "<message>"');
        process.exit(1);
    }
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Missing Supabase environment variables');
        return;
    }
    
    const memory = {
        type: 'conversation',
        content: `User sent message during quiet hours (Eastern): "${message.substring(0, 200)}"`,
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
            process.exit(1);
        } else {
            console.log('Late session logged.');
        }
    } catch (err) {
        console.error('Error logging late session:', err.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});