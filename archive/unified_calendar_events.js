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
        // If 404 or 403, calendar may not be accessible; skip
        return { items: [] };
    }
    return await response.json();
}

(async () => {
    try {
        const list = await fetchCalendarList();
        console.log('=== All calendars visible to ken@terataisolutions.co ===\n');
        list.items.forEach((cal, idx) => {
            console.log(`${idx + 1}. ${cal.summary} (${cal.id})`);
            console.log(`   Owner: ${cal.owner?.email || 'Unknown'}`);
            console.log(`   Access role: ${cal.accessRole}`);
            console.log(`   Primary: ${cal.primary ? 'Yes' : 'No'}`);
            console.log();
        });
        
        // Also explicitly add the OPP calendar if not already in list
        const oppCalendarId = 'ken.barrientos@opp.agency';
        const oppInList = list.items.find(c => c.id === oppCalendarId);
        if (!oppInList) {
            console.log(`\nNote: Calendar ${oppCalendarId} is shared but not yet in your calendar list.`);
            console.log('You may need to add it via Google Calendar UI for it to appear here.');
            // Still try to fetch events from it
            list.items.push({
                id: oppCalendarId,
                summary: 'OPP Agency Calendar (shared)',
                owner: { email: oppCalendarId },
                accessRole: 'reader',
                primary: false,
            });
        }
        
        console.log('\n=== Events across all calendars (next 7 days) ===');
        let totalEvents = 0;
        for (const cal of list.items) {
            console.log(`\n--- Calendar: ${cal.summary} (${cal.id}) ---`);
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