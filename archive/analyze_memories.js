#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchAllMemories() {
    const response = await fetch(SUPABASE_URL + '/rest/v1/memories?order=created_at.desc&select=type,content,importance,tags,created_at', {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`);
    }
    return await response.json();
}

function extractObservations(memories) {
    const observations = {
        preferences: [],
        personality: [],
        goals: [],
        frustrations: [],
        patterns: [],
        other: []
    };
    memories.forEach(mem => {
        const content = mem.content.toLowerCase();
        if (mem.type === 'user_preference') {
            observations.preferences.push(mem.content);
        } else if (mem.type === 'user_fact') {
            // Could be facts about user
            observations.personality.push(mem.content);
        } else if (mem.type === 'pattern' || mem.type === 'self_insight') {
            observations.patterns.push(mem.content);
        }
        // Heuristic classification based on keywords
        if (content.includes('like') || content.includes('prefer') || content.includes('want') || content.includes('wants') || content.includes('expect')) {
            observations.preferences.push(mem.content);
        } else if (content.includes('goal') || content.includes('aim') || content.includes('target') || content.includes('objective')) {
            observations.goals.push(mem.content);
        } else if (content.includes('frustrat') || content.includes('annoy') || content.includes('block') || content.includes('hard') || content.includes('struggle')) {
            observations.frustrations.push(mem.content);
        } else if (content.includes('personality') || content.includes('trait') || content.includes('character')) {
            observations.personality.push(mem.content);
        }
    });
    // Deduplicate
    Object.keys(observations).forEach(k => {
        observations[k] = [...new Set(observations[k])];
    });
    return observations;
}

async function main() {
    console.log('Fetching all memories...');
    const memories = await fetchAllMemories();
    console.log(`Total memories: ${memories.length}`);
    const obs = extractObservations(memories);
    console.log('\n=== OBSERVATIONS ===');
    console.log('\nPreferences:');
    obs.preferences.forEach(p => console.log(' -', p));
    console.log('\nPersonality traits:');
    obs.personality.forEach(p => console.log(' -', p));
    console.log('\nGoals:');
    obs.goals.forEach(g => console.log(' -', g));
    console.log('\nFrustrations:');
    obs.frustrations.forEach(f => console.log(' -', f));
    console.log('\nPatterns:');
    obs.patterns.forEach(p => console.log(' -', p));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});