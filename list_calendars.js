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
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar list error: ${response.status} ${response.statusText}\n${errorText}`);
    }
    const data = await response.json();
    return data;
}

(async () => {
    try {
        const list = await fetchCalendarList();
        console.log('=== Calendars accessible ===');
        list.items.forEach((cal, idx) => {
            console.log(`${idx + 1}. ${cal.summary} (${cal.id})`);
            console.log(`   Access role: ${cal.accessRole}`);
            console.log(`   Primary: ${cal.primary ? 'Yes' : 'No'}`);
            console.log(`   Time zone: ${cal.timeZone}`);
            console.log();
        });
        console.log(`Total calendars: ${list.items.length}`);
    } catch (err) {
        console.error('Error:', err.message);
    }
})();