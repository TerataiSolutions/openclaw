#!/usr/bin/env node

/**
 * Discord Bridge – sends a Discord DM directly via REST API.
 * Usage: node discord_bridge.js "Your message here"
 */

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '1122248771208757279'; // fallback to Kanji.Yokai

if (!DISCORD_BOT_TOKEN) {
    console.error('Error: DISCORD_BOT_TOKEN environment variable not set.');
    process.exit(1);
}

async function getDMChannel() {
    // Create or retrieve DM channel with the user
    const url = 'https://discord.com/api/v10/users/@me/channels';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipient_id: DISCORD_USER_ID }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Discord API ${response.status}: ${error}`);
        }
        const data = await response.json();
        return data.id;
    } catch (err) {
        console.error('Failed to get DM channel:', err.message);
        return null;
    }
}

async function sendDM(message) {
    const channelId = await getDMChannel();
    if (!channelId) {
        console.error('Cannot send message: no DM channel.');
        return false;
    }
    
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: message }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Discord API ${response.status}: ${error}`);
        }
        console.log('Discord DM sent successfully.');
        return true;
    } catch (err) {
        console.error('Failed to send DM:', err.message);
        return false;
    }
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