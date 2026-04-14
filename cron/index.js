const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

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

// Morning Briefing + Stale Task Alert — 8:15 AM Eastern daily
cron.schedule('15 8 * * *', () => {
    runScript('morning_briefing.js');
    runScript('stale_task_alert.js');
}, options);

// Mood Check-In — 2 PM Eastern daily
cron.schedule('0 14 * * *', () => runScript('mood_checkin.js'), options);

// Follow‑Up Nudge — 12 PM Eastern daily
cron.schedule('0 12 * * *', () => runScript('follow_up_nudge.js'), options);

// End of Day Wrap — 9 PM Eastern daily
cron.schedule('0 21 * * *', () => runScript('end_of_day_wrap.js'), options);

// Weekly Win Capture — Friday 4:30 PM Eastern
cron.schedule('30 16 * * 5', () => runScript('weekly_win_capture.js'), options);

// Client Pulse — Monday 9 AM Eastern
cron.schedule('0 9 * * 1', () => runScript('client_pulse.js'), options);

// Memory Backup — daily 2 AM Eastern
cron.schedule('0 2 * * *', () => runScript('memory_backup.js'), options);

// Auto-Recovery Check — daily 3 AM Eastern (runs if validation shows issues)
cron.schedule('0 3 * * *', () => runScript('auto_recover.js'), options);

// Memory Integrity Check — daily 8 AM Eastern
cron.schedule('0 8 * * *', () => runScript('memory_integrity_check.js'), options);

// Semantic Search Self-Test — daily 9 AM Eastern
cron.schedule('0 9 * * *', () => runScript('semantic_search_selftest.js'), options);

// Weekly Memory Report — Sunday 6 PM Eastern
cron.schedule('0 18 * * 0', () => runScript('weekly_memory_report.js'), options);
// Pattern Detection — Sunday 6 PM Eastern
cron.schedule('0 18 * * 0', () => runScript('pattern_detection.js'), options);

// Weekly PDF report — Friday 5 PM Eastern
cron.schedule('0 17 * * 5', () => runScript('../reports/weekly_report.js'), options);

// Weekly performance goal reminder — Monday 8 AM Eastern
cron.schedule('0 8 * * 1', () => runScript('goal_reminder.js'), options);

// Daily activity prompt — 3 PM Eastern
cron.schedule('0 15 * * *', () => runScript('daily_activity_prompt.js'), options);

console.log('Cron manager started (America/New_York timezone). Schedules active.');