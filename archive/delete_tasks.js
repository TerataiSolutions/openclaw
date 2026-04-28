#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const taskIdsToDelete = [
    'e7b41a16-33fb-4b7b-b874-90a7fade1654', // pending TOOLS.md update
    '915e7119-cf26-4040-bd51-03dad0f21310', // proper embedding provider needed
    '016323cd-9d12-40f2-ba93-5d8f754865e4', // options include Cohere...
];

async function deleteTask(id) {
    const url = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
    });
    if (!response.ok) {
        const err = await response.text();
        console.error(`Failed to delete ${id}: ${err}`);
        return false;
    }
    console.log(`Deleted task ${id}`);
    return true;
}

async function main() {
    for (const id of taskIdsToDelete) {
        await deleteTask(id);
    }
    console.log('Deletion completed.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});