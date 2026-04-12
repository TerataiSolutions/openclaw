# Gmail and Calendar Skill

You have full access to the user's Gmail and Google Calendar through the Google APIs.
OAuth credentials are stored at /data/.openclaw/credentials/google.json.

---

## READ GMAIL INBOX

Fetch unread emails from the last 2 minutes:

```bash
curl -s "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:2m&maxResults=10" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

Fetch full email by message ID:

```bash
curl -s "https://gmail.googleapis.com/gmail/v1/users/me/messages/MESSAGE_ID?format=full" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

Search emails by query:

```bash
curl -s "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=SEARCH_QUERY&maxResults=10" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

---

## SEND EMAIL

```bash
EMAIL_CONTENT=$(echo -e "From: ken@terataisolutions.co\r\nTo: RECIPIENT\r\nSubject: SUBJECT\r\n\r\nBODY" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
curl -s -X POST "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")" \
  -H "Content-Type: application/json" \
  -d "{\"raw\": \"${EMAIL_CONTENT}\"}"
```

---

## DRAFT EMAIL

```bash
EMAIL_CONTENT=$(echo -e "From: ken@terataisolutions.co\r\nTo: RECIPIENT\r\nSubject: SUBJECT\r\n\r\nBODY" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
curl -s -X POST "https://gmail.googleapis.com/gmail/v1/users/me/drafts" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")" \
  -H "Content-Type: application/json" \
  -d "{\"message\": {\"raw\": \"${EMAIL_CONTENT}\"}}"
```

---

## READ CALENDAR

Get today's events:

```bash
TODAY=$(date -u +%Y-%m-%dT00:00:00Z)
TOMORROW=$(date -u -d "+1 day" +%Y-%m-%dT00:00:00Z)
curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${TODAY}&timeMax=${TOMORROW}&singleEvents=true&orderBy=startTime" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

Get events for a date range:

```bash
curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=START_DATE&timeMax=END_DATE&singleEvents=true&orderBy=startTime" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

Dates must be in RFC3339 format: 2026-04-10T00:00:00Z

---

## CREATE CALENDAR EVENT

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": \"EVENT TITLE\",
    \"start\": {\"dateTime\": \"2026-04-10T10:00:00-05:00\"},
    \"end\": {\"dateTime\": \"2026-04-10T11:00:00-05:00\"},
    \"description\": \"EVENT DESCRIPTION\"
  }"
```

Timezone for Louisville Kentucky is America/Chicago (CDT is UTC-5, CST is UTC-6).

---

## DELETE CALENDAR EVENT

```bash
curl -s -X DELETE "https://www.googleapis.com/calendar/v3/calendars/primary/events/EVENT_ID" \
  -H "Authorization: Bearer $(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json','utf8'));console.log(c.access_token)")"
```

---

## TOKEN REFRESH

If any API call returns 401 Unauthorized the access token has expired. Refresh it:

```bash
node -e "
const fs = require('fs');
const https = require('https');
const creds = JSON.parse(fs.readFileSync('/data/.openclaw/credentials/google.json', 'utf8'));
const data = JSON.stringify({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  refresh_token: creds.refresh_token,
  grant_type: 'refresh_token'
});
const req = https.request({
  hostname: 'oauth2.googleapis.com',
  path: '/token',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': data.length}
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const token = JSON.parse(body);
    creds.access_token = token.access_token;
    if (token.refresh_token) creds.refresh_token = token.refresh_token;
    fs.writeFileSync('/data/.openclaw/credentials/google.json', JSON.stringify(creds, null, 2));
    console.log('Token refreshed successfully');
  });
});
req.write(data);
req.end();
"
```

Always retry the original API call after refreshing the token.

---

## IMPORTANT RULES

- Never send an email without explicit confirmation from the user first
- Always show the user the full email content before sending and ask them to confirm
- When drafting replies present the draft to the user and wait for approval
- Calendar event creation also requires user confirmation before executing
- If a token refresh fails tell the user they need to reauthorize
