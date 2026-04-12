#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { sendMessage } = require('../discord.js');

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
    console.log('Running semantic search self‑test...');
    const testResult = await runSelfTest();
    
    if (!testResult.success) {
        const alertText = `Search self-test failed. ${testResult.message}\nLast successful test: ${new Date().toISOString()}\nRecommend: Manual RPC verification in Supabase.`;
        console.error(alertText);
        const sent = await sendMessage(alertText);
        if (!sent) console.error('Failed to send Discord alert');
        process.exit(1);
    } else {
        console.log(`Self‑test passed: ${testResult.count} result(s) above threshold, top similarity ${testResult.topSimilarity}`);
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Error during self‑test:', err);
    process.exit(1);
});