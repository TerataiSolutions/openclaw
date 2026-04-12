#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { isActiveHours } = require('../utils.js');

async function sendDM(message) {
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Bridge stderr:', stderr);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours, skipping goal reminder.');
        return;
    }
    const message = 'New week. What is your pitch target?';
    console.log('Sending weekly goal reminder...');
    const sent = await sendDM(message);
    if (sent) {
        console.log('Goal reminder sent.');
    } else {
        console.error('Failed to send goal reminder.');
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});