#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { clients } = require('../clients/registry.js');
const sortedClients = clients.sort((a, b) => a.priority - b.priority);
const { isActiveHours, saveMemoryWithEmbedding } = require('../utils.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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

async function fetchRotationState() {
    // Look for a memory tagged 'client_pulse_state'
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{client_pulse_state}&select=id,content&order=created_at.desc&limit=1`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch rotation state: ${response.status} ${response.statusText}`);
    }
    const states = await response.json();
    if (states.length === 0) {
        return null;
    }
    // content is JSON string with { lastIndex, lastDate }
    try {
        return JSON.parse(states[0].content);
    } catch (e) {
        console.error('Failed to parse rotation state content:', states[0].content);
        return null;
    }
}

async function saveRotationState(index, date) {
    const state = { lastIndex: index, lastDate: date.toISOString() };
    const memory = {
        type: 'system',
        content: JSON.stringify(state),
        importance: 1,
        tags: ['client_pulse_state'],
    };
    const saved = await saveMemoryWithEmbedding(memory);
    console.log('Rotation state saved:', state, '(id: ' + saved.id + ')');
}

async function main() {
    if (!isActiveHours()) {
        console.log('Outside active hours (7:00 AM – 11:00 PM Eastern). Skipping.');
        return;
    }
    
    // Ensure it's Monday (optional, cron will schedule Monday anyway)
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday
    if (day !== 1) {
        console.log('Not Monday (UTC). Skipping client pulse.');
        return;
    }
    
    const state = await fetchRotationState();
    let nextIndex = 0;
    if (state) {
        // Rotate to next client
        nextIndex = (state.lastIndex + 1) % sortedClients.length;
        // Check if lastDate is less than 7 days ago; if not, maybe skip?
        // For simplicity, just rotate.
    }
    
    const client = sortedClients[nextIndex];
    const message = `Client check-in: ${client.name}\nHow is this account performing? Anything to flag?`;
    
    console.log(`Sending client pulse for ${client.name} (index ${nextIndex})...`);
    const sent = await sendDM(message);
    if (!sent) {
        console.error('Failed to send client pulse.');
        process.exit(1);
    }
    
    // Save updated rotation state
    await saveRotationState(nextIndex, now);
    console.log('Client pulse sent and rotation state updated.');
}

main().catch(err => {
    console.error('Client pulse error:', err);
    process.exit(1);
});