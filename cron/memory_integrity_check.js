#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
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

async function fetchAllMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding,importance`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function isZeroVector(arr) {
    return Array.isArray(arr) && arr.slice(0, 10).every(v => Math.abs(v) < 1e-9);
}

function isTestPattern(content) {
    const lower = content.toLowerCase();
    return lower.includes('test') || lower.includes('example');
}

async function main() {
    const memories = await fetchAllMemories();
    const issues = [];

    memories.forEach(mem => {
        // NULL embedding
        if (mem.embedding === null) {
            issues.push(`NULL embedding: ${mem.id} - ${mem.content.substring(0, 80)}`);
        }
        // Zero‑vector embedding
        if (mem.embedding && typeof mem.embedding === 'string') {
            try {
                const vec = JSON.parse(mem.embedding);
                if (isZeroVector(vec)) {
                    issues.push(`Zero‑vector embedding: ${mem.id} - ${mem.content.substring(0, 80)}`);
                }
            } catch (e) {
                // ignore parse error
            }
        }
        // Importance = 1 and test pattern
        if (mem.importance === 1 && isTestPattern(mem.content)) {
            issues.push(`Test pattern with importance=1: ${mem.id} - ${mem.content.substring(0, 80)}`);
        }
    });

    if (issues.length > 0) {
        const alertText = `System alert: ${issues.length} memory integrity issue(s) found.\n${issues.slice(0, 5).join('\n')}`;
        console.error(alertText);
        const sent = await sendDM(alertText);
        if (!sent) console.error('Failed to send Discord alert');
        process.exit(1);
    } else {
        console.log('Memory integrity check passed. No issues found.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Error during memory integrity check:', err);
    process.exit(1);
});