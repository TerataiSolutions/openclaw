#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { logJson } = require('../utils');

async function sendDM(message) {
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) logJson('error', { message: 'Bridge stderr', stderr });
        return true;
    } catch (err) {
        logJson('error', { message: 'Failed to send via bridge', error: err.message });
        return false;
    }
}

async function runCommand(cmd) {
    try {
        const { stdout, stderr } = await execPromise(cmd);
        return { success: true, stdout, stderr };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function main() {
    logJson('info', { message: 'Starting automated memory recovery' });
    
    // First, validate the latest backup
    logJson('info', { message: 'Validating latest backup' });
    const validateResult = await runCommand('node /data/.openclaw/workspace/scripts/validate_backup.js --compare');
    
    if (!validateResult.success) {
        const msg = `Auto-recovery failed: Backup validation error - ${validateResult.error}`;
        logJson('error', { message: msg });
        await sendDM(msg);
        process.exit(1);
    }
    
    // Check if validation exited with code 2 (significant discrepancy)
    if (validateResult.stdout && validateResult.stdout.includes('Significant discrepancy detected')) {
        logJson('info', { message: 'Significant discrepancy detected, attempting recovery' });
        
        // Run recovery with --regenerate flag to fix missing embeddings
        const recoveryResult = await runCommand('node /data/.openclaw/workspace/scripts/recover_memories.js --regenerate');
        
        if (!recoveryResult.success) {
            const msg = `Auto-recovery failed during recovery: ${recoveryResult.error}`;
            logJson('error', { message: msg });
            await sendDM(msg);
            process.exit(1);
        }
        
        const output = recoveryResult.stdout || '';
        const restoredMatch = output.match(/Restored: (\d+)/);
        const updatedMatch = output.match(/Updated: (\d+)/);
        const regeneratedMatch = output.match(/Regenerated (\d+) embeddings/);
        
        const restored = restoredMatch ? parseInt(restoredMatch[1]) : 0;
        const updated = updatedMatch ? parseInt(updatedMatch[1]) : 0;
        const regenerated = regeneratedMatch ? parseInt(regeneratedMatch[1]) : 0;
        
        const summary = `Auto-recovery completed: ${restored} restored, ${updated} updated, ${regenerated} embeddings regenerated.`;
        logJson('info', { message: summary });
        await sendDM(summary);
        
        // Run validation again to confirm fix
        logJson('info', { message: 'Validating after recovery' });
        const postValidate = await runCommand('node /data/.openclaw/workspace/scripts/validate_backup.js --compare');
        if (!postValidate.success) {
            logJson('warn', { message: 'Post-recovery validation warning', error: postValidate.error });
        }
        
        logJson('info', { message: 'Auto-recovery complete' });
        process.exit(0);
    } else {
        logJson('info', { message: 'No significant discrepancy found, no recovery needed' });
        process.exit(0);
    }
}

main().catch(err => {
    logJson('error', { message: 'Auto-recovery failed', error: err.message });
    process.exit(1);
});