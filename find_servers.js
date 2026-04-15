const fs = require('fs');
const path = require('path');

const procs = fs.readdirSync('/proc').filter(dir => /^\d+$/.test(dir));
let cron = null;
let webhook = null;
for (const pid of procs) {
    try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (cmdline.includes('start_cron.js')) {
            cron = { pid, cmdline: cmdline.replace(/\0/g, ' ') };
        }
        if (cmdline.includes('webhook/index.js')) {
            webhook = { pid, cmdline: cmdline.replace(/\0/g, ' ') };
        }
    } catch (e) {}
}
console.log('Cron manager:', cron ? `PID ${cron.pid}` : 'not found');
console.log('Webhook server:', webhook ? `PID ${webhook.pid}` : 'not found');