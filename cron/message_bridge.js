#!/usr/bin/env node

/**
 * Message Bridge – sends a message via Discord DM, with Telegram fallback.
 * Usage: node message_bridge.js "Your message here"
 */

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '1122248771208757279';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!DISCORD_BOT_TOKEN && !TELEGRAM_BOT_TOKEN) {
    console.error('Error: Neither DISCORD_BOT_TOKEN nor TELEGRAM_BOT_TOKEN is set.');
    process.exit(1);
}

async function getDiscordDMChannel() {
    if (!DISCORD_BOT_TOKEN) return null;
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
        console.error('Failed to get Discord DM channel:', err.message);
        return null;
    }
}

async function sendDiscordMessage(message) {
    const channelId = await getDiscordDMChannel();
    if (!channelId) return false;
    
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
        console.log('Message sent via Discord.');
        return true;
    } catch (err) {
        console.error('Failed to send Discord message:', err.message);
        return false;
    }
}

async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Telegram credentials missing.');
        return false;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Telegram API ${response.status}: ${error}`);
        }
        console.log('Message sent via Telegram.');
        return true;
    } catch (err) {
        console.error('Failed to send Telegram message:', err.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node message_bridge.js "<message>"');
        process.exit(1);
    }
    const message = args.join(' ');
    
    let success = false;
    let channel = 'none';
    
    // Try Discord first
    if (DISCORD_BOT_TOKEN) {
        success = await sendDiscordMessage(message);
        if (success) channel = 'discord';
    }
    
    // If Discord fails or not configured, try Telegram
    if (!success && TELEGRAM_BOT_TOKEN) {
        success = await sendTelegramMessage(message);
        if (success) channel = 'telegram';
    }
    
    if (!success) {
        console.error('Failed to send message via any channel.');
        process.exit(1);
    }
    
    console.log(`Delivery channel: ${channel}`);
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});