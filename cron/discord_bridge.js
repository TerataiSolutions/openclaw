#!/usr/bin/env node

/**
 * Discord Bridge – sends a Discord message to configured channel (or DM).
 * Usage: node discord_bridge.js "Your message here"
 *
 * Thin CLI wrapper around lib/clients/discord for backward compatibility.
 */

const { sendDiscordMessage } = require('../lib/clients/discord');
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1486849626597490870';
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '1122248771208757279';

async function sendDM(message) {
    if (DISCORD_CHANNEL_ID) {
        return sendDiscordMessage(DISCORD_CHANNEL_ID, message);
    }
    return sendDiscordMessage(DISCORD_USER_ID, message);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node discord_bridge.js "<message>"');
        process.exit(1);
    }
    const message = args.join(' ');
    const success = await sendDM(message);
    process.exit(success ? 0 : 1);
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
