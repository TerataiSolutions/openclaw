#!/usr/bin/env node

/**
 * Bootstrap file size monitor and compressor.
 * Checks AGENTS.md, HEARTBEAT.md, SOUL.md, TOOLS.md for size limits.
 * Auto-compresses files exceeding 11,800 characters.
 * Logs warnings for files between 11,500 and 11,799.
 * Sends Discord DMs for warnings and critical actions.
 *
 * Usage:
 *   node bootstrap_size_check.js
 *   node bootstrap_size_check.js --diff <filename>
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BOOTSTRAP_FILES = [
    '/data/.openclaw/workspace/AGENTS.md',
    '/data/.openclaw/workspace/HEARTBEAT.md',
    '/data/.openclaw/workspace/SOUL.md',
    '/data/.openclaw/workspace/TOOLS.md',
    '/data/.openclaw/workspace/SCHEDULES.md',
    '/data/.openclaw/workspace/PROTOCOLS.md'
];

const WARNING_TIER = 11500;
const CRITICAL_TIER = 11800;

const LOG_DIR = '/data/.openclaw/workspace/logs';
const SIZE_LOG = path.join(LOG_DIR, 'bootstrap_size.log');
const DIFF_DIR = path.join(LOG_DIR, 'bootstrap_diffs');

// Protected strings that must never be removed by compression
const PROTECTED_STRINGS = [
    // Function calls
    'getClientState()',
    'confirmActiveClient()',
    'updateClientState()',
    'clients/ingest.js',
    'clients/retrieve.js',
    // Common script paths
    '/data/.openclaw/workspace/',
    'node ',
    'cron/',
    // Time patterns
    'AM', 'PM', 'ET', 'UTC',
    // Numeric thresholds
    'threshold',
    'importance',
    // Tags
    'needs_follow_up',
    'heartbeat_sent',
    'late_session',
    // Other critical terms
    'Supabase',
    'Discord',
    'Telegram',
    'quiet hours',
    'all-nighter',
    'Morning Briefing',
    'End-of-Day Wrap',
    'Mood Check-In',
    'Weekly Memory Report',
    // Bootstrap size rule
    'BOOTSTRAP SIZE RULE'
];

/**
 * Send a Discord DM using the message bridge.
 * @param {string} message - The message to send.
 */
async function sendDiscordDM(message) {
    try {
        await execPromise(`node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`);
        console.log(`Discord DM sent: ${message}`);
    } catch (err) {
        console.error(`Failed to send Discord DM: ${err.message}`);
    }
}

/**
 * Log a message to the size log.
 * @param {string} entry - The log entry.
 */
