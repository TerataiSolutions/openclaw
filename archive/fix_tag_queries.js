#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspace = '/data/.openclaw/workspace';
const files = [
    'clients/intelligence.js',
    'campaigns/summary.js',
    'delete_week16.js',
    'test_morning_insight.js',
    'reports/weekly_report.js',
    'cron/pattern_detection.js',
    'cron/client_pulse.js',
    'cron/follow_up_nudge.js',
    'cron/morning_briefing.js',
    'check_latest_protocols.js'
];

files.forEach(relPath => {
    const fullPath = path.join(workspace, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skipping ${relPath} (not found)`);
        return;
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    // Replace tags=cs.{tag} with tags=cs.\{tag}
    const fixed = content.replace(/tags=cs\.\{/g, 'tags=cs.\\{');
    if (fixed !== content) {
        fs.writeFileSync(fullPath, fixed);
        console.log(`Fixed ${relPath}`);
    } else {
        console.log(`No change needed for ${relPath}`);
    }
});

console.log('Done.');