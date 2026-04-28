#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { clients } = require('../clients/registry.js');

/**
 * Get current ISO week number.
 */
function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
}

/**
 * Parse campaign metric from memory content.
 * Returns object with pitches, meetingsBooked, voicemails, followUps, meetingsPending, ratio.
 */
function parseMetricContent(content) {
    // Example: "Campaign metrics for OPP Agency: 30 pitches, 1 meetings booked, 15 voicemails, 10 follow-ups, 2 meetings pending. Pitch-to-meeting ratio: 30.00:1"
    const pitchesMatch = content.match(/(\d+)\s*pitches/);
    const meetingsBookedMatch = content.match(/(\d+)\s*meetings booked/);
    const voicemailsMatch = content.match(/(\d+)\s*voicemails/);
    const followUpsMatch = content.match(/(\d+)\s*follow-ups/);
    const meetingsPendingMatch = content.match(/(\d+)\s*meetings pending/);
    const ratioMatch = content.match(/ratio:\s*([\d.]+):1/);
    return {
        pitches: pitchesMatch ? parseInt(pitchesMatch[1]) : 0,
        meetingsBooked: meetingsBookedMatch ? parseInt(meetingsBookedMatch[1]) : 0,
        voicemails: voicemailsMatch ? parseInt(voicemailsMatch[1]) : 0,
        followUps: followUpsMatch ? parseInt(followUpsMatch[1]) : 0,
        meetingsPending: meetingsPendingMatch ? parseInt(meetingsPendingMatch[1]) : 0,
        ratio: ratioMatch ? parseFloat(ratioMatch[1]) : Infinity,
    };
}

/**
 * Fetch all campaign metrics for a given week.
 */
async function fetchWeekMetrics(week) {
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.\{campaign_metric}&select=id,content,tags,created_at`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch campaign metrics: ${response.status} ${response.statusText}`);
    }
    const memories = await response.json();
    // Filter by week tag
    const weekTag = `week_${week}`;
    const weekMemories = memories.filter(m => m.tags && m.tags.includes(weekTag));
    return weekMemories;
}

/**
 * Group metrics by client ID.
 */
function groupByClient(memories) {
    const groups = {};
    for (const mem of memories) {
        const clientTag = mem.tags.find(t => clients.some(c => c.id === t));
        if (!clientTag) continue;
        if (!groups[clientTag]) groups[clientTag] = [];
        groups[clientTag].push(mem);
    }
    return groups;
}

/**
 * Aggregate metrics per client (sum of all metrics for the week).
 */
function aggregateClientMetrics(clientId, memories) {
    let total = { pitches: 0, meetingsBooked: 0, voicemails: 0, followUps: 0, meetingsPending: 0 };
    for (const mem of memories) {
        const parsed = parseMetricContent(mem.content);
        total.pitches += parsed.pitches;
        total.meetingsBooked += parsed.meetingsBooked;
        total.voicemails += parsed.voicemails;
        total.followUps += parsed.followUps;
        total.meetingsPending += parsed.meetingsPending;
    }
    total.ratio = total.meetingsBooked === 0 ? Infinity : (total.pitches / total.meetingsBooked).toFixed(2);
    return total;
}

/**
 * Compare week-over-week changes.
 */
function compareWeeks(currentWeekData, previousWeekData) {
    const changes = {};
    for (const clientId in currentWeekData) {
        const current = currentWeekData[clientId];
        const previous = previousWeekData[clientId];
        if (previous) {
            changes[clientId] = {
                pitches: current.pitches - previous.pitches,
                meetingsBooked: current.meetingsBooked - previous.meetingsBooked,
                ratioChange: current.ratio - previous.ratio,
            };
        } else {
            changes[clientId] = {
                pitches: current.pitches,
                meetingsBooked: current.meetingsBooked,
                ratioChange: null,
            };
        }
    }
    return changes;
}

/**
 * Generate summary for current week.
 */
async function generateSummary() {
    const currentWeek = getCurrentWeek();
    const previousWeek = currentWeek - 1;
    
    const currentMemories = await fetchWeekMetrics(currentWeek);
    const previousMemories = await fetchWeekMetrics(previousWeek);
    
    const currentGroups = groupByClient(currentMemories);
    const previousGroups = groupByClient(previousMemories);
    
    const currentData = {};
    const previousData = {};
    
    for (const clientId in currentGroups) {
        currentData[clientId] = aggregateClientMetrics(clientId, currentGroups[clientId]);
    }
    for (const clientId in previousGroups) {
        previousData[clientId] = aggregateClientMetrics(clientId, previousGroups[clientId]);
    }
    
    const changes = compareWeeks(currentData, previousData);
    
    // Find best/worst performing client (by ratio, excluding Infinity)
    let bestClient = null;
    let worstClient = null;
    for (const clientId in currentData) {
        const ratio = currentData[clientId].ratio;
        if (ratio === Infinity) continue;
        if (!bestClient || ratio < bestClient.ratio) bestClient = { clientId, ...currentData[clientId] };
        if (!worstClient || ratio > worstClient.ratio) worstClient = { clientId, ...currentData[clientId] };
    }
    
    // Count red flags (pitches >=25, meetingsBooked == 0)
    const redFlags = Object.entries(currentData).filter(([clientId, data]) => data.pitches >= 25 && data.meetingsBooked === 0);
    
    return {
        week: currentWeek,
        perClient: currentData,
        weekOverWeek: changes,
        bestClient,
        worstClient,
        redFlags: redFlags.map(([clientId]) => clientId),
        totalPitches: Object.values(currentData).reduce((sum, d) => sum + d.pitches, 0),
        totalMeetings: Object.values(currentData).reduce((sum, d) => sum + d.meetingsBooked, 0),
    };
}

/**
 * Command-line interface.
 */
async function main() {
    try {
        const summary = await generateSummary();
        console.log(JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error('Error generating summary:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateSummary, parseMetricContent, getCurrentWeek };