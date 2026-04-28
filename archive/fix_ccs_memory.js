#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
    console.log('Searching for memory with injection_suspect tag and client_id customer_contact_services...');
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{injection_suspect}&client_id=eq.customer_contact_services&select=id,content,tags`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        console.error(`Failed to fetch: ${res.status} ${await res.text()}`);
        process.exit(1);
    }
    const memories = await res.json();
    console.log(`Found ${memories.length} memories`);
    for (const mem of memories) {
        console.log(`Memory ID: ${mem.id}`);
        console.log(`Content snippet: ${mem.content.substring(0, 200)}`);
        console.log(`Tags: ${JSON.stringify(mem.tags)}`);
        // Remove injection_suspect tag
        const newTags = mem.tags.filter(t => t !== 'injection_suspect');
        // Add calendly_link tag if not present
        if (!newTags.includes('calendly_link')) {
            newTags.push('calendly_link');
        }
        // Update memory
        const patchUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${mem.id}`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ tags: newTags })
        });
        if (!patchRes.ok) {
            console.error(`Failed to update memory ${mem.id}: ${patchRes.status} ${await patchRes.text()}`);
        } else {
            console.log(`Updated memory ${mem.id}. New tags: ${JSON.stringify(newTags)}`);
        }
    }
    console.log('Done.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});