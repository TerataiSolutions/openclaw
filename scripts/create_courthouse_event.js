#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = '/data/.openclaw/credentials/google.json';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Environment variables GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.');
    console.error('Please set them and try again.');
    process.exit(1);
}

let credentials;
try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
} catch (err) {
    console.error('Failed to read credentials:', err.message);
    process.exit(1);
}

async function refreshAccessToken() {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: credentials.refresh_token,
            grant_type: 'refresh_token',
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }
    const data = await response.json();
    // Update credentials
    credentials.access_token = data.access_token;
    credentials.expires_in = data.expires_in;
    credentials.token_type = data.token_type;
    if (data.refresh_token) {
        credentials.refresh_token = data.refresh_token;
    }
    // Save back
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
    console.log('Token refreshed successfully');
    return credentials.access_token;
}

async function ensureValidToken() {
    // Simple heuristic: if token is older than 1 hour, refresh
    // (We don't have expiry timestamp, but we can try to refresh anyway)
    try {
        // Attempt a lightweight API call to check token validity
        const testUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1';
        const testRes = await fetch(testUrl, {
            headers: { 'Authorization': `Bearer ${credentials.access_token}` },
        });
        if (testRes.ok) {
            console.log('Current token is valid.');
            return credentials.access_token;
        }
        // If unauthorized, refresh
        if (testRes.status === 401) {
            console.log('Token expired, refreshing...');
            return await refreshAccessToken();
        }
        throw new Error(`Token check failed: ${testRes.status}`);
    } catch (err) {
        console.warn('Token check error, attempting refresh:', err.message);
        return await refreshAccessToken();
    }
}

async function createEvent(accessToken, options) {
    const {
        calendarId = 'ken@terataisolutions.co',
        summary = 'Courthouse Visit – Unreleased Titles',
        description = 'Visit to the courthouse regarding titles that were never released after dealership closure.',
        startDateTime,
        endDateTime,
        timeZone = 'America/Kentucky/Louisville',
        attendees = [],
    } = options;

    const event = {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        transparency: 'opaque',
        visibility: 'private',
    };
    if (attendees.length > 0) {
        event.attendees = attendees.map(email => ({ email }));
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Event creation failed: ${response.status} ${error}`);
    }
    return await response.json();
}

function parseDateTime(dateStr, timeStr) {
    // dateStr format: YYYY-MM-DD
    // timeStr format: HH:MM (24-hour)
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    const dt = new Date(year, month - 1, day, hour, minute);
    return dt.toISOString().replace(/\.\d{3}Z$/, '');
}

async function main() {
    // Parse command line arguments
    // Expected: node create_courthouse_event.js YYYY-MM-DD HH:MM HH:MM [attendee1 ...]
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('Usage: node create_courthouse_event.js <YYYY-MM-DD> <startHH:MM> <endHH:MM> [attendee1 attendee2 ...]');
        console.error('Example: node create_courthouse_event.js 2026-04-22 09:45 11:45 ken.barrientos@opp.agency');
        process.exit(1);
    }
    const [dateStr, startTime, endTime, ...attendees] = args;
    const startDateTime = parseDateTime(dateStr, startTime);
    const endDateTime = parseDateTime(dateStr, endTime);

    console.log('Creating calendar event...');
    console.log('Date:', dateStr);
    console.log('Time:', startTime, '–', endTime);
    console.log('Attendees:', attendees.length > 0 ? attendees.join(', ') : '(none)');

    const accessToken = await ensureValidToken();
    const result = await createEvent(accessToken, {
        calendarId: 'ken@terataisolutions.co',
        summary: 'Courthouse Visit – Unreleased Titles',
        description: 'Visit to the courthouse regarding titles that were never released after dealership closure.',
        startDateTime,
        endDateTime,
        timeZone: 'America/Kentucky/Louisville',
        attendees,
    });

    console.log('✅ Event created successfully!');
    console.log('Event ID:', result.id);
    console.log('Event link:', result.htmlLink);
    console.log('Start:', result.start.dateTime);
    console.log('End:', result.end.dateTime);
    if (result.attendees) {
        console.log('Invited:', result.attendees.map(a => a.email).join(', '));
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});