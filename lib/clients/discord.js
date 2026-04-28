const message_bridge = require('../../cron/message_bridge');

async function sendDiscordMessage(channelId, content) {
 return message_bridge.sendMessage(channelId, content);
}

async function sendDiscordAlert(content) {
 return sendDiscordMessage(process.env.DISCORD_USER_ID, content);
}

module.exports = { sendDiscordMessage, sendDiscordAlert };
