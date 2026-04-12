#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
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

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

function cleanupOldBackups(retentionDays = 7) {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('memories_') && f.endsWith('.json'));
    const now = Date.now();
    const cutoff = now - (retentionDays * 24 * 60 * 60 * 1000);
    
    files.forEach(filename => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filepath);
        if (stats.mtimeMs < cutoff) {
            console.log(`Deleting old backup: ${filename}`);
            fs.unlinkSync(filepath);
        }
    });
}

async function main() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Missing Supabase environment variables');
        process.exit(1);
    }
    
    ensureBackupDir();
    
    console.log('Fetching all memories for backup...');
    const memories = await fetchAllMemories();
    console.log(`Fetched ${memories.length} memories.`);
    
    // Prepare backup data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().getTime().toString().slice(-6);
    const backupData = {
        metadata: {
            created_at: new Date().toISOString(),
            total_memories: memories.length,
            source: 'supabase',
            schema_version: '1.0'
        },
        memories: memories.map(mem => ({
            id: mem.id,
            type: mem.type,
            content: mem.content,
            embedding: mem.embedding, // keep as-is (string or array)
            importance: mem.importance,
            tags: mem.tags,
            created_at: mem.created_at,
            parent_id: mem.parent_id,
            last_accessed: mem.last_accessed,
            access_count: mem.access_count
        }))
    };
    
    const filename = `memories_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    console.log(`Backup saved to ${filepath}`);
    
    // Cleanup old backups
    cleanupOldBackups();
    
    // Also create a symlink to latest backup for easy recovery
    const latestPath = path.join(BACKUP_DIR, 'memories_latest.json');
    try {
        if (fs.existsSync(latestPath)) {
            fs.unlinkSync(latestPath);
        }
        fs.symlinkSync(filepath, latestPath);
        console.log('Latest backup symlink updated.');
    } catch (err) {
        console.warn('Could not create latest symlink:', err.message);
    }
}

main().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
});