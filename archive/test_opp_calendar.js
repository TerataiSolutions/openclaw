const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

const OPP_CALENDAR_ID = 'ken.barrientos@opp.agency';

async function testCalendarAccess(calendarId) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', new Date().toISOString());
    url.searchParams.set('maxResults', '1');
    
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    return { status: response.status, ok: response.ok, data: await response.json().catch(() => null) };
}

(async () => {
    try {
        console.log(`Testing access to calendar: ${OPP_CALENDAR_ID}`);
        const result = await testCalendarAccess(OPP_CALENDAR_ID);
        console.log(`Status: ${result.status}`);
        if (result.ok) {
            console.log('✅ Access granted. Calendar is shared.');
            console.log('Response:', JSON.stringify(result.data, null, 2));
        } else {
            console.log('❌ Access denied. Calendar not shared or insufficient permissions.');
            console.log('Error:', result.data ? JSON.stringify(result.data) : 'No error details');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
})();