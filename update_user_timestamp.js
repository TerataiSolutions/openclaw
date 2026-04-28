const fs = require('fs');
const path = require('path');
const STATE_FILE = '/data/.openclaw/aof/watchdog_state.json';
let state = {};
try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (e) {
    state = {};
}
state.last_user_ts = Date.now();
fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
console.log(`[watchdog] user timestamp updated at ${new Date().toISOString()}`);