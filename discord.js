// Discord messaging helper for cron jobs
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

async function sendMessage(message) {
    if (!DISCORD_BOT_TOKEN) {
        console.error('DISCORD_BOT_TOKEN not set');
        return false;
    }

    let channelId = DISCORD_CHANNEL_ID;
    if (!channelId && DISCORD_USER_ID) {
        // Try to create or get DM channel
        channelId = await getDMChannel(DISCORD_USER_ID);
        if (!channelId) {
            console.error('Failed to get DM channel');
            return false;
        }
    }
    if (!channelId) {
        console.error('No DISCORD_CHANNEL_ID or DISCORD_USER_ID set');
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
        if (response.ok) {
            console.log('Discord message sent');
            return true;
        } else {
            const error = await response.text();
            console.error(`Discord API error ${response.status}: ${error}`);
            return false;
        }
    } catch (err) {
        console.error('Failed to send Discord message:', err.message);
        return false;
    }
}

async function getDMChannel(userId) {
    const url = 'https://discord.com/api/v10/users/@me/channels';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipient_id: userId }),
        });
        if (response.ok) {
            const data = await response.json();
            return data.id;
        } else {
            const error = await response.text();
            console.error(`Failed to create DM channel: ${error}`);
            return null;
        }
    } catch (err) {
        console.error('Error creating DM channel:', err.message);
        return null;
    }
}

module.exports = { sendMessage };