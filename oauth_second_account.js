const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://openclaw-production-aefb.up.railway.app/auth/google/callback';
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');

const STATE = crypto.randomBytes(16).toString('hex');

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', STATE);

console.log('=== OAuth 2.0 Authorization URL for second Google account (ken.barrientos@opp.agency) ===');
console.log('Scopes: read‑only Gmail & Calendar');
console.log('URL:');
console.log(authUrl.toString());
console.log('\n--- Details ---');
console.log('Client ID:', CLIENT_ID);
console.log('Redirect URI:', REDIRECT_URI);
console.log('Scopes:', SCOPES);
console.log('State (CSRF token):', STATE);