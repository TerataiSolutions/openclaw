#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const LOCK_FILE = path.join(__dirname, '.cron.lock');

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    // Check if process is a zombie (state Z)
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const state = stat.split(' ')[2]; // third field is process state
      if (state === 'Z') {
        return false; // zombie is not running
      }
    } catch (e) {
      // /proc not available, fallback to signal check
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Check if already running
if (fs.existsSync(LOCK_FILE)) {
  const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim());
  if (existingPid && isRunning(existingPid)) {
    console.log(`Cron manager already running (PID ${existingPid}). Exiting.`);
    process.exit(0);
  } else {
    console.log(`Stale lock file found (PID ${existingPid}). Removing.`);
    fs.unlinkSync(LOCK_FILE);
  }
}

// Write our PID
if (process.pid <= 2) {
  console.error('Invalid PID detected. Exiting.');
  process.exit(1);
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
console.log(`Lock file written with PID ${process.pid}`);

// Start the cron manager
const { startCronManager } = require('./index.js');
startCronManager();
console.log('Cron manager started (America/New_York timezone). Schedules active.');

// NO restart loop -- the Railway start command handles restarts on crash
// A restart loop here causes duplicate processes