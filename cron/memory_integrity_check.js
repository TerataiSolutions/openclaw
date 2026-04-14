#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { logJson } = require('../utils');

async function sendDM(message) {
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) logJson('error', { message: 'Bridge stderr', stderr });
        return true;
    } catch (err) {
        logJson('error', { message: 'Failed to send via bridge', error: err.message });
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
        // NULL embedding (only flag for importance >= 7)
        if (mem.embedding === null && mem.importance >= 7) {
            issues.push(`NULL embedding (importance ${mem.importance}): ${mem.id} - ${mem.content.substring(0, 80)}`);
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
        logJson('error', { message: 'Memory integrity issues', alertText });
        const sent = await sendDM(alertText);
        if (!sent) logJson('error', { message: 'Failed to send Discord alert' });
        process.exit(1);
    } else {
        logJson('info', { message: 'Memory integrity check passed', issueCount: 0 });
        process.exit(0);
    }
}

main().catch(err => {
    logJson('error', { message: 'Error during memory integrity check', error: err.message });
    process.exit(1);
});