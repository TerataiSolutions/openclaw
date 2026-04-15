const fs = require('fs');
const path = require('path');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const AUDIT_LOG_FILE = path.join(logsDir, 'audit.log');

function writeLocalLog(event) {
    const entry = JSON.stringify({
        ...event,
        logged_at: new Date().toISOString()
    });
    fs.appendFileSync(AUDIT_LOG_FILE, entry + '\n', { encoding: 'utf8' });
}

async function logAuditEvent({ event_type, client_id, memory_id, action, details = {} }) {
    const event = {
        event_type,
        client_id: client_id || null,
        memory_id: memory_id || null,
        action,
        details,
        performed_at: new Date().toISOString()
    };

    // Write to local backup log
    writeLocalLog(event);

    // Write to Supabase if credentials available
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                console.error(`Failed to write audit log to Supabase: ${response.status}`);
                // Fallback to local-only
            }
        } catch (error) {
            console.error('Error writing to Supabase audit_log:', error.message);
            // Continue with local logging only
        }
    }
}

async function getAuditSummary(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const summary = {
        client_state_read: 0,
        client_data_access: 0,
        document_ingested: 0,
        cross_client_analysis: 0,
        client_confirmation: 0,
        injection_detected: 0,
        credential_rotation_due: 0,
        total: 0
    };

    // Try Supabase first
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/audit_log?performed_at=gte.${cutoff.toISOString()}&select=event_type`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const events = await response.json();
                events.forEach(event => {
                    summary[event.event_type] = (summary[event.event_type] || 0) + 1;
                    summary.total++;
                });
                return summary;
            }
        } catch (error) {
            console.error('Error fetching from Supabase audit_log:', error.message);
        }
    }

    // Fallback to local log file
    try {
        if (fs.existsSync(AUDIT_LOG_FILE)) {
            const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').split('\n').filter(Boolean);
            lines.forEach(line => {
                try {
                    const event = JSON.parse(line);
                    const eventDate = new Date(event.performed_at || event.logged_at);
                    if (eventDate >= cutoff) {
                        summary[event.event_type] = (summary[event.event_type] || 0) + 1;
                        summary.total++;
                    }
                } catch (e) {
                    // Skip malformed lines
                }
            });
        }
    } catch (error) {
        console.error('Error reading local audit log:', error.message);
    }

    return summary;
}

module.exports = {
    logAuditEvent,
    getAuditSummary
};