#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Parse personal performance memory content.
 */
function parsePerformanceContent(content) {
    // Example: "Personal performance: 20 pitches, 1 meetings booked, 8 voicemails, 5 follow-ups, 1 meetings pending. Ratio: 20.00:1"
    const pitchesMatch = content.match(/(\d+)\s*pitches/);
    const meetingsBookedMatch = content.match(/(\d+)\s*meetings booked/);
    const voicemailsMatch = content.match(/(\d+)\s*voicemails/);
    const followUpsMatch = content.match(/(\d+)\s*follow-ups/);
    const meetingsPendingMatch = content.match(/(\d+)\s*meetings pending/);
    const ratioMatch = content.match(/Ratio:\s*([\d.]+):1/);
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
 * Fetch all personal performance memories.
 */
async function fetchPerformanceMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.personal_performance&select=id,content,created_at&order=created_at.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch performance memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Group memories by day of week.
 */
function groupByDay(memories) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const groups = {};
    days.forEach(d => groups[d] = { pitches: 0, meetingsBooked: 0, count: 0 });
    
    for (const mem of memories) {
        const date = new Date(mem.created_at);
        const dayName = days[date.getUTCDay()];
        const parsed = parsePerformanceContent(mem.content);
        groups[dayName].pitches += parsed.pitches;
        groups[dayName].meetingsBooked += parsed.meetingsBooked;
        groups[dayName].count += 1;
    }
    return groups;
}

/**
 * Compute correlation between pitches and meetings booked.
 */
function computeCorrelation(memories) {
    const data = memories.map(mem => {
        const parsed = parsePerformanceContent(mem.content);
        return { pitches: parsed.pitches, meetings: parsed.meetingsBooked };
    });
    if (data.length < 2) return null;
    
    const sum = data.reduce((acc, d) => ({ pitches: acc.pitches + d.pitches, meetings: acc.meetings + d.meetings }), { pitches: 0, meetings: 0 });
    const meanPitches = sum.pitches / data.length;
    const meanMeetings = sum.meetings / data.length;
    
    let numerator = 0;
    let denomPitches = 0;
    let denomMeetings = 0;
    for (const d of data) {
        numerator += (d.pitches - meanPitches) * (d.meetings - meanMeetings);
        denomPitches += Math.pow(d.pitches - meanPitches, 2);
        denomMeetings += Math.pow(d.meetings - meanMeetings, 2);
    }
    const correlation = numerator / Math.sqrt(denomPitches * denomMeetings);
    return isNaN(correlation) ? null : correlation;
}

/**
 * Generate one actionable insight.
 */
async function generateInsight() {
    const memories = await fetchPerformanceMemories();
    if (memories.length === 0) {
        return 'No personal performance data yet. Start logging activity with "Log my activity: ..."';
    }
    
    // 1. Best performing day
    const byDay = groupByDay(memories);
    let bestDay = null;
    let bestRatio = Infinity;
    for (const day in byDay) {
        const data = byDay[day];
        if (data.count === 0) continue;
        const ratio = data.meetingsBooked === 0 ? Infinity : data.pitches / data.meetingsBooked;
        if (ratio < bestRatio) {
            bestRatio = ratio;
            bestDay = day;
        }
    }
    
    // 2. Correlation between volume and meetings
    const correlation = computeCorrelation(memories);
    let correlationText = '';
    if (correlation !== null) {
        if (correlation > 0.5) {
            correlationText = 'Strong positive correlation: more pitches tend to lead to more meetings.';
        } else if (correlation > 0) {
            correlationText = 'Moderate positive correlation: increasing pitch volume helps, but quality matters too.';
        } else if (correlation < -0.5) {
            correlationText = 'Negative correlation: more pitches associated with fewer meetings—review targeting.';
        } else {
            correlationText = 'Weak correlation: pitch volume alone does not predict meetings.';
        }
    }
    
    // 3. Recent trend (last week vs previous)
    const recent = memories.slice(0, 7); // last 7 entries
    const older = memories.slice(7, 14);
    let trend = '';
    if (recent.length >= 3 && older.length >= 3) {
        const recentMeetings = recent.reduce((sum, m) => sum + parsePerformanceContent(m.content).meetingsBooked, 0);
        const olderMeetings = older.reduce((sum, m) => sum + parsePerformanceContent(m.content).meetingsBooked, 0);
        if (recentMeetings > olderMeetings) {
            trend = `Meetings trending up (${recentMeetings} vs ${olderMeetings} previous period).`;
        } else if (recentMeetings < olderMeetings) {
            trend = `Meetings trending down (${recentMeetings} vs ${olderMeetings} previous period).`;
        } else {
            trend = 'Meetings stable.';
        }
    }
    
    // Compose insight
    const insights = [];
    if (bestDay && bestRatio < Infinity) {
        insights.push(`Your best performing day is ${bestDay} (ratio ${bestRatio.toFixed(1)}:1).`);
    }
    if (correlationText) {
        insights.push(correlationText);
    }
    if (trend) {
        insights.push(trend);
    }
    if (insights.length === 0) {
        insights.push('Keep logging activity to generate insights.');
    }
    
    return insights.join(' ');
}

/**
 * Command-line interface.
 */
async function main() {
    try {
        const insight = await generateInsight();
        console.log(insight);
    } catch (err) {
        console.error('Error generating insight:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateInsight, parsePerformanceContent };