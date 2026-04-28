const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function refreshAccessToken() {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: credentials.refresh_token,
            grant_type: 'refresh_token',
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }
    const data = await response.json();
    // Update credentials
    credentials.access_token = data.access_token;
    credentials.expires_in = data.expires_in;
    credentials.token_type = data.token_type;
    // Note: refresh token may not be returned; keep existing
    if (data.refresh_token) {
        credentials.refresh_token = data.refresh_token;
    }
    // Save back
    fs.writeFileSync('/data/.openclaw/credentials/google.json', JSON.stringify(credentials, null, 2));
    console.log('Token refreshed successfully');
    console.log('New access token:', data.access_token.substring(0, 30) + '...');
    return credentials.access_token;
}

(async () => {
    try {
        await refreshAccessToken();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();