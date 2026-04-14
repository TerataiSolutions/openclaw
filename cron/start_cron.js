#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const lockFile = path.join(__dirname, '.cron.lock');
const pid = process.pid;

// Validate PID – should not be container init (PID 1) or extremely low
if (pid === 1) {
    console.error('ERROR: process.pid is 1 (container init). Something is wrong with the process environment.');
    process.exit(1);
}

// Check if lock file exists and if the process is still alive; delete stale lock
function isCronRunning() {
    if (!fs.existsSync(lockFile)) return false;
    const content = fs.readFileSync(lockFile, 'utf8').trim();
    const oldPid = parseInt(content, 10);
    if (isNaN(oldPid)) {
        fs.unlinkSync(lockFile);
        return false;
    }
    try {
        process.kill(oldPid, 0); // signal 0 to check existence
        return true;
    } catch (err) {
        // Process does not exist – stale lock
        fs.unlinkSync(lockFile);
        return false;
    }
}

let shouldRestart = true;

if (isCronRunning()) {
    console.log('Cron manager already running. Exiting.');
    shouldRestart = false;
    process.exit(0);
}

// Write lock file
fs.writeFileSync(lockFile, pid.toString());
console.log(`Lock file written with PID ${pid}`);
console.log('Starting cron manager...');

// Clean up lock on exit and restart if needed
process.on('exit', () => {
    try { fs.unlinkSync(lockFile); } catch (e) {}
    if (shouldRestart) {
        // Spawn a detached child that will restart after a short delay
        const child = spawn(process.argv[0], process.argv.slice(1), {
            detached: true,
            stdio: 'ignore',
            env: process.env
        });
        child.unref();
        console.log('Cron manager restart scheduled.');
    }
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

// Start the cron manager
require('./index.js').startCronManager();