#!/usr/bin/env node

const FormData = require('form-data');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || '1122248771208757279';

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
            console.error('Discord channel creation failed:', response.status, response.statusText);
            return null;
        }
        const data = await response.json();
        return data.id;
    } catch (err) {
        console.error('Discord channel error:', err.message);
        return null;
    }
}

async function sendText() {
    const channelId = await getDiscordDMChannel();
    if (!channelId) {
        throw new Error('Could not obtain Discord DM channel');
    }
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Test text message via API' }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Discord text send failed: ${response.status} ${errText}`);
    }
    console.log('Text sent successfully');
    return true;
}

async function sendFile(buffer, filename, content) {
    const channelId = await getDiscordDMChannel();
    if (!channelId) {
        throw new Error('Could not obtain Discord DM channel');
    }
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const form = new FormData();
    form.append('content', content);
    form.append('file', buffer, {
        filename: filename,
        contentType: 'application/octet-stream',
    });

    const headers = {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        ...form.getHeaders(),
    };
    console.log('Request headers:', { ...headers, Authorization: 'Bot ***' });

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
    });
    if (!response.ok) {
        const errText = await response.text();
        console.error('Discord upload error details:', { status: response.status, statusText: response.statusText, body: errText });
        throw new Error(`Discord file upload failed: ${response.status} ${errText}`);
    }
    console.log('File sent successfully');
    return true;
}

async function main() {
    console.log('Testing Discord file upload...');
    await sendText();
    
    // Create a small text file
    const buffer = Buffer.from('Hello, this is a test file.', 'utf8');
    await sendFile(buffer, 'test.txt', 'Here is a test file');
    
    console.log('All tests passed');
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});