#!/usr/bin/env node

/**
 * daily_summary.js — Proactive pattern push to Discord.
 *
 * Queries the last 24 hours for pattern_detected memories and surfaces
 * the top 3 by importance. Runs daily at 8:15 AM ET alongside the morning
 * briefing.
 *
 * This closes the gap identified in the production audit: pattern_detection.js
 * creates patterns, but nothing was reading and acting on them.
 */

const { getSupabaseClient } = require('../lib/clients/supabase');
const { sendDiscordAlert } = require('../lib/clients/discord');

async function generateDailySummary() {
  try {
    const sb = getSupabaseClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: patterns, error } = await sb
      .from('memories')
      .select('content, importance, created_at')
      .eq('type', 'pattern_detected')
      .gte('created_at', cutoff);

    if (error) {
      console.error('Query failed:', error.message);
      return;
    }

    if (!patterns || patterns.length === 0) {
      console.log('No patterns detected in the last 24 hours.');
      return;
    }

    const top = patterns
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
      .map(p => {
        const date = p.created_at.slice(0, 10);
        return `• [${date}] ${p.content}`;
      })
      .join('\n');

    const header = patterns.length > 3
      ? `📊 **${patterns.length} patterns detected in the last 24h** — top 3:`
      : `📊 **${patterns.length} pattern${patterns.length === 1 ? '' : 's'} detected:**`;

    await sendDiscordAlert(`${header}\n${top}`);
    console.log(`Daily summary sent: ${patterns.length} patterns, top 3 displayed.`);
  } catch (error) {
    console.error('Daily summary failed:', error.message);
  }
}

if (require.main === module) {
  generateDailySummary();
}

module.exports = { generateDailySummary };
