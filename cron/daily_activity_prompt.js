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
        console.log('Outside active hours, skipping daily activity prompt.');
        return;
    }
    const message = 'Daily check-in: log your activity so far today.';
    console.log('Sending daily activity prompt...');
    const sent = await sendDM(message);
    if (sent) {
        console.log('Activity prompt sent.');
    } else {
        console.error('Failed to send activity prompt.');
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});