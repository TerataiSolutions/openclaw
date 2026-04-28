#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fetchAllEmbeddings() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding`;
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
    const memories = await response.json();
    return memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        embedding: typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding,
    }));
}

function isZeroVector(arr) {
    return Array.isArray(arr) && arr.every(v => Math.abs(v) < 1e-9);
}

async function main() {
    const memories = await fetchAllEmbeddings();
    const zeroVectors = memories.filter(m => isZeroVector(m.embedding));
    console.log(`Total memories: ${memories.length}`);
    console.log(`Zero‑vector memories: ${zeroVectors.length}`);
    if (zeroVectors.length > 0) {
        console.log('\nZero‑vector memory IDs:');
        zeroVectors.forEach(m => console.log(`  ${m.id} - ${m.content.substring(0, 80)}...`));
    }
}

main().catch(err => console.error('Error:', err));