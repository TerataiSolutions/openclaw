#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const lockFile = path.join(__dirname, '.cron.lock');
const pid = process.pid;

// Check if lock file exists and if the process is still alive
function isCronRunning() {
    if (!fs.existsSync(lockFile)) return false;
    const content = fs.readFileSync(lockFile, 'utf8').trim();
    const oldPid = parseInt(content, 10);
    if (isNaN(oldPid)) return false;
    try {
        process.kill(oldPid, 0); // signal 0 to check existence
        return true;
    } catch (err) {
        // Process does not exist
        return false;
    }
}

if (isCronRunning()) {
    console.log('Cron manager already running. Exiting.');
    process.exit(0);
}

// Write lock file
fs.writeFileSync(lockFile, pid.toString());
console.log('Starting cron manager...');

// Clean up lock on exit
process.on('exit', () => {
    try { fs.unlinkSync(lockFile); } catch (e) {}
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

// Start the cron manager
require('./index.js');