function logSize(entry) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${entry}\n`;
    fs.appendFileSync(SIZE_LOG, line, { encoding: 'utf8' });
    console.log(line.trim());
}

/**
 * Ensure required directories exist.
 */
function ensureDirectories() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(DIFF_DIR)) fs.mkdirSync(DIFF_DIR, { recursive: true });
}

/**
 * Count characters in a file.
 * @param {string} filePath - Path to the file.
 * @returns {number} Character count.
 */
function countChars(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.length;
    } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
        return 0;
    }
}

/**
 * Check if a line contains any protected string.
 * @param {string} line - The line to check.
 * @returns {boolean} True if protected.
 */
function isProtected(line) {
    const lower = line.toLowerCase();
    return PROTECTED_STRINGS.some(protected => lower.includes(protected.toLowerCase()));
}

/**
 * Remove trailing explanatory phrases from a line.
 * @param {string} line - The line to clean.
 * @returns {string} Cleaned line.
 */
function removeTrailingExplanations(line) {
    // Patterns that indicate explanatory clauses
    const patterns = [
        /\s+–\s+[^–]*$/,          // em dash
        /\s+—\s+[^—]*$/,          // en dash
        /\s*\([^)]*\)\s*$/,       // parentheses at end
        /\s*\[[^\]]*\]\s*$/,      // brackets at end
        /\s*-\s+[^-]*$/,          // hyphen
        /\s*:\s+[^:]*$/,          // colon
        /\s*;\s+[^;]*$/,          // semicolon
    ];
    let cleaned = line;
    for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '');
    }
    // Remove phrases like "This ensures", "This keeps", "This means", etc.
    const phrasePatterns = [
        /\s+this ensures.*$/i,
        /\s+this keeps.*$/i,
        /\s+this prevents.*$/i,
        /\s+this means.*$/i,
        /\s+this is because.*$/i,
        /\s+in order to.*$/i,
        /\s+so that.*$/i,
        /\s+which means.*$/i,
        /\s+which ensures.*$/i,
        /\s+which keeps.*$/i,
    ];
    for (const pattern of phrasePatterns) {
        cleaned = cleaned.replace(pattern, '');
    }
    return cleaned.trim();
}

/**
 * Condense a phrase over 12 words to 6 or fewer words if possible.
 * Very basic heuristic: remove stop words and redundant adjectives.
 * @param {string} phrase - The phrase to condense.
 * @returns {string} Condensed phrase.
 */
function condenseLongPhrase(phrase) {
    const words = phrase.split(/\s+/);
    if (words.length <= 12) return phrase;

    // Common stop words to consider removing (if not essential)
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'that', 'this', 'these', 'those', 'very', 'really', 'just', 'actually', 'basically', 'essentially', 'quite', 'somewhat']);
    const important = words.filter(w => !stopWords.has(w.toLowerCase()));
    // If still too long, take first 6 words that are not stop words
    const condensed = important.slice(0, 6).join(' ');
    return condensed || phrase.slice(0, 50); // fallback
}

/**
 * Remove rationale/note sections if the previous line is a rule.
 * @param {string[]} lines - Array of lines.
 * @returns {string[]} Filtered lines.
 */
function removeRationaleSections(lines) {
    const cleaned = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        const isRationale = lower.includes('rationale:') || lower.includes('note:') || lower.includes('**rationale:**') || lower.includes('*note:*');
        if (isRationale && i > 0) {
            const prev = lines[i - 1];
            // If previous line looks like a rule (contains a colon, dash, or bullet), skip rationale
            const isRule = /^[*-]|^\d+\.|:/.test(prev.trim());
            if (isRule) {
                console.log(`Removing rationale line: ${line}`);
                continue;
            }
        }
        cleaned.push(line);
    }
    return cleaned;
}

/**
 * Apply compression to a text.
 * @param {string} text - Original text.
 * @returns {string} Compressed text.
 */
function compressText(text) {
    const lines = text.split('\n');
    const compressedLines = [];
    for (let line of lines) {
        // Skip protected lines entirely
        if (isProtected(line)) {
            compressedLines.push(line);
            continue;
        }
        // Remove trailing explanations
        let cleaned = removeTrailingExplanations(line);
        // Condense long sentences (only for prose lines not starting with bullet/number)
        if (!/^[*-•\d.]/.test(cleaned.trim())) {
            const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences.length === 1) {
                const words = cleaned.split(/\s+/);
                if (words.length > 12) {
                    cleaned = condenseLongPhrase(cleaned);
                }
            }
        }
        compressedLines.push(cleaned);
    }
    // Remove rationale sections
    const withoutRationale = removeRationaleSections(compressedLines);
    return withoutRationale.join('\n');
}

/**
 * Save a diff between original and compressed versions.
 * @param {string} filePath - Path to the file.
 * @param {string} original - Original content.
 * @param {string} compressed - Compressed content.
 */
function saveDiff(filePath, original, compressed) {
    const baseName = path.basename(filePath);
    const date = new Date().toISOString().slice(0, 10);
    const diffFile = path.join(DIFF_DIR, `${baseName}-${date}.diff`);
    const diff = `--- ${filePath} (original)\n+++ ${filePath} (compressed)\n`;
    const origLines = original.split('\n');
    const compLines = compressed.split('\n');
    let diffLines = [];
    for (let i = 0; i < Math.max(origLines.length, compLines.length); i++) {
        const orig = origLines[i] || '';
        const comp = compLines[i] || '';
        if (orig !== comp) {
            diffLines.push(`- ${orig}`);
            diffLines.push(`+ ${comp}`);
        }
    }
    fs.writeFileSync(diffFile, diff + diffLines.join('\n'), 'utf8');
    console.log(`Diff saved to ${diffFile}`);
}

/**
 * Process a single bootstrap file.
 * @param {string} filePath - Path to the file.
 */
async function processFile(filePath) {
    const count = countChars(filePath);
    const baseName = path.basename(filePath);
    const tier = count >= CRITICAL_TIER ? 'CRITICAL' : (count >= WARNING_TIER ? 'WARNING' : 'SAFE');
    
    logSize(`${baseName}: ${count} chars (${tier})`);
    
    if (tier === 'WARNING') {
        const message = `${baseName} is ${count} characters. Approaching the 12,000-character limit. Monitor before adding content.`;
        await sendDiscordDM(message);
        logSize(`Warning DM sent for ${baseName}`);
    } else if (tier === 'CRITICAL') {
        const original = fs.readFileSync(filePath, 'utf8');
        const compressed = compressText(original);
        const newCount = compressed.length;
        fs.writeFileSync(filePath, compressed, 'utf8');
        saveDiff(filePath, original, compressed);
        const message = `${baseName} was ${count} chars and exceeded the safe limit. Auto-compressed to ${newCount} chars. Review the changes: node /data/.openclaw/workspace/scripts/bootstrap_size_check.js --diff ${filePath}`;
        await sendDiscordDM(message);
        logSize(`Critical: compressed ${baseName} from ${count} to ${newCount} chars`);
    }
}

/**
 * Show the last saved diff for a file.
 * @param {string} filePath - Path to the file.
 */
function showDiff(filePath) {
    const baseName = path.basename(filePath);
    const files = fs.readdirSync(DIFF_DIR).filter(f => f.startsWith(baseName)).sort().reverse();
    if (files.length === 0) {
        console.log(`No diff files found for ${baseName}`);
        return;
    }
    const latest = path.join(DIFF_DIR, files[0]);
    console.log(`Latest diff for ${baseName} (${files[0]}):\n`);
    console.log(fs.readFileSync(latest, 'utf8'));
}

/**
 * Main function.
 */
async function main() {
    ensureDirectories();
    const args = process.argv.slice(2);
    
    if (args.length === 2 && args[0] === '--diff') {
        const filePath = args[1];
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        showDiff(filePath);
        return;
    }
    
    console.log('=== Bootstrap Size Check ===');
    for (const file of BOOTSTRAP_FILES) {
        if (!fs.existsSync(file)) {
            console.warn(`File missing: ${file}`);
            continue;
        }
        await processFile(file);
    }
    console.log('=== Check complete ===');
}

if (require.main === module) {
    main().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}

module.exports = { compressText, countChars };