#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { saveMemoryWithEmbedding } = require('../utils.js');

/**
 * Send message via bridge.
 */
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
 * Parse personal activity log.
 * Format: 'Log my activity: [X] pitches, [X] meetings booked, [X] voicemails, [X] follow-ups, [X] meetings pending, [optional notes]'
 */
function parsePersonalLog(line) {
    const match = line.match(/Log my activity:\s*(\d+)\s*pitches,\s*(\d+)\s*meetings booked,\s*(\d+)\s*voicemails,\s*(\d+)\s*follow-ups,\s*(\d+)\s*meetings pending(?:\s*,?\s*(.*))?/i);
    if (!match) {
        throw new Error('Invalid personal log format. Expected: "Log my activity: [X] pitches, [X] meetings booked, [X] voicemails, [X] follow-ups, [X] meetings pending, [optional notes]"');
    }
    const [, pitches, meetingsBooked, voicemails, followUps, meetingsPending, notes] = match;
    return {
        pitches: parseInt(pitches),
        meetingsBooked: parseInt(meetingsBooked),
        voicemails: parseInt(voicemails),
        followUps: parseInt(followUps),
        meetingsPending: parseInt(meetingsPending),
        notes: notes ? notes.trim() : '',
    };
}

/**
 * Get current ISO week number.
 */
function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
}

/**
 * Calculate pitch-to-meeting ratio.
 */
function calculateRatio(pitches, meetingsBooked) {
    if (meetingsBooked === 0) return Infinity;
    return (pitches / meetingsBooked).toFixed(2);
}

/**
 * Save personal performance as memory.
 */
async function savePersonalPerformance(metrics, week) {
    const ratio = calculateRatio(metrics.pitches, metrics.meetingsBooked);
    const content = `Personal performance: ${metrics.pitches} pitches, ${metrics.meetingsBooked} meetings booked, ${metrics.voicemails} voicemails, ${metrics.followUps} follow-ups, ${metrics.meetingsPending} meetings pending. Ratio: ${ratio}:1${metrics.notes ? ' Notes: ' + metrics.notes : ''}`;
    
    const memory = {
        type: 'personal_performance',
        content,
        importance: 9,
        tags: ['personal_performance', `week_${week}`],
    };

    const saved = await saveMemoryWithEmbedding(memory);
    console.log(`Personal performance saved for week ${week} (id: ${saved.id})`);
    return { ratio, content };
}

/**
 * Fetch streak: consecutive weeks hitting benchmark (pitches >= 25, meetingsBooked >= 1).
 */
async function getStreak() {
    // Fetch all personal_performance memories ordered by week
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.personal_performance&select=content,tags&order=created_at.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        console.error('Failed to fetch performance memories for streak:', response.statusText);
        return 0;
    }
    const memories = await response.json();
    let streak = 0;
    for (const mem of memories) {
        const parsed = parsePersonalLog(mem.content);
        if (parsed.pitches >= 25 && parsed.meetingsBooked >= 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

/**
 * Send reinforcement or coaching nudge.
 */
async function sendFeedback(metrics, ratio, streak) {
    const benchmarkHit = metrics.pitches >= 25 && metrics.meetingsBooked >= 1;
    const redZone = metrics.pitches >= 25 && metrics.meetingsBooked === 0;
    
    if (benchmarkHit) {
        const message = `✅ Benchmark hit! ${metrics.pitches} pitches → ${metrics.meetingsBooked} meetings (ratio ${ratio}:1). Current streak: ${streak} week(s). Keep it up!`;
        await sendDM(message);
    } else if (redZone) {
        const message = `⚠️ Coaching nudge: ${metrics.pitches} pitches with 0 meetings booked (ratio >25:1). Review pitch approach, messaging, or targeting.`;
        await sendDM(message);
    }
    // Otherwise silent (normal performance below benchmark).
}

/**
 * Main processing.
 */
async function processPersonalLog(logLine) {
    try {
        const metrics = parsePersonalLog(logLine);
        const week = getCurrentWeek();
        const { ratio, content } = await savePersonalPerformance(metrics, week);
        const streak = await getStreak();
        await sendFeedback(metrics, ratio, streak);
        return {
            success: true,
            pitches: metrics.pitches,
            meetingsBooked: metrics.meetingsBooked,
            ratio,
            streak,
            benchmarkHit: metrics.pitches >= 25 && metrics.meetingsBooked >= 1,
            redZone: metrics.pitches >= 25 && metrics.meetingsBooked === 0,
            summary: content,
        };
    } catch (err) {
        console.error('Error processing personal log:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Command-line interface.
 */
async function main() {
    const logLine = process.argv.slice(2).join(' ');
    if (!logLine) {
        console.error('Usage: node tracker.js "Log my activity: ..."');
        process.exit(1);
    }
    const result = await processPersonalLog(logLine);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = { processPersonalLog, parsePersonalLog, getStreak };