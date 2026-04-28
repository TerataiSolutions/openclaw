'use strict';

const { retrySupabaseCall, logJson } = require('../utils.js');
const { execSync } = require('child_process');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PITCH_RED_FLAG_RATIO = 25;

function sevenDaysAgo() { return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); }

async function fetchMemoriesByTypes(types) {
  const typeFilter = types.map(t => `type.eq.${t}`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/memories?or=(${typeFilter})&created_at=gte.${sevenDaysAgo()}&order=importance.desc&limit=50&select=type,content,importance,created_at,tags,client_id`;
  return retrySupabaseCall(async () => {
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`);
    return res.json();
  });
}

function parseCallActivity(memories) {
  const callMems = memories.filter(m => m.type === 'call_activity');
  if (callMems.length === 0) return null;
  let totalPitches = 0, totalMeetings = 0, redFlagDays = 0;
  for (const mem of callMems) {
    const pitches = parseInt((mem.content.match(/(\d+)\s+pitch/i) || [])[1] || 0);
    const meetings = parseInt((mem.content.match(/(\d+)\s+meeting/i) || [])[1] || 0);
    totalPitches += pitches; totalMeetings += meetings;
    if (meetings === 0 || pitches / meetings > PITCH_RED_FLAG_RATIO) redFlagDays++;
  }
  const overallRatio = totalMeetings > 0 ? Math.round(totalPitches / totalMeetings) : null;
  return { totalPitches, totalMeetings, overallRatio, redFlagDays, callDays: callMems.length, onTrack: overallRatio !== null && overallRatio <= PITCH_RED_FLAG_RATIO && redFlagDays === 0 };
}

function buildBriefing(memories, callData) {
  const lines = [];
  if (!callData) lines.push('No call activity logged last week. Worth checking whether that is a tracking gap or a true activity gap.');
  else if (callData.totalPitches === 0) lines.push('No call activity logged last week.');
  else if (callData.overallRatio === null) lines.push(`${callData.totalPitches} pitches logged last week with 0 meetings booked. That is a red flag and needs to be addressed before this week's calls start.`);
  else if (callData.onTrack) lines.push(`Call performance last week: ${callData.totalPitches} pitches, ${callData.totalMeetings} meetings — a 1:${callData.overallRatio} ratio. On track against the 1:25 benchmark.`);
  else lines.push(`Call performance last week: ${callData.totalPitches} pitches, ${callData.totalMeetings} meetings — a 1:${callData.overallRatio} ratio. ${callData.redFlagDays} day(s) hit the red flag threshold. Worth reviewing before today's calls.`);

  const marketMems = memories.filter(m => m.type === 'market_signal');
  if (marketMems.length > 0) {
    const clientSignals = {};
    for (const mem of marketMems) { const cid = mem.client_id || 'unknown'; if (!clientSignals[cid]) clientSignals[cid] = []; clientSignals[cid].push(mem.content.slice(0, 150)); }
    lines.push(`New market signals this week: ${Object.entries(clientSignals).map(([cid, items]) => `${cid}: ${items[0]}`).join(' — ')}`);
  } else lines.push('No new market signals detected across clients this week.');

  const patternMems = memories.filter(m => m.type === 'pattern_detected');
  if (patternMems.length > 0) lines.push(`Pattern worth acting on: ${patternMems[0].content.slice(0, 200)}`);

  if (callData && !callData.onTrack && callData.totalMeetings < callData.callDays) lines.push('Given the call ratio last week, the highest-leverage move this week is a messaging review before Monday afternoon calls — specifically the first 10 seconds of the cold open.');
  else if (marketMems.length > 0) lines.push(`With ${marketMems.length} client(s) showing recent content activity, now is a strong time to personalize outreach around what they have been publishing.`);
  else if (patternMems.length > 0) lines.push('The detected pattern is worth a team sync before this week closes — patterns that repeat across clients usually signal a systemic fix, not a one-off adjustment.');
  else lines.push('Clean week. Focus on volume and make sure call activity is getting logged daily so we have clean data for next Monday.');

  return lines.join('\n\n');
}

async function sendDiscordDM(message) {
  try { execSync(`node /data/.openclaw/workspace/cron/message_bridge.js ${JSON.stringify(message)}`, { stdio: 'inherit' }); }
  catch (err) { logJson('error', { event: 'discord_send_failed', error: err.message }); }
}

async function main() {
  logJson('info', { event: 'monday_briefing_start' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }
  const memories = await fetchMemoriesByTypes(['call_activity', 'market_signal', 'pattern_detected', 'meeting_transcript', 'client_update']);
  if (!memories) { await sendDiscordDM("Monday briefing could not load last week's memories. Check Supabase connection."); return; }
  await sendDiscordDM(buildBriefing(memories, parseCallActivity(memories)));
  logJson('info', { event: 'monday_briefing_sent', memory_count: memories.length });
}

main().catch(err => { logJson('error', { event: 'monday_briefing_fatal', error: err.message }); process.exit(1); });