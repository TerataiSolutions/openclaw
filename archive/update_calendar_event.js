const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

const CALENDAR_ID = 'ken@terataisolutions.co';
const EVENT_ID = 'rdajbek9b41f8n39s4cbo7u784'; // from previous creation

async function fetchEvent() {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(EVENT_ID)}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Fetch event failed: ${response.status} ${error}`);
    }
    return await response.json();
}

async function updateEvent() {
    const event = await fetchEvent();
    console.log('Current event:', JSON.stringify(event, null, 2));
    
    // Update event type to "outOfOffice"
    event.eventType = 'outOfOffice';
    // Ensure transparency is 'opaque' (busy) maybe? outOfOffice events are automatically busy.
    // Add attendee
    if (!event.attendees) {
        event.attendees = [];
    }
    // Add opp email if not already present
    const oppEmail = 'ken.barrientos@opp.agency';
    if (!event.attendees.some(a => a.email === oppEmail)) {
        event.attendees.push({
            email: oppEmail,
            responseStatus: 'needsAction'
        });
    }
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(EVENT_ID)}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Update event failed: ${response.status} ${error}`);
    }
    const updated = await response.json();
    return updated;
}

(async () => {
    try {
        console.log('Updating calendar event...');
        const updated = await updateEvent();
        console.log('✅ Event updated successfully!');
        console.log('Event ID:', updated.id);
        console.log('Event type:', updated.eventType);
        console.log('Attendees:', updated.attendees?.map(a => a.email).join(', ') || 'none');
        console.log('Link:', updated.htmlLink);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();