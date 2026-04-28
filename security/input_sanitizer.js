const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const SECURITY_LOG = path.join(logsDir, 'security.log');

function logSecurityEvent(source, result, details = {}) {
    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({
        timestamp,
        source,
        result,
        ...details
    });
    fs.appendFileSync(SECURITY_LOG, entry + '\n', { encoding: 'utf8' });
}

// Injection patterns
const INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /disregard your/i,
    /you are now/i,
    /new instructions:/i,
    /system prompt/i,
    /forget everything/i,
    /act as if/i,
    /pretend you are/i,
    /override your/i,
    /your new instructions/i
];

// Exfiltration patterns - block external URLs except allowed domains
const EXFILTRATION_PATTERNS = [
    /https?:\/\/(?!opp\.agency|yourccsteam\.com|sturdy\.ai|senecaglobal\.com|pecan\.ai|calendly\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    /\bcurl\b.*\bhttp/i,
    /\bfetch\b.*\bhttp/i
];

// Unicode homoglyph ranges
const HOMOGLYPH_RANGES = [
    [0x0400, 0x04FF], // Cyrillic
    [0x0370, 0x03FF]  // Greek (lookalikes)
];

function containsHomoglyphs(text) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        for (const [start, end] of HOMOGLYPH_RANGES) {
            if (code >= start && code <= end) {
                return true;
            }
        }
    }
    return false;
}

function sanitizeInput(content, source) {
    const checks = [];

    // Check for injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(content)) {
            checks.push({
                safe: false,
                reason: `Injection pattern detected: ${pattern.source}`,
                flagged_content: content.match(pattern)?.[0] || '[pattern matched]'
            });
            break;
        }
    }

    // Check for exfiltration patterns
    for (const pattern of EXFILTRATION_PATTERNS) {
        if (pattern.test(content)) {
            checks.push({
                safe: false,
                reason: `Exfiltration pattern detected: ${pattern.source}`,
                flagged_content: content.match(pattern)?.[0] || '[pattern matched]'
            });
            break;
        }
    }

    // Check for homoglyphs
    if (containsHomoglyphs(content)) {
        checks.push({
            safe: false,
            reason: 'Unicode homoglyph attack detected',
            flagged_content: content
        });
    }

    if (checks.length > 0) {
        const result = {
            safe: false,
            reason: checks.map(c => c.reason).join('; '),
            flagged_content: checks[0].flagged_content
        };
        logSecurityEvent(source, 'BLOCKED', result);
        return result;
    }

    logSecurityEvent(source, 'CLEAN', { content_length: content.length });
    return { safe: true };
}

function sanitizeMemoryContent(content) {
    const result = sanitizeInput(content, 'memory_save');
    
    if (!result.safe) {
        // Tag memory as injection_suspect and send Discord alert
        // We'll rely on the caller to handle tagging
        // Send Discord alert via message_bridge.js
        const { sendMessage } = require('../cron/message_bridge.js');
        if (typeof sendMessage === 'function') {
            sendMessage(`SECURITY ALERT: Injection pattern detected in memory content. Content has been tagged injection_suspect and quarantined. Review required. Flagged reason: ${result.reason}`);
        }
        return { safe: false, tagged: true };
    }
    
    return { safe: true, tagged: false };
}

module.exports = {
    sanitizeInput,
    sanitizeMemoryContent,
    logSecurityEvent
};