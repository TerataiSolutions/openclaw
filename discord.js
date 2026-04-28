// Discord messaging helper — re-exports from lib/clients/discord for backward compatibility
const { sendDiscordMessage, sendDiscordAlert } = require('./lib/clients/discord');

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1486849626597490870';

/**
 * Send a message to the configured Discord channel (or DM if no channel set).
 * @param {string} message - Message content to send
 * @returns {Promise<boolean>} Whether the send was successful
 */
async function sendMessage(message) {
    if (!message) return false;
    return sendDiscordMessage(DISCORD_CHANNEL_ID, message);
}

module.exports = { sendMessage };
