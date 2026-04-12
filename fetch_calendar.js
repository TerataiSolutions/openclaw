const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

async function fetchCalendarEvents() {
    const now = new Date();
    const timeMin = now.toISOString();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const timeMax = sevenDaysLater.toISOString();
    
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');
    
    console.log('Fetching calendar events from', timeMin, 'to', timeMax);
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar API error: ${response.status} ${response.statusText}\n${errorText}`);
    }
    const data = await response.json();
    return data;
}

(async () => {
    try {
        const eventsData = await fetchCalendarEvents();
        console.log('=== Raw Calendar API response ===');
        console.log(JSON.stringify(eventsData, null, 2));
        console.log('\n=== Events for the next 7 days ===');
        
        if (!eventsData.items || eventsData.items.length === 0) {
            console.log('No events found.');
            return;
        }
        
        eventsData.items.forEach((event, idx) => {
            console.log(`\n${idx + 1}. ${event.summary || '(No title)'}`);
            console.log(`   Event ID: ${event.id}`);
            console.log(`   Creator: ${event.creator?.email || 'Unknown'}`);
            console.log(`   Calendar: ${event.organizer?.email || 'primary'}`);
            console.log(`   Status: ${event.status}`);
            if (event.start.dateTime) {
                console.log(`   Start (dateTime): ${event.start.dateTime}`);
                console.log(`   End (dateTime): ${event.end.dateTime}`);
            } else if (event.start.date) {
                console.log(`   Start (all-day): ${event.start.date}`);
                console.log(`   End (all-day): ${event.end.date}`);
            }
            if (event.location) console.log(`   Location: ${event.location}`);
            if (event.description) console.log(`   Description: ${event.description.substring(0, 100)}...`);
            if (event.attendees) {
                console.log(`   Attendees: ${event.attendees.map(a => a.email).join(', ')}`);
            }
        });
        
        console.log(`\nTotal events: ${eventsData.items.length}`);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();