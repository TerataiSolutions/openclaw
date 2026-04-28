const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

const CALENDAR_ID = 'ken@terataisolutions.co';
const TIMEZONE = 'America/Kentucky/Louisville';

async function createEvent() {
    // Determine Tuesday April 14, 2026, 2-3 PM
    const today = new Date();
    let diff = 2 - today.getDay(); // 2 = Tuesday
    if (diff <= 0) diff += 7;
    const tuesday = new Date(today);
    tuesday.setDate(today.getDate() + diff);
    const startDateTime = new Date(tuesday);
    startDateTime.setHours(14, 0, 0, 0);
    const endDateTime = new Date(tuesday);
    endDateTime.setHours(15, 0, 0, 0);
    const startISO = startDateTime.toISOString().replace(/\.\d{3}Z$/, '');
    const endISO = endDateTime.toISOString().replace(/\.\d{3}Z$/, '');

    const event = {
        summary: 'Out of office',
        description: 'Time blocked out as requested via OpenClaw assistant. (Regular event with attendee because out‑of‑office events cannot have attendees.)',
        start: {
            dateTime: startISO,
            timeZone: TIMEZONE,
        },
        end: {
            dateTime: endISO,
            timeZone: TIMEZONE,
        },
        eventType: 'default',
        transparency: 'opaque',
        visibility: 'private',
        attendees: [
            {
                email: 'ken.barrientos@opp.agency',
                responseStatus: 'needsAction'
            }
        ],
    };

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
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
        throw new Error(`Create event failed: ${response.status} ${error}`);
    }
    const data = await response.json();
    return data;
}

(async () => {
    try {
        console.log('Creating regular event with attendee...');
        const result = await createEvent();
        console.log('✅ Event created successfully!');
        console.log('Event ID:', result.id);
        console.log('Event type:', result.eventType);
        console.log('Attendees:', result.attendees?.map(a => a.email).join(', ') || 'none');
        console.log('Link:', result.htmlLink);
        console.log('Start:', result.start.dateTime);
        console.log('End:', result.end.dateTime);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();