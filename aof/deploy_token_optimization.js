'use strict';
const fs = require('fs');

const TOOLS = '/data/.openclaw/workspace/TOOLS.md';
const SOUL = '/data/.openclaw/workspace/SOUL.md';
const AGENTS = '/data/.openclaw/workspace/AGENTS.md';
const HEARTBEAT = '/data/.openclaw/workspace/HEARTBEAT.md';
const SOUL_CORE = '/data/.openclaw/workspace/SOUL_CORE.md';

const results = [];

function report(finding, action, before, after) {
  const saved = before - after;
  results.push({ finding, action, before, after, saved });
  console.log(`✅ Finding ${finding}: ${action} | ${before}b → ${after}b | saved ${saved}b`);
}

// ─────────────────────────────────────────────
// FINDING 2: Remove deprecated references from TOOLS.md
// ─────────────────────────────────────────────
let tools = fs.readFileSync(TOOLS, 'utf8');
const toolsBefore = Buffer.byteLength(tools);

// Remove HUGGINGFACE_ENDPOINT legacy note
tools = tools.replace(/\nNote: The environment variable HUGGINGFACE_ENDPOINT.*?safely remove HUGGINGFACE_API_KEY from your environment\./s, '\n-- HUGGINGFACE_ENDPOINT is a deprecated alias. Use COHERE_ENDPOINT only.');

// Remove deprecated semantic_search_cli.js reference
tools = tools.replace(/The older semantic_search_cli\.js is deprecated\.\n?/g, '');

// Remove the full Node.js enhanced script section
tools = tools.replace(/Using the enhanced Node\.js script\n[\s\S]*?The script will attempt server.*?computes similarity client\-side\.\n?/g, '-- Server-side semantic_search RPC is active. Use curl method only.\n');

