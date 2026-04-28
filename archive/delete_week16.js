#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function deleteWeek16Memories() {
    console.log('Fetching week_16 campaign_metric and personal_performance memories...');
    // Fetch memories with tags containing week_16 and type in the list
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.\{week_16}&type=in.(campaign_metric,personal_performance)&select=id,type,content,tags`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Fetch failed: ${err}`);
    }
    const memories = await response.json();
    console.log(`Found ${memories.length} week_16 memories.`);
    if (memories.length === 0) {
        console.log('No week_16 memories to delete.');
        return;
    }
    // Delete each memory
    for (const mem of memories) {
        const deleteUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${mem.id}`;
        const deleteRes = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
        });
        if (!deleteRes.ok) {
            console.error(`Failed to delete memory ${mem.id}: ${deleteRes.statusText}`);
        } else {
            console.log(`Deleted ${mem.type} (id: ${mem.id})`);
        }
    }
    console.log('Deletion completed.');
}

deleteWeek16Memories().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});