const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const accessToken = credentials.access_token;

async function fetchMessages() {
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5';
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
}

async function fetchMessageDetails(messageId) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Message fetch error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

(async () => {
    try {
        console.log('=== Raw response from messages list ===');
        const messagesData = await fetchMessages();
        console.log(JSON.stringify(messagesData, null, 2));
        console.log('\n=== Fetching full details for each message ===');
        
        if (!messagesData.messages || messagesData.messages.length === 0) {
            console.log('No messages found.');
            return;
        }
        
        for (const msg of messagesData.messages) {
            console.log(`\n--- Message ID: ${msg.id} ---`);
            const details = await fetchMessageDetails(msg.id);
            // Extract headers
            const headers = details.payload.headers.reduce((acc, h) => {
                acc[h.name.toLowerCase()] = h.value;
                return acc;
            }, {});
            const sender = headers.from || 'Unknown';
            const subject = headers.subject || '(No subject)';
            const date = headers.date || 'Unknown date';
            console.log(`Sender: ${sender}`);
            console.log(`Subject: ${subject}`);
            console.log(`Date: ${date}`);
            console.log(`Snippet: ${details.snippet ? details.snippet.substring(0, 100) + '...' : 'No snippet'}`);
        }
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();