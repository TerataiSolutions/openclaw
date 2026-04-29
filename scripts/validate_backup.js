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

async function loadBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
    }
    const data = fs.readFileSync(backupPath, 'utf8');
    return JSON.parse(data);
}

function validateBackupStructure(backup) {
    const errors = [];
    
    if (!backup.metadata) {
        errors.push('Missing metadata');
    } else {
        if (!backup.metadata.created_at) errors.push('Missing metadata.created_at');
        if (backup.metadata.total_memories === undefined) errors.push('Missing metadata.total_memories');
    }
    
    if (!Array.isArray(backup.memories)) {
        errors.push('memories is not an array');
        return errors;
    }
    
    // Check each memory has required fields
    backup.memories.forEach((mem, idx) => {
        if (!mem.id) errors.push(`Memory ${idx} missing id`);
        if (!mem.content) errors.push(`Memory ${idx} missing content`);
        if (mem.importance === undefined) errors.push(`Memory ${idx} missing importance`);
        if (!mem.type) errors.push(`Memory ${idx} missing type`);
        if (!mem.created_at) errors.push(`Memory ${idx} missing created_at`);
    });
    
    return errors;
}

function isZeroVector(embedding) {
    if (!embedding) return false;
    const arr = Array.isArray(embedding) ? embedding : JSON.parse(embedding);
    return arr.slice(0, 10).every(v => Math.abs(v) < 1e-9);
}

async function main() {
    const args = process.argv.slice(2);
    const positionalArgs = args.filter(a => !a.startsWith('--'));
    const backupPath = positionalArgs[0] || path.join(BACKUP_DIR, 'memories_latest.json');
    const compare = args.includes('--compare');
    
    console.log(`Validating backup: ${backupPath}`);
    
    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
        console.error('Backup file does not exist.');
        process.exit(1);
    }
    
    // Load and validate backup
    let backup;
    try {
        backup = await loadBackup(backupPath);
    } catch (err) {
        console.error('Failed to load backup:', err.message);
        process.exit(1);
    }
    
    const structureErrors = validateBackupStructure(backup);
    if (structureErrors.length > 0) {
        console.error('Backup structure errors:');
        structureErrors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
    }
    
    console.log(`✓ Backup structure valid (${backup.memories.length} memories)`);
    
    // Check for zero-vector embeddings
    const zeroVectorCount = backup.memories.filter(m => isZeroVector(m.embedding)).length;
    if (zeroVectorCount > 0) {
        console.warn(`⚠️  Found ${zeroVectorCount} memories with zero-vector embeddings`);
    }
    
    // Check for null embeddings
    const nullEmbeddingCount = backup.memories.filter(m => m.embedding === null || m.embedding === undefined).length;
    if (nullEmbeddingCount > 0) {
        console.warn(`⚠️  Found ${nullEmbeddingCount} memories with null embeddings`);
    }
    
    // Compare with live database if requested
    if (compare) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Cannot compare: Missing Supabase environment variables');
            process.exit(1);
        }
        
        console.log('Fetching live memories for comparison...');
        let current;
        try {
            current = await fetchAllMemories();
        } catch (err) {
            console.error('Failed to fetch live memories:', err.message);
            process.exit(1);
        }
        
        const currentMap = new Map(current.map(m => [m.id, m]));
        const backupMap = new Map(backup.memories.map(m => [m.id, m]));
        
        const missingInLive = backup.memories.filter(m => !currentMap.has(m.id));
        const missingInBackup = current.filter(m => !backupMap.has(m.id));
        const differentContent = backup.memories.filter(m => {
            const curr = currentMap.get(m.id);
            return curr && JSON.stringify(curr.content) !== JSON.stringify(m.content);
        });
        
        console.log('\nComparison results:');
        console.log(`  Memories in backup but not in live: ${missingInLive.length}`);
        console.log(`  Memories in live but not in backup: ${missingInBackup.length}`);
        console.log(`  Memories with different content: ${differentContent.length}`);
        
        if (missingInLive.length > 0) {
            console.log('\nMissing in live database:');
            missingInLive.slice(0, 5).forEach(m => console.log(`  - ${m.id}: ${m.content.substring(0, 80)}...`));
            if (missingInLive.length > 5) console.log(`  ... and ${missingInLive.length - 5} more`);
        }
        
        if (missingInBackup.length > 0) {
            console.log('\nMissing in backup (recent memories?):');
            missingInBackup.slice(0, 5).forEach(m => console.log(`  - ${m.id}: ${m.content.substring(0, 80)}...`));
            if (missingInBackup.length > 5) console.log(`  ... and ${missingInBackup.length - 5} more`);
        }
        
        // Calculate overall health score
        const totalBackup = backup.memories.length;
        const totalLive = current.length;
        const overlap = totalBackup - missingInLive.length;
        const healthScore = totalLive > 0 ? (overlap / totalLive) * 100 : 0;
        
        console.log(`\nHealth score: ${healthScore.toFixed(1)}%`);
        
        if (healthScore < 90) {
            console.warn('⚠️  Significant discrepancy detected. Consider running recovery.');
            process.exit(2); // Exit with warning code
        }
    }
    
    console.log('✓ Backup validation passed.');
}

main().catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
});