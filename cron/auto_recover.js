#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function sendDM(message) {
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) console.error('Bridge stderr:', stderr);
        return true;
    } catch (err) {
        console.error('Failed to send via bridge:', err.message);
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
    console.log('Starting automated memory recovery...');
    
    // First, validate the latest backup
    console.log('Validating latest backup...');
    const validateResult = await runCommand('node /data/.openclaw/workspace/scripts/validate_backup.js --compare');
    
    if (!validateResult.success) {
        const msg = `Auto-recovery failed: Backup validation error - ${validateResult.error}`;
        console.error(msg);
        await sendDM(msg);
        process.exit(1);
    }
    
    // Check if validation exited with code 2 (significant discrepancy)
    if (validateResult.stdout && validateResult.stdout.includes('Significant discrepancy detected')) {
        console.log('Significant discrepancy detected, attempting recovery...');
        
        // Run recovery with --regenerate flag to fix missing embeddings
        const recoveryResult = await runCommand('node /data/.openclaw/workspace/scripts/recover_memories.js --regenerate');
        
        if (!recoveryResult.success) {
            const msg = `Auto-recovery failed during recovery: ${recoveryResult.error}`;
            console.error(msg);
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
        console.log(summary);
        await sendDM(summary);
        
        // Run validation again to confirm fix
        console.log('Validating after recovery...');
        const postValidate = await runCommand('node /data/.openclaw/workspace/scripts/validate_backup.js --compare');
        if (!postValidate.success) {
            console.warn('Post-recovery validation warning:', postValidate.error);
        }
        
        console.log('Auto-recovery complete.');
        process.exit(0);
    } else {
        console.log('No significant discrepancy found. No recovery needed.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Auto-recovery failed:', err);
    process.exit(1);
});