'use strict';

const fs = require('fs');
const path = require('path');
let _logJson;
function getLogJson() {
  if (!_logJson) _logJson = require('../utils.js').logJson;
  return _logJson;
}

const STATUS_FILE = path.join(__dirname, 'capability_status.json');

const CAPABILITIES = {
  memoryRead: { label: 'Memory Read', dependencies: ['supabase'] },
  memoryWrite: { label: 'Memory Write', dependencies: ['supabase', 'cohere'] },
  semanticSearch: { label: 'Semantic Search', dependencies: ['supabase', 'cohere'] },
  deepseekReasoner: { label: 'DeepSeek Reasoner', dependencies: ['deepseek'] },
  discordMessaging: { label: 'Discord Messaging', dependencies: ['discord'] },
};

function ensureFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    const initial = Object.fromEntries(
      Object.entries(CAPABILITIES).map(([key, cfg]) => [
        key,
        { available: true, reason: 'Initial state', lastChanged: new Date().toISOString() },
      ])
    );
    fs.writeFileSync(STATUS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function setCapabilityStatus(cap, available, reason) {
  ensureFile();
  const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  const changed = current[cap]?.available !== available;

  current[cap] = { available, reason, lastChanged: new Date().toISOString() };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(current, null, 2), 'utf8');

  if (changed) {
    getLogJson()('warn', { event: 'capability_change', cap, available, reason, previousState: changed ? current[cap]?.available : 'unchanged' });

    if (!available) {
      // Send Discord alert
      try {
        const { sendMessage } = require('./message_bridge.js');
        sendMessage(`⚠️ **Capability Degraded**: ${CAPABILITIES[cap]?.label || cap}\nReason: ${reason}\n_Downgraded services will be restored automatically when the dependency recovers._`).catch(() => {});
      } catch (_) {}
    } else {
      // Send Discord recovery notice
      try {
        const { sendMessage } = require('./message_bridge.js');
        sendMessage(`✅ **Capability Restored**: ${CAPABILITIES[cap]?.label || cap}\n${reason}`).catch(() => {});
      } catch (_) {}
    }
  }
}

function getCapabilityStatus() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

/**
 * Apply dependency health results to capability status.
 * Call from dependency_healthcheck after checking each service.
 */
function applyDependencyResults(dependencyResults) {
  const capStatus = getCapabilityStatus();

  for (const [cap, cfg] of Object.entries(CAPABILITIES)) {
    const relevantFailures = cfg.dependencies.filter(dep => {
      const result = dependencyResults[dep];
      return result && result.status !== 'OK' && result.status !== 'SKIPPED';
    });

    if (relevantFailures.length > 0) {
      const reasons = relevantFailures.map(dep => `${dep}: ${dependencyResults[dep].status}${dependencyResults[dep].error ? ' — ' + dependencyResults[dep].error : ''}`);
      setCapabilityStatus(cap, false, reasons.join('; '));
    } else if (capStatus[cap] && !capStatus[cap].available) {
      // Previously degraded, now healthy — restore
      setCapabilityStatus(cap, true, 'All dependencies healthy');
    }
  }
}

module.exports = { setCapabilityStatus, getCapabilityStatus, CAPABILITIES, applyDependencyResults };
