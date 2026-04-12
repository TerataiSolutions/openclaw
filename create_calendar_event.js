const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

// Calendar ID for primary calendar
const CALENDAR_ID = 'ken@terataisolutions.co';
const TIMEZONE = 'America/Kentucky/Louisville';

// Determine Tuesday (April 14, 2026)
const today = new Date();
// Get day of week (0 = Sunday, 2 = Tuesday)
let daysUntilTuesday = (2 - today.getDay() + 7) % 7;
if (daysUntilTuesday === 0) daysUntilTuesday = 7; // If today is Tuesday, next Tuesday?
// Actually, if today is Tuesday, we might want today? The user said Tuesday, likely upcoming Tuesday.
// Since today is Saturday, daysUntilTuesday = 4 (Sunday 0, Monday 1, Tuesday 2? Wait compute).
// Let's compute properly:
// today.getDay() = 6 (Saturday)
// targetDay = 2 (Tuesday)
// diff = targetDay - today.getDay() = 2 - 6 = -4
// if diff <= 0, add 7
// So daysUntilTuesday = diff > 0 ? diff : diff + 7
let diff = 2 - today.getDay();
if (diff <= 0) diff += 7;
const tuesday = new Date(today);
tuesday.setDate(today.getDate() + diff);

// Set time to 2:00 PM local
const startDateTime = new Date(tuesday);
startDateTime.setHours(14, 0, 0, 0);
const endDateTime = new Date(tuesday);
endDateTime.setHours(15, 0, 0, 0);

// Format as ISO strings (no timezone offset, we'll specify timeZone)
const startISO = startDateTime.toISOString().replace(/\.\d{3}Z$/, '');
const endISO = endDateTime.toISOString().replace(/\.\d{3}Z$/, '');

const event = {
    summary: 'Blocked Out',
    description: 'Time blocked out as requested via OpenClaw assistant.',
    start: {
        dateTime: startISO,
        timeZone: TIMEZONE,
    },
    end: {
        dateTime: endISO,
        timeZone: TIMEZONE,
    },
    transparency: 'opaque', // busy
    visibility: 'private',
};

async function createEvent() {
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
        throw new Error(`Event creation failed: ${response.status} ${error}`);
    }
    const data = await response.json();
    return data;
}

(async () => {
    try {
        console.log('Creating calendar event...');
        console.log('Calendar:', CALENDAR_ID);
        console.log('Date:', tuesday.toDateString());
        console.log('Time:', '2:00 PM - 3:00 PM', TIMEZONE);
        const result = await createEvent();
        console.log('✅ Event created successfully!');
        console.log('Event ID:', result.id);
        console.log('Event link:', result.htmlLink);
        console.log('Start:', result.start.dateTime);
        console.log('End:', result.end.dateTime);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();