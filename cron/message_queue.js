'use strict';

const fs = require('fs');
const path = require('path');
const { logJson } = require('../utils.js');

const QUEUE_FILE = '/data/.openclaw/workspace/message_queue.jsonl';
const LOCK_FILE = QUEUE_FILE + '.lock';
const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_INTERVAL = 50;
const MAX_RETRIES = 3;

function acquireLock() {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      fs.writeFileSync(LOCK_FILE, Date.now().toString(), { flag: 'wx' });
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Check for stale lock
      try {
        const lockedAt = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
        if (Date.now() - lockedAt > LOCK_TIMEOUT_MS) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch (_) { /* lock file vanished or unreadable — retry */ }
    }
    // Busy-wait before retry (sync ops, so setTimeout won't help)
    for (let i = 0; i < 100000; i++) Math.sqrt(i);
  }
  throw new Error('Failed to acquire queue lock within ' + LOCK_TIMEOUT_MS + 'ms');
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

function enqueue(channelId, content, destination = 'discord') {
  const msg = {
    id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
    channelId,
    content,
    destination,
    createdAt: new Date().toISOString(),
    retries: 0,
    lastError: null,
  };
  acquireLock();
  try {
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(msg) + '\n', 'utf8');
  } finally {
    releaseLock();
  }
  logJson('info', { event: 'message_queued', id: msg.id, destination, queueFile: QUEUE_FILE });
  return msg.id;
}

async function flush() {
  acquireLock();
  try {
    if (!fs.existsSync(QUEUE_FILE)) return { flushed: 0, failed: 0, remaining: 0 };

    const data = fs.readFileSync(QUEUE_FILE, 'utf8').trim();
    if (!data) {
      try { fs.unlinkSync(QUEUE_FILE); } catch (_) {}
      return { flushed: 0, failed: 0, remaining: 0 };
    }

    const lines = data.split('\n').filter(Boolean);
    const retry = [];
    let flushed = 0;

    const { sendMessage } = require('./message_bridge.js');

    for (const line of lines) {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        logJson('error', { event: 'queue_parse_error', line: line.slice(0, 100), error: e.message });
        continue;
      }

      try {
        await sendMessage(msg.content);
        flushed++;
      } catch (e) {
        msg.retries++;
        msg.lastError = e.message;
        if (msg.retries < MAX_RETRIES) {
          retry.push(msg);
        } else {
          logJson('error', {
            event: 'message_dropped',
            id: msg.id,
            retries: msg.retries,
            lastError: e.message,
            content: msg.content.slice(0, 200),
          });
        }
      }
    }

    // Rewrite file with remaining retries
    if (retry.length > 0) {
      fs.writeFileSync(QUEUE_FILE, retry.map(m => JSON.stringify(m)).join('\n') + '\n', 'utf8');
    } else {
      try { fs.unlinkSync(QUEUE_FILE); } catch (_) {}
    }

    logJson('info', { event: 'queue_flush', flushed, retrying: retry.length, dropped: lines.length - flushed - retry.length });

    return { flushed, failed: retry.length, remaining: retry.length };
  } finally {
    releaseLock();
  }
}

// Get pending count without flushing
function pending() {
  acquireLock();
  try {
    if (!fs.existsSync(QUEUE_FILE)) return 0;
    const data = fs.readFileSync(QUEUE_FILE, 'utf8').trim();
    if (!data) { try { fs.unlinkSync(QUEUE_FILE); } catch (_) {} return 0; }
    return data.split('\n').filter(Boolean).length;
  } finally {
    releaseLock();
  }
}

module.exports = { enqueue, enqueueMessage: enqueue, flush, flushQueue: flush, pending };
