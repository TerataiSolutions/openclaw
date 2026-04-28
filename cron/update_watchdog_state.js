'use strict';
const fs = require('fs');
const path = require('path');

const STATE_FILE = '/data/.openclaw/aof/watchdog_state.json';
const state = { last_message_ts: Date.now(), alerted: false };

fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(state));

console.log(`[watchdog] state updated at ${new Date().toISOString()}`);