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
    return await response.json();
}

(async () => {
    try {
        const list = await fetchCalendarList();
        console.log('=== Calendars accessible to ken@terataisolutions.co ===\n');
        list.items.forEach((cal, idx) => {
            console.log(`${idx + 1}. ${cal.summary} (${cal.id})`);
            console.log(`   Owner: ${cal.owner?.email || 'Unknown'}`);
            console.log(`   Access role: ${cal.accessRole}`);
            console.log(`   Primary: ${cal.primary ? 'Yes' : 'No'}`);
            console.log(`   Time zone: ${cal.timeZone}`);
            console.log(`   Background color: ${cal.backgroundColor}`);
            console.log();
        });
        console.log(`Total calendars: ${list.items.length}`);
        console.log('\n--- Shared calendar detection ---');
        const shared = list.items.filter(c => c.owner?.email && !c.owner.email.includes('ken@terataisolutions.co'));
        if (shared.length > 0) {
            console.log('Found calendars owned by other users:');
            shared.forEach(c => console.log(`  - ${c.summary} (owner: ${c.owner.email})`));
        } else {
            console.log('No calendars owned by other users found.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
})();