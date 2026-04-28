#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LOCK_FILE = path.join(__dirname, '.cron.lock');
const WEBHOOK_LOCK_FILE = path.join(__dirname, '.webhook.lock');

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

function startWebhookListener() {
  // Check if webhook listener already running
  if (fs.existsSync(WEBHOOK_LOCK_FILE)) {
    const existingPid = parseInt(fs.readFileSync(WEBHOOK_LOCK_FILE, 'utf8').trim());
    if (existingPid && isRunning(existingPid)) {
      console.log(`Webhook listener already running (PID ${existingPid}).`);
      return;
    } else {
      console.log(`Stale webhook lock file found (PID ${existingPid}). Removing.`);
      fs.unlinkSync(WEBHOOK_LOCK_FILE);
    }
  }
  // Start webhook listener
  try {
    const webhookPath = '/data/workspace/aof/webhook_listener.js';
    const child = spawn('node', [webhookPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    fs.writeFileSync(WEBHOOK_LOCK_FILE, String(child.pid));
    console.log(`Webhook listener started (PID ${child.pid}). Lock file written.`);
  } catch (err) {
    console.error('Failed to start webhook listener:', err.message);
  }
}

// Check if cron manager already running
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

// Start AOF webhook listener
startWebhookListener();

// Start the cron manager (self-executing — require() alone starts it)
require('./index.js');
console.log('Cron manager started (UTC timezone). Schedules active.');

// NO restart loop -- the Railway start command handles restarts on crash
// A restart loop here causes duplicate processes

// Keep the event loop alive
setInterval(() => {
    // No‑op, just keep alive
}, 24 * 60 * 60 * 1000);