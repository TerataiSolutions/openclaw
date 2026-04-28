const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const WEBHOOK_SERVER = path.join(__dirname, '../scripts/fathom_webhook.js');
const WEBHOOK_LOG = path.join(__dirname, '../logs/webhook_server.log');
const PID_FILE = path.join(__dirname, '../.webhook_server.pid');

let webhookProcess = null;
let isRestarting = false;

function startWebhookServer() {
  if (webhookProcess) {
    console.log('Webhook server already running (PID ' + webhookProcess.pid + ')');
    return;
  }

  console.log('Starting webhook server...');
  webhookProcess = spawn('node', [WEBHOOK_SERVER], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Redirect stdout/stderr to log file
  const logStream = fs.createWriteStream(WEBHOOK_LOG, { flags: 'a' });
  webhookProcess.stdout.pipe(logStream);
  webhookProcess.stderr.pipe(logStream);

  // Write PID to file
  fs.writeFileSync(PID_FILE, webhookProcess.pid.toString());

  console.log('✅ Webhook server started (PID ' + webhookProcess.pid + ')');

  // Monitor for crashes
  webhookProcess.on('exit', (code, signal) => {
    console.error(
      '⚠️ Webhook server exited (code: ' + code + ', signal: ' + signal + ')'
    );
    fs.writeFileSync(
      WEBHOOK_LOG,
      '[' + new Date().toISOString() + '] Process exited with code ' + code + '\n',
      { flag: 'a' }
    );

    webhookProcess = null;

    // Auto-restart with exponential backoff
    if (!isRestarting) {
      isRestarting = true;
      setTimeout(() => {
        isRestarting = false;
        startWebhookServer();
      }, 5000); // Wait 5s before restart
    }
  });

  webhookProcess.on('error', (err) => {
    console.error('❌ Webhook server error:', err.message);
    fs.writeFileSync(
      WEBHOOK_LOG,
      '[' + new Date().toISOString() + '] Error: ' + err.message + '\n',
      { flag: 'a' }
    );
  });
}

function stopWebhookServer() {
  if (webhookProcess) {
    console.log('Stopping webhook server (PID ' + webhookProcess.pid + ')...');
    webhookProcess.kill('SIGTERM');
    webhookProcess = null;
  }
}

function isWebhookRunning() {
  return webhookProcess !== null && !webhookProcess.killed;
}

function getWebhookPID() {
  if (fs.existsSync(PID_FILE)) {
    return parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
  }
  return null;
}

module.exports = { startWebhookServer, stopWebhookServer, isWebhookRunning, getWebhookPID };
