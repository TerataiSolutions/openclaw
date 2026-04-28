'use strict';

const { saveMemoryWithEmbedding, logJson } = require('../utils.js');

// ── Competitor keyword list ───────────────────────────────────────────────────
// Extend this list as new competitors are identified in transcripts.
const COMPETITOR_KEYWORDS = [
 'apollo', 'zoominfo', 'seamless', 'lusha', 'hunter', 'outreach',
 'salesloft', 'gong', 'chorus', 'orum', 'nooks', 'koncert',
 'cloudtalk', 'aircall', 'dialpad', 'hubspot', 'salesforce'
];

// ── ICP mismatch signals ──────────────────────────────────────────────────────
// Phrases that suggest a prospect outside the defined ICP is being pitched.
const ICP_MISMATCH_SIGNALS = [
 'not really our target', 'wrong fit', 'too small', 'too large',
 'not decision maker', 'no budget', 'wrong industry', 'consumer',
 'b2c', 'freelancer', 'individual', 'not a business', 'personal use'
];

// ── LLM call via DeepSeek through OpenClaw gateway ───────────────────────────
async function callDeepSeek(prompt) {
 const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080/v1/chat/completions';
 const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

 const response = await fetch(OPENCLAW_API_URL, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 ...(OPENCLAW_API_KEY && { 'Authorization': `Bearer ${OPENCLAW_API_KEY}` })
 },
 body: JSON.stringify({
 model: 'deepseek-reasoner',
 messages: [{ role: 'user', content: prompt }],
 max_tokens: 800,
 temperature: 0.3
 })
 });

 if (!response.ok) throw new Error(`DeepSeek call failed: ${response.status}`);
 const data = await response.json();
 return data.choices?.[0]?.message?.content || '';
}

// ── Discord alert helper ──────────────────────────────────────────────────────
async function alertDiscord(message) {
 const DISCORD_WEBHOOK_URL = process.env.AETHER_DISCORD_WEBHOOK_URL;
 if (!DISCORD_WEBHOOK_URL) return;

 const body = JSON.stringify({ content: message });
 try {
 await fetch(DISCORD_WEBHOOK_URL, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body
 });
 } catch (err) {
 logJson('error', { event: 'post_ingest_discord_alert_failed', error: err.message });
 }
}

// ── ITEM 15: Competitive Intelligence Capture ─────────────────────────────────
async function captureCompetitiveIntel(clientId, plainText, meetingTitle) {
 const lower = plainText.toLowerCase();
 const found = COMPETITOR_KEYWORDS.filter(k => lower.includes(k));
 if (found.length === 0) return;

 const content = `Competitors mentioned in "${meetingTitle}": ${found.join(', ')}. ` +
 `Review transcript for context on how each was referenced.`;

 await saveMemoryWithEmbedding({
 type: 'competitive_intel',
 content,
 client_id: clientId,
 importance: 7,
 tags: ['competitive_intel', `client_${clientId}`, 'fathom_auto', ...found]
 });

 logJson('info', { event: 'competitive_intel_captured', client_id: clientId, competitors: found });
}

// ── ITEM 10: ICP Drift Alert ──────────────────────────────────────────────────
async function detectIcpDrift(clientId, plainText, meetingTitle) {
 const lower = plainText.toLowerCase();
 const signals = ICP_MISMATCH_SIGNALS.filter(s => lower.includes(s));
 if (signals.length === 0) return;

 const content = `ICP misalignment detected in "${meetingTitle}". ` +
 `Signals found: ${signals.join(', ')}. ` +
 `Review transcript to confirm whether prospects outside the defined ICP are being pitched.`;

 await saveMemoryWithEmbedding({
 type: 'icp_misalignment',
 content,
 client_id: clientId,
 importance: 8,
 tags: ['icp_misalignment', `client_${clientId}`, 'fathom_auto', 'needs_review']
 });

 await alertDiscord(
 `**ICP Drift Detected** -- \`${clientId}\`\n` +
 `Meeting: \`${meetingTitle}\`\n` +
 `Signals: ${signals.join(', ')}\n` +
 `A prospect outside the defined ICP may have been pitched. Review transcript.`
 );

 logJson('warn', { event: 'icp_drift_detected', client_id: clientId, signals });
}

// ── ITEM 14: Executive Sync Summary Storage ───────────────────────────────────
async function summarizeExecutiveSync(clientId, plainText, meetingTitle, meetingType) {
 if (meetingType !== 'executive_cro' && meetingType !== 'executive_ceo') return;

 const role = meetingType === 'executive_cro' ? 'CRO (Cole)' : 'CEO (Lance)';

 let summary;
 try {
 summary = await callDeepSeek(
 `You are analyzing a meeting transcript between a Sales Enablement Manager and their ${role}.\n` +
 `Extract ONLY: (1) key decisions made, (2) directives given, (3) action items assigned.\n` +
 `Be concise. Use plain text. No preamble. Format:\n` +
 `DECISIONS: ...\nDIRECTIVES: ...\nACTION ITEMS: ...\n\n` +
 `Transcript:\n${plainText.slice(0, 6000)}`
 );
 } catch (err) {
 logJson('error', { event: 'executive_summary_llm_failed', error: err.message });
 return;
 }

 await saveMemoryWithEmbedding({
 type: 'decision',
 content: `Executive sync summary -- ${meetingTitle}:\n${summary}`,
 client_id: clientId,
 importance: 9,
 tags: ['executive_decision', `client_${clientId}`, meetingType, 'fathom_auto', 'morning_briefing']
 });

 logJson('info', { event: 'executive_sync_summarized', client_id: clientId, meeting_type: meetingType });
}

// ── ITEM 19: Transcript-to-Strategy Pipeline ──────────────────────────────────
async function extractStrategyInputs(clientId, plainText, meetingTitle, meetingType) {
 if (meetingType !== 'client_calibration') return;

 let extraction;
 try {
 extraction = await callDeepSeek(
 `You are analyzing a client calibration sync transcript.\n` +
 `Extract ONLY: (1) unresolved client concerns, (2) stated client goals, (3) open questions left unanswered.\n` +
 `Be concise. Plain text. No preamble. Format:\n` +
 `CONCERNS: ...\nGOALS: ...\nOPEN QUESTIONS: ...\n\n` +
 `Transcript:\n${plainText.slice(0, 6000)}`
 );
 } catch (err) {
 logJson('error', { event: 'strategy_extraction_llm_failed', error: err.message });
 return;
 }

 await saveMemoryWithEmbedding({
 type: 'strategy_input',
 content: `Strategy inputs from "${meetingTitle}":\n${extraction}`,
 client_id: clientId,
 importance: 8,
 tags: ['strategy_input', `client_${clientId}`, 'client_calibration', 'fathom_auto', 'client_digest']
 });

 logJson('info', { event: 'strategy_inputs_extracted', client_id: clientId });
}

// ── Main orchestrator -- called from fathom_webhook.js ───────────────────────
async function runPostIngestAnalysis({ clientId, plainText, meetingTitle, meetingType }) {
 await Promise.allSettled([
 captureCompetitiveIntel(clientId, plainText, meetingTitle),
 detectIcpDrift(clientId, plainText, meetingTitle),
 summarizeExecutiveSync(clientId, plainText, meetingTitle, meetingType),
 extractStrategyInputs(clientId, plainText, meetingTitle, meetingType)
 ]);
}

module.exports = { runPostIngestAnalysis };