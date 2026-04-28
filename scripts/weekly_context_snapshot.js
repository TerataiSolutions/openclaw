'use strict';

const fs = require('fs');
const path = require('path');
const { retrySupabaseCall, logJson } = require('../utils.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPORTS_DIR = '/data/.openclaw/workspace/exports';
const CLIENTS = ['opp', 'customer_contact_services', 'sturdy', 'seneca_global', 'pecan'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function fetchUrl(url) {
  return retrySupabaseCall(async () => {
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`);
    return res.json();
  });
}

const base = () => `${SUPABASE_URL}/rest/v1/memories`;
const fetchClientState = id => fetchUrl(`${base()}?client_id=eq.${id}&order=created_at.desc&limit=5&select=type,content,importance,created_at,tags`);
const fetchTopByImportance = () => fetchUrl(`${base()}?order=importance.desc,created_at.desc&limit=10&select=type,content,importance,created_at,tags,client_id`);
const fetchOpenTasks = () => fetchUrl(`${base()}?type=eq.task&tags=not.cs.{resolved}&order=importance.desc&limit=30&select=type,content,importance,created_at,tags,client_id`);
const fetchPatterns = () => fetchUrl(`${base()}?type=eq.pattern_detected&order=created_at.desc&limit=10&select=type,content,importance,created_at,tags`);
const fetchUserPreferences = () => fetchUrl(`${base()}?type=eq.user_preference&order=importance.desc&limit=20&select=type,content,importance,created_at,tags`);

function fmt(mem) {
  const date = (mem.created_at || '').slice(0, 10);
  return `- [${date}] (importance: ${mem.importance}) ${mem.content.slice(0, 300)}${mem.content.length > 300 ? '...' : ''}\n  tags: ${(mem.tags || []).join(', ')}`;
}

async function main() {
  logJson('info', { event: 'weekly_context_snapshot_start' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const lines = [`# Weekly Context Snapshot`, `**Generated:** ${todayStr()}\n**System:** Aether-7\n`, `## Client State`];

  for (const clientId of CLIENTS) {
    const mems = await fetchClientState(clientId);
    lines.push(`\n### ${clientId.replace(/_/g, ' ')}`);
    if (!mems || mems.length === 0) lines.push('No recent memories found.');
    else mems.forEach(m => lines.push(fmt(m)));
  }

  lines.push('\n## Top 10 Memories by Importance');
  (await fetchTopByImportance() || []).forEach(m => lines.push(fmt(m)));

  lines.push('\n## Open Tasks');
  const tasks = await fetchOpenTasks();
  if (tasks && tasks.length > 0) tasks.forEach(m => lines.push(fmt(m)));
  else lines.push('No open tasks found.');

  lines.push('\n## Active Patterns');
  const patterns = await fetchPatterns();
  if (patterns && patterns.length > 0) patterns.forEach(m => lines.push(fmt(m)));
  else lines.push('No patterns currently detected.');

  lines.push('\n## User Working Preferences and Communication Style');
  const prefs = await fetchUserPreferences();
  if (prefs && prefs.length > 0) prefs.forEach(m => lines.push(fmt(m)));
  else lines.push('No user preference memories found.');

  const filepath = path.join(EXPORTS_DIR, `weekly_context_snapshot_${todayStr()}.md`);
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
  logJson('info', { event: 'weekly_context_snapshot_written', filepath });
  console.log(`Snapshot written to ${filepath}`);
}

main().catch(err => { logJson('error', { event: 'weekly_context_snapshot_fatal', error: err.message }); process.exit(1); });