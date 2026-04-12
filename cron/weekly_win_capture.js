#!/usr/bin/env node

const { isActiveHours } = require('../utils.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sendDM(message) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
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
        console.log('Outside active hours (7:00 AM – 11:00 PM UTC). Skipping.');
        return;
    }
    
    // Ensure it's Friday (optional, cron will schedule Friday anyway)
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday, 5 = Friday
    if (day !== 5) {
        console.log('Not Friday (UTC). Skipping weekly win capture.');
        return;
    }
    
    const message = `Friday capture: What's the win this week?\nOne thing that moved the needle — big or small.`;
    console.log('Sending weekly win capture...');
    const sent = await sendDM(message);
    if (!sent) {
        console.error('Failed to send weekly win capture.');
        process.exit(1);
    }
    console.log('Weekly win capture sent.');
}

main().catch(err => {
    console.error('Weekly win capture error:', err);
    process.exit(1);
});