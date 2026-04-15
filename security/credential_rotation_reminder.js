const fs = require('fs');
const path = require('path');
const { logSecurityEvent } = require('./input_sanitizer.js');

const MANIFEST_PATH = path.join(__dirname, 'credentials_manifest.json');

function loadManifest() {
    try {
        const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to load credentials manifest:', error.message);
        return { credentials: [] };
    }
}

function daysBetween(date1, date2) {
    const diffTime = Math.abs(new Date(date2) - new Date(date1));
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getRotationPlatform(credentialName) {
    const platforms = {
        'COHERE_API_KEY': 'Cohere Console (https://dashboard.cohere.com/api-keys)',
        'SUPABASE_ANON_KEY': 'Supabase Dashboard (https://supabase.com/dashboard/project/_/settings/api)',
        'DISCORD_BOT_TOKEN': 'Discord Developer Portal (https://discord.com/developers/applications)',
        'TELEGRAM_BOT_TOKEN': 'BotFather on Telegram',
        'GITHUB_TOKEN': 'GitHub Settings > Developer settings > Personal access tokens',
        'WEBHOOK_SECRET': 'Supabase Dashboard (https://supabase.com/dashboard/project/_/settings/api)'
    };
    return platforms[credentialName] || 'Unknown platform';
}

async function checkRotation() {
    const manifest = loadManifest();
    const today = new Date().toISOString().split('T')[0];
    const alerts = [];

    for (const cred of manifest.credentials) {
        const daysSince = daysBetween(cred.last_rotated, today);
        const daysRemaining = cred.rotation_interval_days - daysSince;
        const platform = getRotationPlatform(cred.name);

        if (daysRemaining <= 0) {
            // Overdue
            alerts.push({
                level: 'CRITICAL',
                message: `OVERDUE CREDENTIAL ROTATION: ${cred.name} -- ${Math.abs(daysRemaining)} days overdue. Rotate immediately.`,
                credential: cred.name,
                days_overdue: Math.abs(daysRemaining),
                platform
            });
        } else if (daysRemaining <= 14) {
            // Due soon
            alerts.push({
                level: 'WARNING',
                message: `CREDENTIAL ROTATION DUE IN ${daysRemaining} DAYS: ${cred.name} -- Purpose: ${cred.purpose}. Last rotated: ${cred.last_rotated}. Rotate at: ${platform}`,
                credential: cred.name,
                days_remaining: daysRemaining,
                platform
            });
        }
    }

    // Log to security.log
    for (const alert of alerts) {
        logSecurityEvent('credential_rotation_reminder', alert.level, {
            credential: alert.credential,
            message: alert.message
        });
    }

    // Send Discord alerts via message_bridge
    if (alerts.length > 0) {
        const { sendMessage } = require('../cron/message_bridge.js');
        if (typeof sendMessage === 'function') {
            for (const alert of alerts) {
                sendMessage(alert.message);
            }
        } else {
            console.log('Message bridge not available. Alerts:', alerts.map(a => a.message));
        }
    }

    return alerts;
}

// If run directly
if (require.main === module) {
    checkRotation().then(alerts => {
        console.log(`Checked ${loadManifest().credentials.length} credentials, found ${alerts.length} alerts.`);
        process.exit(0);
    }).catch(error => {
        console.error('Rotation check failed:', error);
        process.exit(1);
    });
}

module.exports = {
    checkRotation,
    loadManifest,
    getRotationPlatform
};