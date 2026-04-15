const fs = require('fs');
const path = require('path');

const procs = fs.readdirSync('/proc').filter(dir => /^\d+$/.test(dir));
let found = false;
for (const pid of procs) {
    try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (cmdline.includes('start_cron.js')) {
            console.log(`Found cron manager: PID ${pid}, cmdline: ${cmdline.replace(/\0/g, ' ')}`);
            found = true;
        }
    } catch (e) {
        // ignore
    }
}
if (!found) {
    console.log('No cron manager process found.');
}