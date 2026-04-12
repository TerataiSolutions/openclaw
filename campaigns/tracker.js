#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { clients } = require('../clients/registry.js');
const { saveMemoryWithEmbedding } = require('../utils.js');
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

/**
 * Find client by name (case-insensitive, partial match).
 */
function findClientByName(name) {
    const lower = name.toLowerCase();
    for (const client of clients) {
        if (client.name.toLowerCase().includes(lower) || lower.includes(client.name.toLowerCase())) {
            return client;
        }
    }
    return null;
}

/**
 * Parse log line: 'Log campaign: [Client Name] -- [X] pitches, [X] meetings booked, [X] voicemails, [X] follow-ups, [X] meetings pending'
 */
function parseCampaignLog(line) {
    const match = line.match(/Log campaign:\s*(.+?)\s*--\s*(\d+)\s*pitches,\s*(\d+)\s*meetings booked,\s*(\d+)\s*voicemails,\s*(\d+)\s*follow-ups,\s*(\d+)\s*meetings pending/i);
    if (!match) {
        throw new Error('Invalid log format. Expected: "Log campaign: [Client Name] -- [X] pitches, [X] meetings booked, [X] voicemails, [X] follow-ups, [X] meetings pending"');
    }
    const [, clientName, pitches, meetingsBooked, voicemails, followUps, meetingsPending] = match;
    return {
        clientName: clientName.trim(),
        pitches: parseInt(pitches),
        meetingsBooked: parseInt(meetingsBooked),
        voicemails: parseInt(voicemails),
        followUps: parseInt(followUps),
        meetingsPending: parseInt(meetingsPending),
    };
}

/**
 * Calculate pitch-to-meeting ratio.
 */
function calculateRatio(pitches, meetingsBooked) {
    if (meetingsBooked === 0) return Infinity;
    return (pitches / meetingsBooked).toFixed(2);
}

/**
 * Get current week number (ISO week).
 */
function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
}

/**
 * Save campaign metric as memory.
 */
async function saveCampaignMetric(client, metrics, week) {
    const ratio = calculateRatio(metrics.pitches, metrics.meetingsBooked);
    const content = `Campaign metrics for ${client.name}: ${metrics.pitches} pitches, ${metrics.meetingsBooked} meetings booked, ${metrics.voicemails} voicemails, ${metrics.followUps} follow-ups, ${metrics.meetingsPending} meetings pending. Pitch-to-meeting ratio: ${ratio}:1`;
    
    const memory = {
        type: 'campaign_metric',
        content,
        importance: 8,
        tags: [client.id, 'campaign_metric', `week_${week}`],
    };

    const saved = await saveMemoryWithEmbedding(memory);
    console.log(`Campaign metric saved for ${client.name} (id: ${saved.id})`);
    return { ratio, content };
}

/**
 * Send red flag alert if needed.
 */
async function sendRedFlagAlert(client, metrics) {
    if (metrics.pitches >= 25 && metrics.meetingsBooked === 0) {
        const message = `RED FLAG: ${client.name} -- ${metrics.pitches} pitches with 0 meetings booked. Immediate review required.`;
        console.log(`Sending red flag: ${message}`);
        await sendDM(message);
    }
}

/**
 * Main processing of a campaign log line.
 */
async function processCampaignLog(logLine) {
    try {
        const metrics = parseCampaignLog(logLine);
        const client = findClientByName(metrics.clientName);
        if (!client) {
            throw new Error(`Client "${metrics.clientName}" not found in registry`);
        }
        const week = getCurrentWeek();
        const { ratio, content } = await saveCampaignMetric(client, metrics, week);
        await sendRedFlagAlert(client, metrics);
        return {
            success: true,
            client: client.name,
            ratio,
            pitches: metrics.pitches,
            meetingsBooked: metrics.meetingsBooked,
            redFlag: metrics.pitches >= 25 && metrics.meetingsBooked === 0,
            summary: content,
        };
    } catch (err) {
        console.error('Error processing campaign log:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Command-line interface.
 */
async function main() {
    const logLine = process.argv.slice(2).join(' ');
    if (!logLine) {
        console.error('Usage: node tracker.js "Log campaign: ..."');
        process.exit(1);
    }
    const result = await processCampaignLog(logLine);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = { processCampaignLog, parseCampaignLog, findClientByName, calculateRatio };