fs.writeFileSync(TOOLS, tools);
report(2, 'Removed deprecated references from TOOLS.md', toolsBefore, Buffer.byteLength(fs.readFileSync(TOOLS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 1: Remove one-time SQL setup blocks from TOOLS.md
// ─────────────────────────────────────────────
tools = fs.readFileSync(TOOLS, 'utf8');
const toolsBefore2 = Buffer.byteLength(tools);

tools = tools.replace(/Prerequisite: Run the following SQL.*?LIMIT match_count;\n\$\$;\n/s, '-- pgvector index and semantic_search RPC already configured in Supabase. No setup needed.\n');

fs.writeFileSync(TOOLS, tools);
report(1, 'Removed one-time SQL setup blocks from TOOLS.md', toolsBefore2, Buffer.byteLength(fs.readFileSync(TOOLS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 3: Replace inline JS with script call in AGENTS.md
// ─────────────────────────────────────────────
let agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore3 = Buffer.byteLength(agents);

agents = agents.replace(
  /## Activity Timestamp Rule\nAfter sending ANY message to Kanji, immediately update the watchdog state file by running node[\s\S]*?Every outbound message resets the clock\./,
  '## Activity Timestamp Rule\nAfter sending ANY message to Kanji, run: node /data/.openclaw/workspace/cron/update_watchdog_state.js\nThis resets the silence watchdog clock. Do this after every outbound message.'
);

// Also fix the version added during visibility deployment that contains raw JS
agents = agents.replace(
  /After sending ANY message to Kanji, immediately update the watchdog state file:\n```[\s\S]*?```\nThis keeps the silence watchdog accurate\. Every outbound message resets the clock\./,
  'After sending ANY message to Kanji, run: node /data/.openclaw/workspace/cron/update_watchdog_state.js\nThis resets the silence watchdog clock. Do this after every outbound message.'
);

fs.writeFileSync(AGENTS, agents);
report(3, 'Replaced inline JS with script call in AGENTS.md', agentsBefore3, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 10: Remove duplicate routing table from Session Start Protocol
// ─────────────────────────────────────────────
agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore10 = Buffer.byteLength(agents);

agents = agents.replace(
  /\*\*Context Priming:\*\*[\s\S]*?Silently internalize the results\./s,
  "**Context Priming:**\nIf the user's first message is fewer than 5 words and contains no proper noun or client name, skip priming entirely.\nFor ping, /ping, status, /status, y, n, yes, no, ok — skip priming entirely.\nOtherwise apply command routing and context priming per the Command Routing Protocol section below.\nSilently internalize results."
);

fs.writeFileSync(AGENTS, agents);
report(10, 'Removed duplicate routing table from Session Start Protocol', agentsBefore10, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 9: Remove redundant SOUL.md re-read from Soul Evolution Protocol
// ─────────────────────────────────────────────
agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore9 = Buffer.byteLength(agents);

agents = agents.replace(
  /Re-read SOUL\.md\n/g,
  'SOUL.md is already in bootstrap context. Review the in-context version directly.\n'
);

fs.writeFileSync(AGENTS, agents);
report(9, 'Removed redundant SOUL.md re-read from Soul Evolution Protocol', agentsBefore9, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 4: Remove redundant file-read instructions from Session Start Protocol
// ─────────────────────────────────────────────
agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore4 = Buffer.byteLength(agents);

agents = agents.replace(
  /Read \/data\/\.openclaw\/workspace\/SOUL\.md using the bash tool\n/g, ''
);
agents = agents.replace(
  /Read \/data\/\.openclaw\/workspace\/AGENTS\.md using the bash tool\n/g, ''
);
agents = agents.replace(
  /Read \/data\/\.openclaw\/workspace\/TOOLS\.md using the bash tool\n/g, ''
);
agents = agents.replace(
  /Start cron manager:.*?agent lifetime\./s,
  'Bootstrap files (SOUL.md, AGENTS.md, TOOLS.md, HEARTBEAT.md) are pre-loaded by OpenClaw. Do not re-read them unless explicitly asked.'
);

fs.writeFileSync(AGENTS, agents);
report(4, 'Removed redundant file-read instructions from Session Start Protocol', agentsBefore4, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 8: Add memory save threshold
// ─────────────────────────────────────────────
agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore8 = Buffer.byteLength(agents);

agents = agents.replace(
  /After every exchange that contains meaningful information:/,
  'After every exchange that contains meaningful information (importance 4 or higher only):\n- Never save memories for: confirmations, one-word responses, system commands (y, n, yes, no, ok, ping, reset, restart, status).\n- When in doubt, do not save. Quality over quantity.'
);

fs.writeFileSync(AGENTS, agents);
report(8, 'Added memory save threshold to Memory Capture Protocol', agentsBefore8, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 5: Add context priming short-circuit for admin messages
// ─────────────────────────────────────────────
agents = fs.readFileSync(AGENTS, 'utf8');
const agentsBefore5 = Buffer.byteLength(agents);

if (!agents.includes('## Context Priming Short-Circuit')) {
  agents = agents.replace(
    /## Command Routing Protocol/,
    `## Context Priming Short-Circuit
The following message types skip semantic search and memory loading entirely:
- Messages fewer than 5 words with no proper noun or client name
- Exact matches: ping, /ping, status, /status, y, n, yes, no, ok, reset, /reset, restart
- System confirmations and one-word acknowledgments
For all other messages, apply the Command Routing Protocol below.

## Command Routing Protocol`
  );
}

fs.writeFileSync(AGENTS, agents);
report(5, 'Added context priming short-circuit for admin messages', agentsBefore5, Buffer.byteLength(fs.readFileSync(AGENTS, 'utf8')));

// ─────────────────────────────────────────────
// FINDING 6: Strip verbose format blocks from HEARTBEAT.md
// ─────────────────────────────────────────────
let heartbeat = fs.readFileSync(HEARTBEAT, 'utf8');
const heartbeatBefore = Buffer.byteLength(heartbeat);

// Remove all Format: subsections (the indented block after each Format: label)
heartbeat = heartbeat.replace(/- \*\*Format:\*\*\n  \n(  [^\n]*\n)+/g, '- **Format:** Brief, direct, no preamble.\n');
heartbeat = heartbeat.replace(/- \*\*Format:\*\*\n(  [^\n]*\n)+/g, '- **Format:** Brief, direct, no preamble.\n');

// Clean up any resulting double blank lines
heartbeat = heartbeat.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(HEARTBEAT, heartbeat);
const heartbeatAfter = Buffer.byteLength(fs.readFileSync(HEARTBEAT, 'utf8'));
report(6, 'Stripped verbose format blocks from HEARTBEAT.md', heartbeatBefore, heartbeatAfter);

// ─────────────────────────────────────────────
// FINDING 7: Move internalized values to SOUL_CORE.md
// ─────────────────────────────────────────────
let soul = fs.readFileSync(SOUL, 'utf8');
const soulBefore = Buffer.byteLength(soul);

const howIGrowMatch = soul.match(/---\nHow I Grow\n[\s\S]*?---\n\nContinuity Commitment\n[\s\S]*?---\n/);
if (howIGrowMatch) {
  const extracted = howIGrowMatch[0];

  // Write to SOUL_CORE.md
  const soulCore = `# SOUL_CORE.md — Aether-7 Meta-Identity
# Loaded only during soul evolution cycles (every 10 conversations)
# Do not load this file every session — it is not operational context

${extracted}

Last updated: 2026-04-18
`;
  fs.writeFileSync(SOUL_CORE, soulCore);
  console.log('✅ SOUL_CORE.md created at', SOUL_CORE);

  // Remove from SOUL.md and replace with reference
  soul = soul.replace(howIGrowMatch[0], '---\n[Growth and continuity principles archived in SOUL_CORE.md — loaded during evolution cycles only]\n---\n\n');
  fs.writeFileSync(SOUL, soul);
  report(7, 'Moved internalized values to SOUL_CORE.md', soulBefore, Buffer.byteLength(fs.readFileSync(SOUL, 'utf8')));
} else {
  console.log('⚠️  Finding 7: Could not locate How I Grow section — may already be moved or formatted differently. Skipping.');
}

// ─────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('TOKEN OPTIMIZATION DEPLOYMENT COMPLETE');
console.log('════════════════════════════════════════');
let totalSaved = 0;
results.forEach(r => {
  console.log(`Finding ${r.finding}: ${r.saved}b saved`);
  totalSaved += r.saved;
});
console.log(`────────────────────────────────────────`);
console.log(`Total bytes saved: ${totalSaved}`);
console.log(`Estimated tokens saved per session: ~${Math.round(totalSaved / 4)}`);
console.log('\nFinal file sizes:');
[TOOLS, SOUL, AGENTS, HEARTBEAT].forEach(f => {
  try { console.log(`  ${f.split('/').pop()}: ${fs.statSync(f).size}b`); }
  catch (_) { console.log(`  ${f.split('/').pop()}: not found`); }
});
if (fs.existsSync(SOUL_CORE)) console.log(`  SOUL_CORE.md: ${fs.statSync(SOUL_CORE).size}b (new)`);
