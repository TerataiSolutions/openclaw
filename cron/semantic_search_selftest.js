#!/usr/bin/env node

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

async function runSelfTest() {
    try {
        // Call semantic_search_enhanced.js with fixed query
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/semantic_search_enhanced.js "user wants assistant to be proactive" 10 0.25`
        );
        if (stderr) console.error('Self‑test stderr:', stderr);
        
        const results = JSON.parse(stdout);
        if (!Array.isArray(results)) {
            throw new Error('Invalid response format');
        }
        
        const aboveThreshold = results.filter(r => r.similarity >= 0.25);
        if (aboveThreshold.length === 0) {
            return {
                success: false,
                message: 'Zero results returned at threshold 0.25.',
                results: results
            };
        }
        return {
            success: true,
            count: aboveThreshold.length,
            topSimilarity: aboveThreshold[0].similarity
        };
    } catch (err) {
        return {
            success: false,
            message: `Self‑test execution failed: ${err.message}`,
            error: err
        };
    }
}

async function main() {
    logJson('info', { message: 'Running semantic search self‑test' });
    const testResult = await runSelfTest();
    
    if (!testResult.success) {
        const alertText = `Search self-test failed. ${testResult.message}\nLast successful test: ${new Date().toISOString()}\nRecommend: Manual RPC verification in Supabase.`;
        logJson('error', { message: 'Semantic search self‑test failed', alertText });
        const sent = await sendDM(alertText);
        if (!sent) logJson('error', { message: 'Failed to send Discord alert' });
        process.exit(1);
    } else {
        logJson('info', { message: 'Semantic search self‑test passed', count: testResult.count, topSimilarity: testResult.topSimilarity });
        process.exit(0);
    }
}

main().catch(err => {
    logJson('error', { message: 'Error during self‑test', error: err.message });
    process.exit(1);
});