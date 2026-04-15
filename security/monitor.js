const fs = require('fs');
const path = require('path');
const { logSecurityEvent } = require('./input_sanitizer.js');
const { getAuditSummary } = require('./audit_logger.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function querySupabase(query, table, params = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase credentials not available');
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Supabase query failed: ${response.status}`);
    }

    return await response.json();
}

async function checkInjectionSuspects() {
    try {
        // Query memories with injection_suspect tag and no resolution
        const memories = await querySupabase(
            'memories',
            'memories',
            {
                tags: 'cs.{injection_suspect}',
                select: 'id,content,created_at'
            }
        );

        if (memories.length > 0) {
            return {
                level: 'WARNING',
                message: `Found ${memories.length} memory(ies) tagged injection_suspect with no resolution. Review required.`,
                count: memories.length,
                memories: memories.map(m => ({ id: m.id, created: m.created_at }))
            };
        }
    } catch (error) {
        console.error('Failed to check injection suspects:', error.message);
        return null;
    }
    return null;
}

async function checkCrossClientAnomaly() {
    try {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const events = await querySupabase(
            'audit_log',
            'audit_log',
            {
                event_type: 'eq.cross_client_analysis',
                performed_at: `gte.${sixHoursAgo}`,
                select: 'id,performed_at,details'
            }
        );

        if (events.length > 3) {
            return {
                level: 'WARNING',
                message: `Anomaly detected: ${events.length} cross-client analysis events in the last 6 hours. Expected maximum 3.`,
                count: events.length,
                events: events.map(e => ({ id: e.id, time: e.performed_at }))
            };
        }
    } catch (error) {
        console.error('Failed to check cross-client anomaly:', error.message);
        return null;
    }
    return null;
}

function checkCohereUsage() {
    const logsDir = path.join(__dirname, '..', 'logs');
    const securityLog = path.join(logsDir, 'security.log');
    
    if (!fs.existsSync(securityLog)) {
        return null;
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let embeddingCount = 0;

    try {
        const lines = fs.readFileSync(securityLog, 'utf8').split('\n').filter(Boolean);
        lines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                if (entry.source === 'embedding_generation' && new Date(entry.timestamp).getTime() > oneHourAgo) {
                    embeddingCount++;
                }
            } catch (e) {
                // Skip malformed lines
            }
        });
    } catch (error) {
        console.error('Failed to check Cohere usage:', error.message);
        return null;
    }

    if (embeddingCount > 100) {
        return {
            level: 'WARNING',
            message: `High Cohere API usage: ${embeddingCount} embedding generations in the last hour. Threshold is 100.`,
            count: embeddingCount
        };
    }
    return null;
}

function checkWebhookAuthFailures() {
    const logsDir = path.join(__dirname, '..', 'logs');
    const securityLog = path.join(logsDir, 'security.log');
    
    if (!fs.existsSync(securityLog)) {
        return null;
    }

    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    let failureCount = 0;

    try {
        const lines = fs.readFileSync(securityLog, 'utf8').split('\n').filter(Boolean);
        lines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                if (entry.source === 'webhook_auth' && entry.result === 'FAILED' && 
                    new Date(entry.timestamp).getTime() > sixHoursAgo) {
                    failureCount++;
                }
            } catch (e) {
                // Skip malformed lines
            }
        });
    } catch (error) {
        console.error('Failed to check webhook auth failures:', error.message);
        return null;
    }

    if (failureCount > 5) {
        return {
            level: 'WARNING',
            message: `Excessive webhook authentication failures: ${failureCount} failures in the last 6 hours.`,
            count: failureCount
        };
    }
    return null;
}

async function runMonitor() {
    const checks = [
        await checkInjectionSuspects(),
        await checkCrossClientAnomaly(),
        checkCohereUsage(),
        checkWebhookAuthFailures()
    ];

    const alerts = checks.filter(check => check !== null);
    const summary = {
        timestamp: new Date().toISOString(),
        checks_performed: 4,
        alerts_found: alerts.length,
        alerts: alerts.map(a => ({ level: a.level, message: a.message }))
    };

    // Log summary to security.log
    logSecurityEvent('security_monitor', 'RUN_COMPLETE', summary);

    // Send alerts via message_bridge
    if (alerts.length > 0) {
        const { sendMessage } = require('../cron/message_bridge.js');
        if (typeof sendMessage === 'function') {
            for (const alert of alerts) {
                const prefix = `SECURITY MONITOR [${alert.level}]:`;
                sendMessage(`${prefix} ${alert.message}`);
            }
        } else {
            console.log('Message bridge not available. Alerts:', alerts.map(a => a.message));
        }
    }

    return summary;
}

// If run directly
if (require.main === module) {
    runMonitor().then(summary => {
        console.log(JSON.stringify(summary, null, 2));
        process.exit(0);
    }).catch(error => {
        console.error('Security monitor failed:', error);
        process.exit(1);
    });
}

module.exports = {
    runMonitor,
    checkInjectionSuspects,
    checkCrossClientAnomaly,
    checkCohereUsage,
    checkWebhookAuthFailures
};