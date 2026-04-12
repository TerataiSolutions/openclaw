#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { sendMessage } = require('../discord.js');

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,embedding,created_at`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function isZeroVector(arr) {
    return Array.isArray(arr) && arr.slice(0, 10).every(v => Math.abs(v) < 1e-9);
}

async function main() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log('Fetching memories...');
    const memories = await fetchMemories();
    
    const total = memories.length;
    const addedThisWeek = memories.filter(m => new Date(m.created_at) >= oneWeekAgo).length;
    
    // Breakdown by type
    const typeCount = {};
    memories.forEach(m => {
        typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    });
    const breakdown = Object.entries(typeCount).map(([type, count]) => `${type}: ${count}`).join(', ');
    
    // Integrity issues
    const nullEmbeddings = memories.filter(m => m.embedding === null).length;
    let zeroVectors = 0;
    memories.forEach(m => {
        if (m.embedding && typeof m.embedding === 'string') {
            try {
                const vec = JSON.parse(m.embedding);
                if (isZeroVector(vec)) zeroVectors++;
            } catch (e) {}
        }
    });
    const integrity = (nullEmbeddings === 0 && zeroVectors === 0) ? 'CLEAN' : `ISSUES (NULL: ${nullEmbeddings}, zero‑vector: ${zeroVectors})`;
    
    // Oldest unresolved task memory
    const taskMemories = memories.filter(m => m.type === 'task');
    let oldestTask = null;
    if (taskMemories.length > 0) {
        oldestTask = taskMemories.reduce((oldest, curr) => 
            new Date(curr.created_at) < new Date(oldest.created_at) ? curr : oldest
        );
    }
    
    const reportDate = now.toISOString().split('T')[0];
    const report = `Weekly Memory Report — ${reportDate}
Total memories: ${total}
Added this week: ${addedThisWeek}
By type: ${breakdown}
Integrity: ${integrity}
${oldestTask ? `Oldest open task: "${oldestTask.content.substring(0, 120)}" — ${Math.floor((now - new Date(oldestTask.created_at)) / (1000 * 60 * 60 * 24))} days old` : 'No task memories.'}`;
    
    console.log(report);
    const sent = await sendMessage(report);
    if (!sent) console.error('Failed to send Discord message');
    process.exit(0);
}

main().catch(err => {
    console.error('Error generating weekly memory report:', err);
    process.exit(1);
});