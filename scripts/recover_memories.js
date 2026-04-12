#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

async function fetchAllMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=*`;
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

async function loadBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
    }
    const data = fs.readFileSync(backupPath, 'utf8');
    return JSON.parse(data);
}

async function generateEmbedding(text) {
    if (!COHERE_API_KEY) {
        throw new Error('COHERE_API_KEY not set');
    }
    
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            texts: [text],
            model: 'embed-english-v3.0',
            input_type: 'search_document'
        }),
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cohere API error: ${response.status} ${error}`);
    }
    
    const result = await response.json();
    return result.embeddings[0];
}

async function restoreMemory(memory, force = false) {
    const { id, content, embedding, ...rest } = memory;
    
    // Check if memory already exists
    const checkUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
    const checkResponse = await fetch(checkUrl, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    
    if (checkResponse.ok) {
        const existing = await checkResponse.json();
        if (existing.length > 0) {
            if (!force) {
                console.log(`Memory ${id} already exists. Skipping.`);
                return { restored: false, reason: 'exists' };
            }
            // Force restore: update existing
            console.log(`Memory ${id} exists, forcing update...`);
            const updateUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
            const updateResponse = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ content, embedding, ...rest }),
            });
            if (!updateResponse.ok) {
                throw new Error(`Failed to update memory ${id}: ${updateResponse.statusText}`);
            }
            console.log(`Memory ${id} updated.`);
            return { restored: true, action: 'updated' };
        }
    }
    
    // Insert new memory
    const insertUrl = `${SUPABASE_URL}/rest/v1/memories`;
    const insertResponse = await fetch(insertUrl, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(memory),
    });
    
    if (!insertResponse.ok) {
        throw new Error(`Failed to insert memory ${id}: ${insertResponse.statusText}`);
    }
    console.log(`Memory ${id} restored.`);
    return { restored: true, action: 'inserted' };
}

async function regenerateMissingEmbeddings(memory) {
    if (memory.embedding === null || memory.embedding === undefined) {
        console.log(`Regenerating embedding for memory ${memory.id}...`);
        try {
            const embedding = await generateEmbedding(memory.content);
            memory.embedding = embedding;
            return true;
        } catch (err) {
            console.error(`Failed to regenerate embedding for ${memory.id}:`, err.message);
            return false;
        }
    }
    return false;
}

async function main() {
    const args = process.argv.slice(2);
    const backupPath = args[0] || path.join(BACKUP_DIR, 'memories_latest.json');
    const force = args.includes('--force');
    const regenerate = args.includes('--regenerate');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Missing Supabase environment variables');
        process.exit(1);
    }
    
    console.log(`Loading backup from ${backupPath}...`);
    const backup = await loadBackup(backupPath);
    console.log(`Backup contains ${backup.memories.length} memories.`);
    
    console.log('Fetching current memories...');
    const current = await fetchAllMemories();
    console.log(`Current database has ${current.length} memories.`);
    
    // Create maps for comparison
    const currentMap = new Map(current.map(m => [m.id, m]));
    const backupMap = new Map(backup.memories.map(m => [m.id, m]));
    
    const missing = backup.memories.filter(m => !currentMap.has(m.id));
    const different = backup.memories.filter(m => {
        const curr = currentMap.get(m.id);
        return curr && JSON.stringify(curr.content) !== JSON.stringify(m.content);
    });
    
    console.log(`Missing: ${missing.length}, Different content: ${different.length}`);
    
    if (missing.length === 0 && different.length === 0 && !force && !regenerate) {
        console.log('No recovery needed.');
        return;
    }
    
    // Process missing memories
    let restored = 0;
    for (const memory of missing) {
        if (regenerate) {
            await regenerateMissingEmbeddings(memory);
        }
        const result = await restoreMemory(memory, false);
        if (result.restored) restored++;
    }
    
    // Process different memories (if force flag)
    let updated = 0;
    if (force && different.length > 0) {
        console.log('Forcing updates for different memories...');
        for (const memory of different) {
            if (regenerate) {
                await regenerateMissingEmbeddings(memory);
            }
            const result = await restoreMemory(memory, true);
            if (result.restored && result.action === 'updated') updated++;
        }
    }
    
    // Check for missing embeddings in current database
    if (regenerate) {
        console.log('Checking for missing embeddings in current database...');
        let regenerated = 0;
        for (const memory of current) {
            if (memory.embedding === null || memory.embedding === undefined) {
                console.log(`Regenerating embedding for existing memory ${memory.id}...`);
                try {
                    const embedding = await generateEmbedding(memory.content);
                    const updateUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${memory.id}`;
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ embedding }),
                    });
                    regenerated++;
                } catch (err) {
                    console.error(`Failed to regenerate embedding for ${memory.id}:`, err.message);
                }
            }
        }
        console.log(`Regenerated ${regenerated} embeddings.`);
    }
    
    console.log(`Recovery complete. Restored: ${restored}, Updated: ${updated}`);
}

main().catch(err => {
    console.error('Recovery failed:', err);
    process.exit(1);
});