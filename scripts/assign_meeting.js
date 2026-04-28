'use strict';

const { logJson } = require('../utils.js');

const PORT = process.env.FATHOM_WEBHOOK_PORT || 4242;
const LOCAL_URL = `http://localhost:${PORT}/assign`;

async function assignMeeting(token, clientId) {
  const body = JSON.stringify({ token, client_id: clientId });
  try {
    const response = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const result = await response.json();
    if (!response.ok) {
      logJson('error', { event: 'assign_meeting_failed', token, clientId, status: response.status, result });
      return { ok: false, reason: `HTTP ${response.status}: ${JSON.stringify(result)}` };
    }
    logJson('info', { event: 'assign_meeting_success', token, clientId, result });
    return result;
  } catch (err) {
    logJson('error', { event: 'assign_meeting_error', token, clientId, error: err.message });
    return { ok: false, reason: `Connection failed: ${err.message}` };
  }
}

function parseMessage(message) {
  // message format: "Assign meeting: TOKEN CLIENT_ID"
  const prefix = 'Assign meeting:';
  if (!message.toLowerCase().startsWith(prefix.toLowerCase())) {
    console.error('Invalid command format. Expected "Assign meeting: TOKEN CLIENT_ID"');
    process.exit(1);
  }
  const rest = message.slice(prefix.length).trim();
  const parts = rest.split(/\s+/);
  if (parts.length !== 2) {
    console.error('Expected exactly two arguments after colon: token and client_id');
    process.exit(1);
  }
  return { token: parts[0].toUpperCase(), clientId: parts[1] };
}

async function main() {
  const message = process.argv.slice(2).join(' ');
  if (!message) {
    console.error('Usage: node assign_meeting.js "Assign meeting: TOKEN CLIENT_ID"');
    process.exit(1);
  }
  const { token, clientId } = parseMessage(message);
  const result = await assignMeeting(token, clientId);
  if (result.ok) {
    console.log(`✅ Meeting ${token} assigned to ${clientId}.`);
    console.log(`   Saved ${result.saved} chunks, failed ${result.failed}, total ${result.total}.`);
  } else {
    console.error(`❌ Assignment failed: ${result.reason}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { assignMeeting };