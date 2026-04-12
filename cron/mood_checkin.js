#!/usr/bin/env node

const { getEasternHour, isActiveHours } = require('../utils.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sendDM(message) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/discord_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Bridge stderr:', stderr);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
        return false;
    }
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomMoodQuestion() {
    const questions = [
        "How's the day going?",
        "Energy levels?",
        "How are you holding up?",
        "Anything on your mind?"
    ];
    return questions[Math.floor(Math.random() * questions.length)];
}

async function main() {
    // Check if we are within one of the allowed windows (10 AM–1 PM or 4 PM–8 PM Eastern)
    const now = new Date();
    const hour = getEasternHour(now);
    const minute = now.getMinutes(); // minute is local, not needed
    
    const inWindow1 = hour >= 10 && hour < 13;
    const inWindow2 = hour >= 16 && hour < 20;
    
    if (!inWindow1 && !inWindow2) {
        console.log(`Outside mood check‑in windows (current Eastern ${hour}:${minute}). Skipping.`);
        return;
    }
    
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM Eastern). Skipping.');
        return;
    }
    
    const question = getRandomMoodQuestion();
    console.log(`Sending mood check‑in: ${question}`);
    const sent = await sendDM(question);
    if (!sent) {
        console.error('Failed to send mood check‑in.');
        process.exit(1);
    }
    console.log('Mood check‑in sent.');
}

main().catch(err => {
    console.error('Mood check‑in error:', err);
    process.exit(1);
});