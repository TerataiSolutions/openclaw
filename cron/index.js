const cron = require('node-cron');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logJson } = require('../utils.js');
const webhookManager = require('../lib/webhook-manager');

const options = { timezone: 'America/New_York' };

function runScript(script) {
    const scriptPath = path.join(__dirname, script);
    console.log(`[Cron] Running ${script}`);
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Cron] Error in ${script}:`, error.message);
            return;
        }
        if (stderr) console.error(`[Cron] ${script} stderr:`, stderr);
        if (stdout) console.log(`[Cron] ${script} stdout:`, stdout);
    });
}

function runAofScript(script) {
    const scriptPath = path.join('/data/workspace/aof', script);
    console.log(`[Cron] Running AOF script ${script}`);
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Cron] Error in AOF ${script}:`, error.message);
            return;
        }
        if (stderr) console.error(`[Cron] AOF ${script} stderr:`, stderr);
        if (stdout) console.log(`[Cron] AOF ${script} stdout:`, stdout);
    });
}

function startCronManager() {
    // Write boot timestamp for rollback manager (if not already written)
    const bootTimestampPath = '/data/.openclaw/aof/boot_timestamp.json';
    if (!fs.existsSync(bootTimestampPath)) {
        fs.mkdirSync(path.dirname(bootTimestampPath), { recursive: true });
        fs.writeFileSync(bootTimestampPath, JSON.stringify({ bootTime: Date.now() }));
        console.log(`[Cron] Boot timestamp written to ${bootTimestampPath}`);
    }
    // Daily Summary — 8:10 AM Eastern (pattern push before morning briefing)
    cron.schedule('10 8 * * *', () => runScript('../scripts/daily_summary.js'), options);

    // Morning Briefing + Stale Task Alert — 8:15 AM Eastern Mon-Fri, 12:00 PM Eastern Sat-Sun
    cron.schedule('15 8 * * 1-5', () => {
        runScript('morning_briefing.js');
        runScript('stale_task_alert.js');
    }, options);
    cron.schedule('0 12 * * 0,6', () => {
        runScript('morning_briefing.js');
        runScript('stale_task_alert.js');
    }, options);

    // Mood Check-In — 2 PM Eastern daily
    cron.schedule('0 14 * * *', () => runScript('mood_checkin.js'), options);

    // Follow‑Up Nudge — 12 PM Eastern daily
    cron.schedule('0 12 * * *', () => runScript('follow_up_nudge.js'), options);

    // End of Day Wrap — 9 PM Eastern daily
    cron.schedule('0 21 * * *', () => runScript('end_of_day_wrap.js'), options);

    // Memory Synthesis — 11 PM daily (23:00 UTC / 7 PM ET)
    cron.schedule('0 23 * * *', () => runScript('memory_synthesis.js'), options);

    // Weekly Win Capture — Friday 4:30 PM Eastern
    cron.schedule('30 16 * * 5', () => runScript('weekly_win_capture.js'), options);

    // Client Pulse — Monday 9 AM Eastern
    cron.schedule('0 9 * * 1', () => runScript('client_pulse.js'), options);

    // Session Maintenance — daily 1:30 AM Eastern (clean old checkpoints before backup)
    cron.schedule('30 1 * * *', () => {
      const { runMaintenance } = require('../lib/session-manager');
      const result = runMaintenance();
      if (result.cleanup) {
        logJson('info', { event: 'session_cleanup', removed: result.cleanup.checkpointsRemoved, freedMB: result.cleanup.freedMB });
      }
      if (result.archiveNeeded) {
        logJson('warn', { event: 'session_oversized', sessionId: result.archiveNeeded.sessionId, sizeMB: result.archiveNeeded.sizeMB });
        const { sendDiscordAlert } = require('../lib/clients/discord');
        sendDiscordAlert(`⚠️ Session ${result.archiveNeeded.sessionId.slice(0,8)} is ${Math.round(result.archiveNeeded.sizeMB)} MB — needs archiving`);
      }
    }, options);

    // Memory Backup — daily 2 AM Eastern
    cron.schedule('0 2 * * *', () => runScript('memory_backup.js'), options);

    // Auto-Recovery Check — daily 3 AM Eastern (runs if validation shows issues)
    cron.schedule('0 3 * * *', () => runScript('auto_recover.js'), options);

    // Memory Integrity Check — daily 8 AM Eastern
    cron.schedule('0 8 * * *', () => runScript('memory_integrity_check.js'), options);

    // Semantic Search Self-Test — daily 9 AM Eastern
    cron.schedule('0 9 * * *', () => runScript('semantic_search_selftest.js'), options);

    // Bootstrap Size Check — daily 9:20 AM Eastern (staggered from semantic_search_selftest)
    cron.schedule('20 9 * * *', () => runScript('../scripts/bootstrap_size_check.js'), options);

    // Weekly Memory Report — Sunday 6 PM Eastern
    cron.schedule('0 18 * * 0', () => runScript('weekly_memory_report.js'), options);
    // Pattern Detection — Sunday 6:10 PM Eastern (staggered from weekly_memory_report)
    cron.schedule('10 18 * * 0', () => runScript('pattern_detection.js'), options);
    // Memory Cleanup — Sunday 6:20 PM Eastern (purge low-importance memories >30 days)
    cron.schedule('20 18 * * 0', () => runScript('../scripts/cleanup_low_importance.js'), options);

    // Weekly PDF report — Friday 5 PM Eastern
    cron.schedule('0 17 * * 5', () => runScript('../reports/weekly_report.js'), options);
    // AOF Audit Reporter — Friday 5:10 PM Eastern (staggered from weekly_report)
    cron.schedule('10 17 * * 5', () => runAofScript('audit_reporter.js'), options);

    // Weekly performance goal reminder — Monday 8 AM Eastern
    cron.schedule('0 8 * * 1', () => runScript('goal_reminder.js'), options);

    // Daily activity prompt — 3 PM Eastern
    cron.schedule('0 15 * * *', () => runScript('daily_activity_prompt.js'), options);

    // Credential rotation reminder — Monday 9:15 AM Eastern (staggered from client_pulse)
    cron.schedule('15 9 * * 1', () => runScript('../security/credential_rotation_reminder.js'), options);

    function runJob(job, scriptPath) {
        logJson('info', { event: 'cron_trigger', job });
        const child = spawn('node', [scriptPath], { stdio: 'inherit', detached: false });
        child.on('error', (err) => {
            logJson('error', { event: 'cron_alert', job, error: err.message });
            try {
                const { sendDiscordAlert } = require('../lib/clients/discord');
                sendDiscordAlert(`⚠️ Cron job \`${job}\` failed: ${err.message}`).catch(() => {});
            } catch (_) {}
        });
        child.on('exit', (code) => {
            if (code !== null && code !== 0) {
                logJson('warn', { event: 'cron_nonzero_exit', job, exitCode: code });
                try {
                    const { sendDiscordAlert } = require('../lib/clients/discord');
                    sendDiscordAlert(`⚠️ Cron job \`${job}\` exited with code ${code}`).catch(() => {});
                } catch (_) {}
            }
        });
        child.unref();
    }

    // Market Pulse — daily 7:00 AM Eastern
    cron.schedule('0 7 * * *', () => {
        runJob('market_pulse', '/data/.openclaw/workspace/scripts/market_pulse.js');
    }, { timezone: 'America/New_York' });

    // Memory Consolidator — Sunday 5:00 PM Eastern
    cron.schedule('0 17 * * 0', () => {
        runJob('memory_consolidator', '/data/.openclaw/workspace/scripts/memory_consolidator.js');
    }, { timezone: 'America/New_York' });

    // Monday Morning Strategic Briefing — Monday 8:05 AM Eastern
    cron.schedule('5 8 * * 1', () => {
        runJob('monday_briefing', '/data/.openclaw/workspace/scripts/monday_briefing.js');
    }, { timezone: 'America/New_York' });

    // Weekly Context Snapshot — Sunday 6:05 PM Eastern
    cron.schedule('5 18 * * 0', () => {
        runJob('weekly_context_snapshot', '/data/.openclaw/workspace/scripts/weekly_context_snapshot.js');
    }, { timezone: 'America/New_York' });

    // Security monitor — every 6 hours
    cron.schedule('0 */6 * * *', () => runScript('../security/monitor.js'), options);

    // Dependency health check (Supabase, Cohere, DeepSeek) — every 5 minutes
    cron.schedule('*/5 * * * *', () => runScript('dependency_healthcheck.js'), options);

    // Message queue flush — every 30 seconds (persistent interval)
    setInterval(() => {
        require('./message_queue.js').flush().catch(e =>
            console.error('[queue_flush] Error:', e.message)
        );
    }, 30000);

    // Silence watchdog — every 5 minutes
    cron.schedule('*/5 * * * *', () => runScript('silence_watchdog.js'), options);

    // System metrics — hourly at :00
    cron.schedule('0 * * * *', () => runScript('../scripts/track_metrics.js'), options);

    // AOF CVE Monitor — daily 6 AM Eastern
    cron.schedule('0 6 * * *', () => runAofScript('cve_monitor.js'), options);

    // Rollback Manager check — every 2 minutes for first 10 minutes after boot
    cron.schedule('*/2 * * * *', () => runAofScript('rollback_manager.js'), options);

    console.log('Cron manager started (America/New_York timezone). Schedules active.');

    // Start Fathom webhook server with auto-restart
    webhookManager.startWebhookServer();
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down cron manager...');
    webhookManager.stopWebhookServer();
    process.exit(0);
});

// Export for programmatic use
module.exports = { startCronManager };

// If this file is run directly (node index.js), start the cron manager
if (require.main === module) {
    startCronManager();
}