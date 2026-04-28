#!/usr/bin/env node

// Temporarily set invalid Supabase URL to force retry and error logging
process.env.SUPABASE_URL = 'http://invalid';
process.env.SUPABASE_ANON_KEY = 'fake-key';

const { retrySupabaseCall } = require('./utils.js');
const fs = require('fs');
const path = require('path');

async function main() {
    const logPath = path.join(__dirname, 'logs', 'errors.log');
    // Clear previous test entries
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(l => !l.includes('Supabase call failed after retries'));
        fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
    }

    console.log('Testing retrySupabaseCall with invalid URL...');
    console.log('Expecting retry after 2 seconds, then error logged to', logPath);

    const start = Date.now();
    const result = await retrySupabaseCall(async () => {
        const response = await fetch('http://invalid/rest/v1/memories', {
            method: 'GET',
            headers: { 'apikey': 'fake' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    });

    const elapsed = Date.now() - start;
    console.log(`Result: ${result}`);
    console.log(`Elapsed time: ${elapsed}ms (should be > 2000ms due to retry delay)`);

    // Read log file
    if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf8');
        const recent = logs.split('\n').filter(l => l.includes('Supabase call failed after retries')).slice(-1);
        console.log('Recent log entry:', recent[0] || '(none)');
    } else {
        console.log('Log file not created.');
    }
}

main().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});