#!/usr/bin/env node

/**
 * Call Logger – parses "Log calls:" messages and saves call activity memories.
 * Trigger: "Log calls: [X] pitches, [X] meetings, [X] voicemails, [X] objections: [description]"
 * Parses numbers, calculates meeting‑to‑pitch ratio, flags red flags.
 * Saves memory with type call_activity, importance 6.
 * Replies in natural sentences with ratio, red flag status, and objection acknowledgment.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { generateEmbedding } = require('../lib/clients/cohere');

function log(msg) {
    const ts = new Date().toISOString();
    console.error(`[${ts}] ${msg}`);
}

function sendDiscordMessage(message) {
    // Use message_bridge.js to send reply
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    return execPromise(`node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`)
        .catch(err => {
            log(`Failed to send Discord message: ${err.message}`);
        });
}

async function saveMemoryWithEmbedding(content, type, importance, tags = [], client_id = null) {
    // Generate embedding
    let embedding = null;
    try {
        embedding = await generateEmbedding(content);
    } catch (e) {
        log(`Embedding generation failed: ${e.message}`);
        // Continue without embedding
    }

    // Save to Supabase
    const memoryData = {
        type,
        content,
        importance,
        tags,
        created_at: new Date().toISOString()
    };
    if (client_id) memoryData.client_id = client_id;
    if (embedding) memoryData.embedding = embedding;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(memoryData)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Supabase insert failed: ${res.status} ${text}`);
        }
        log(`Memory saved: ${type} (importance ${importance})`);
        return true;
    } catch (e) {
        log(`Memory save error: ${e.message}`);
        return false;
    }
}

function parseCallLog(input) {
    const pitchMatch = input.match(/(\d+)\s+pitches/);
    const meetingMatch = input.match(/(\d+)\s+meetings/);
    const voicemailMatch = input.match(/(\d+)\s+voicemails/);
    const objectionMatch = input.match(/objections:\s*(.*)/i);

    if (!pitchMatch || !meetingMatch || !voicemailMatch || !objectionMatch) {
        return { error: 'Could not parse all four fields. Expected format: "Log calls: [X] pitches, [X] meetings, [X] voicemails, [X] objections: [description]"' };
    }

    const pitches = parseInt(pitchMatch[1], 10);
    const meetings = parseInt(meetingMatch[1], 10);
    const voicemails = parseInt(voicemailMatch[1], 10);
    const objectionDesc = objectionMatch[1].trim();

    // Calculate ratio (pitches per meeting)
    let ratio = null;
    if (meetings > 0) {
        ratio = (pitches / meetings).toFixed(1);
    }

    // Red flag conditions
    const redFlag = meetings === 0 || (pitches / meetings) > 25;

    return {
        pitches,
        meetings,
        voicemails,
        objectionDesc,
        ratio,
        redFlag,
        error: null
    };
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        log('No input provided. Usage: node call_logger.js "Log calls: ..."');
        process.exit(1);
    }
    const input = args.join(' ');
    log(`Processing: ${input}`);

    const parsed = parseCallLog(input);
    if (parsed.error) {
        await sendDiscordMessage(`Format error: ${parsed.error}. Please use "Log calls: [X] pitches, [X] meetings, [X] voicemails, [X] objections: [description]"`);
        process.exit(1);
    }

    const { pitches, meetings, voicemails, objectionDesc, ratio, redFlag } = parsed;
    const date = new Date().toISOString().split('T')[0];

    // Build memory content
    const content = `Call activity ${date}: ${pitches} pitches, ${meetings} meetings, ${voicemails} voicemails. Meeting‑to‑pitch ratio: ${ratio !== null ? ratio : 'N/A'} (red flag: ${redFlag ? 'YES' : 'NO'}). Objection description: ${objectionDesc}`;

    // Save memory
    const saved = await saveMemoryWithEmbedding(
        content,
        'call_activity',
        6,
        ['call_activity', 'performance'],
        null // no client_id
    );

    // Build reply
    let reply = `Logged ${pitches} pitches, ${meetings} meetings, ${voicemails} voicemails. `;
    if (ratio !== null) {
        reply += `That’s a ${ratio} pitch‑to‑meeting ratio. `;
    } else {
        reply += `No meetings today. `;
    }
    if (redFlag) {
        reply += `🚨 Red flag: ${meetings === 0 ? 'Zero meetings' : 'Ratio exceeds 25:1'}. `;
    }
    reply += `Objection noted: ${objectionDesc}.`;

    // Send reply
    await sendDiscordMessage(reply);
    log('Call log processed and reply sent.');
}

if (require.main === module) {
    main().catch(err => {
        log(`Unhandled error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { parseCallLog };