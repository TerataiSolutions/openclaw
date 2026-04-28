const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

async function fetchCalendarList() {
    const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) throw new Error(`Calendar list error: ${response.status}`);
    return await response.json();
}

async function fetchEvents(calendarId, calendarName) {
    const now = new Date();
    const timeMin = now.toISOString();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const timeMax = sevenDaysLater.toISOString();
    
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');
    
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar ${calendarName} error: ${response.status} ${errorText}`);
    }
    return await response.json();
}

(async () => {
    try {
        const list = await fetchCalendarList();
        console.log('Found calendars:', list.items.map(c => c.summary).join(', '));
        let totalEvents = 0;
        for (const cal of list.items) {
            console.log(`\n=== Calendar: ${cal.summary} (${cal.id}) ===`);
            const eventsData = await fetchEvents(cal.id, cal.summary);
            if (!eventsData.items || eventsData.items.length === 0) {
                console.log('No events.');
                continue;
            }
            eventsData.items.forEach((event, idx) => {
                console.log(`\n${idx + 1}. ${event.summary || '(No title)'}`);
                console.log(`   Event ID: ${event.id}`);
                console.log(`   Creator: ${event.creator?.email || 'Unknown'}`);
                console.log(`   Status: ${event.status}`);
                if (event.start.dateTime) {
                    console.log(`   Start: ${event.start.dateTime}`);
                    console.log(`   End: ${event.end.dateTime}`);
                } else if (event.start.date) {
                    console.log(`   Start (all-day): ${event.start.date}`);
                    console.log(`   End (all-day): ${event.end.date}`);
                }
                if (event.location) console.log(`   Location: ${event.location}`);
                if (event.description) console.log(`   Description: ${event.description.substring(0, 80)}...`);
            });
            totalEvents += eventsData.items.length;
            console.log(`Total events in this calendar: ${eventsData.items.length}`);
        }
        console.log(`\n=== Summary ===`);
        console.log(`Total events across all calendars in the next 7 days: ${totalEvents}`);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();