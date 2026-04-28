/**
 * session-manager.js — Session lifecycle management for the OpenClaw gateway.
 *
 * Monitors session file sizes, prunes stale checkpoints, and prevents
 * unbounded disk growth from compaction artifacts.
 */

const fs = require('fs');
const path = require('path');

const SESSION_DIR = '/data/.openclaw/agents/main/sessions';
const MAX_SESSION_SIZE_MB = 50;
const MAX_CHECKPOINT_AGE_DAYS = 7;
const ARCHIVE_DIR = path.join(SESSION_DIR, 'archive');

/**
 * Check if a session has grown beyond the maximum allowed size.
 * @param {string} sessionId - UUID of the session (file name without .jsonl)
 * @returns {{ shouldArchive: boolean, sizeMB: number }}
 */
function shouldArchiveSession(sessionId) {
  const sessionPath = path.join(SESSION_DIR, `${sessionId}.jsonl`);
  const trajectoryPath = path.join(SESSION_DIR, `${sessionId}.trajectory.jsonl`);

  let totalBytes = 0;

  for (const fp of [sessionPath, trajectoryPath]) {
    try {
      totalBytes += fs.statSync(fp).size;
    } catch {
      // File not found — skip
    }
  }

  const sizeMB = totalBytes / (1024 * 1024);
  return { shouldArchive: sizeMB > MAX_SESSION_SIZE_MB, sizeMB };
}

/**
 * Get a formatted report of all session sizes.
 * @returns {object[]} Array of { sessionId, sizeMB, fileCount, isActive }
 */
function getSessionReport() {
  const files = fs.readdirSync(SESSION_DIR);
  const sessions = {};

  for (const file of files) {
    // Parse session ID and variant
    const match = file.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.\S+)?/
    );
    if (!match) continue;

    const sid = match[1];
    const variant = match[2] || '.jsonl';

    if (!sessions[sid]) sessions[sid] = { sizeBytes: 0, files: [] };

    try {
      const st = fs.statSync(path.join(SESSION_DIR, file));
      sessions[sid].sizeBytes += st.size;
      sessions[sid].files.push({ name: file, sizeKB: Math.round(st.size / 1024) });
    } catch {
      // skip file errors
    }
  }

  return Object.entries(sessions)
    .map(([sessionId, data]) => ({
      sessionId,
      sizeMB: +(data.sizeBytes / (1024 * 1024)).toFixed(1),
      fileCount: data.files.length,
      isActive: data.files.some(f => f.name === `${sessionId}.jsonl`),
      files: data.files,
    }))
    .sort((a, b) => b.sizeMB - a.sizeMB);
}

/**
 * Clean up checkpoint files for sessions that are no longer active.
 * Keeps checkpoints for the active session but prunes stale ones.
 * @param {number} [maxAgeDays=MAX_CHECKPOINT_AGE_DAYS]
 * @returns {{ removed: number, freedMB: number }}
 */
function cleanupOldCheckpoints(maxAgeDays = MAX_CHECKPOINT_AGE_DAYS) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(SESSION_DIR);
  let removed = 0;
  let freedBytes = 0;

  for (const file of files) {
    // Match checkpoint files: sessionId.checkpoint.uuid.jsonl
    if (!file.includes('.checkpoint.')) continue;

    const filePath = path.join(SESSION_DIR, file);
    try {
      const st = fs.statSync(filePath);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed++;
        freedBytes += st.size;
      }
    } catch {
      // skip errors
    }
  }

  const freedMB = +(freedBytes / (1024 * 1024)).toFixed(1);
  return { removed, freedMB };
}

/**
 * Archive old .reset files (compaction artifacts) that are no longer needed.
 * @param {number} [maxAgeDays=14]
 * @returns {{ removed: number, freedMB: number }}
 */
function cleanupResetFiles(maxAgeDays = 14) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(SESSION_DIR);
  let removed = 0;
  let freedBytes = 0;

  for (const file of files) {
    if (!file.includes('.jsonl.reset.')) continue;

    const filePath = path.join(SESSION_DIR, file);
    try {
      const st = fs.statSync(filePath);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed++;
        freedBytes += st.size;
      }
    } catch {
      // skip errors
    }
  }

  const freedMB = +(freedBytes / (1024 * 1024)).toFixed(1);
  return { removed, freedMB };
}

/**
 * Full session maintenance pass — reports sizes, prunes stale artifacts.
 * Designed to be called from a cron job or during system health checks.
 * @returns {object} Summary of actions taken
 */
function runMaintenance() {
  const report = getSessionReport();
  const checkpointCleanup = cleanupOldCheckpoints();
  const resetCleanup = cleanupResetFiles();
  const activeSession = report.find(s => s.isActive);
  const archiveCheck = activeSession
    ? shouldArchiveSession(activeSession.sessionId)
    : { shouldArchive: false, sizeMB: 0 };

  return {
    totalSessions: report.length,
    totalDiskMB: +report.reduce((acc, s) => acc + s.sizeMB, 0).toFixed(1),
    activeSession: activeSession
      ? { id: activeSession.sessionId, sizeMB: activeSession.sizeMB }
      : null,
    archiveNeeded: archiveCheck.shouldArchive
      ? { sessionId: activeSession?.sessionId, sizeMB: archiveCheck.sizeMB }
      : false,
    cleanup: checkpointCleanup.removed > 0 || resetCleanup.removed > 0
      ? { checkpointsRemoved: checkpointCleanup.removed, freedMB: checkpointCleanup.freedMB + resetCleanup.freedMB }
      : null,
    oversizedSessions: report.filter(s => s.sizeMB > MAX_SESSION_SIZE_MB),
  };
}

if (require.main === module) {
  const result = runMaintenance();
  console.log('=== Session Maintenance Report ===');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nDetailed session breakdown:`);
  const report = getSessionReport();
  for (const s of report) {
    const flag = s.isActive ? ' (active)' : '';
    const over = s.sizeMB > MAX_SESSION_SIZE_MB ? ' ⚠️ OVER LIMIT' : '';
    console.log(`  ${s.sessionId.slice(0, 8)}...  ${s.sizeMB} MB  ${s.fileCount} files${flag}${over}`);
  }
}

module.exports = {
  shouldArchiveSession,
  getSessionReport,
  cleanupOldCheckpoints,
  cleanupResetFiles,
  runMaintenance,
  MAX_SESSION_SIZE_MB,
};
