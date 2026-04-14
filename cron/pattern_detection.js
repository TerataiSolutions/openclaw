#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';
const { saveMemoryWithEmbedding, generateEmbedding, retrySupabaseCall } = require('../utils.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { logJson } = require('../utils');

async function sendDM(message) {
    try {
        const { stdout, stderr } = await execPromise(
            `node /data/.openclaw/workspace/cron/message_bridge.js "${message.replace(/"/g, '\\"')}"`
        );
        if (stderr) logJson('error', { message: 'Bridge stderr', stderr });
        return true;
    } catch (err) {
        logJson('error', { message: 'Failed to send via bridge', error: err.message });
        return false;
    }
}

async function fetchAllMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding,type,importance`;
    const memories = await retrySupabaseCall(async () => {
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
    });
    if (!memories) {
        logJson('error', { message: 'Failed to fetch memories after retry' });
        return [];
    }
    // parse embedding strings into arrays, filter out nulls
    return memories
        .filter(mem => mem.embedding != null)
        .map(mem => ({
            id: mem.id,
            content: mem.content,
            type: mem.type,
            importance: mem.importance,
            embedding: typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : mem.embedding,
        }));
}

async function rpcSemanticSearch(queryEmbedding, match_threshold = 0.5, match_count = 20) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/semantic_search`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query_embedding: queryEmbedding,
            match_threshold,
            match_count,
        }),
    });
    if (response.ok) {
        return await response.json();
    }
    // If function doesn't exist (404/405), fall back to client-side
    const errorText = await response.text();
    logJson('error', { message: `RPC call failed (${response.status}): ${errorText}. Falling back to client-side similarity.` });
    return null;
}

function cosineSimilarity(vecA, vecB) {
    // assume vectors are normalized (Cohere returns normalized vectors)
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
    }
    return dot;
}



async function clientSideSemanticSearch(queryEmbedding, memories, threshold = 0.5, limit = 20) {
    const results = memories.map(mem => ({
        id: mem.id,
        content: mem.content,
        type: mem.type,
        importance: mem.importance,
        similarity: cosineSimilarity(queryEmbedding, mem.embedding),
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.filter(r => r.similarity >= threshold).slice(0, limit);
}

async function fetchPatternDetectedMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{pattern_detected}&select=id,content,tags`;
    const memories = await retrySupabaseCall(async () => {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch pattern memories: ${response.statusText}`);
        }
        return await response.json();
    });
    return memories || [];
}

async function savePatternMemory(topic, count, memoryIds) {
    const memory = {
        type: 'pattern_detected',
        content: `Pattern detected: ${topic} (appears across ${count} memories)`,
        importance: 7,
        tags: ['pattern_detected', `topic_${topic.substring(0, 20).replace(/\s+/g, '_')}`],
    };
    const saved = await saveMemoryWithEmbedding(memory);
    logJson('info', { message: 'Pattern memory saved', content: saved.content, id: saved.id });
    return saved;
}

async function main() {
    logJson('info', { message: 'Starting pattern detection' });
    const memories = await fetchAllMemories();
    if (memories.length === 0) {
        logJson('info', { message: 'No memories with embeddings' });
        return;
    }

    const processed = new Set();
    const patterns = [];
    const allowedTypes = new Set(['user_preference', 'task', 'client_update']);

    for (const mem of memories) {
        if (processed.has(mem.id)) continue;

        // Skip if seed memory type not allowed
        if (!allowedTypes.has(mem.type)) {
            logJson('info', { message: `Skipping seed memory type ${mem.type}: "${mem.content.substring(0, 50)}"` });
            continue;
        }
        
        // Find similar memories via RPC or client-side
        let similar = await rpcSemanticSearch(mem.embedding, 0.5, 20);
        if (similar === null) {
            similar = await clientSideSemanticSearch(mem.embedding, memories, 0.5, 20);
        }
        
        // Filter out self and already processed, and enforce allowed types
        const cluster = similar.filter(s => 
            s.id !== mem.id && 
            !processed.has(s.id) && 
            allowedTypes.has(s.type)
        );
        
        // Need at least 2 other memories (total 3 including seed)
        if (cluster.length >= 2) {
            // Compute average importance of cluster (including seed)
            const totalImportance = mem.importance + cluster.reduce((sum, c) => sum + c.importance, 0);
            const avgImportance = totalImportance / (cluster.length + 1);
            if (avgImportance < 7) {
                logJson('info', { message: `Skipping pattern: average importance ${avgImportance} < 7 for topic "${mem.content.substring(0, 50)}"` });
                continue;
            }
            
            const topic = mem.content.substring(0, 100);
            const total = cluster.length + 1;
            logJson('info', { message: `Pattern candidate: "${topic}" (${total} memories, types: ${[mem.type, ...cluster.map(c => c.type)].join(', ')}, avg importance: ${avgImportance.toFixed(2)})` });
            patterns.push({
                topic,
                count: total,
                memoryIds: [mem.id, ...cluster.map(c => c.id)],
            });
            // Mark all as processed
            processed.add(mem.id);
            cluster.forEach(c => processed.add(c.id));
        }
    }

    if (patterns.length === 0) {
        logJson('info', { message: 'No patterns found' });
        return;
    }

    // Fetch existing pattern memories to avoid duplicates
    const existing = await fetchPatternDetectedMemories();
    const existingTopics = existing.map(e => e.content);

    for (const pattern of patterns) {
        // Check if pattern already reported
        if (existingTopics.some(t => t.includes(pattern.topic.substring(0, 50)))) {
            logJson('info', { message: `Pattern already reported: ${pattern.topic}` });
            continue;
        }

        // Save pattern memory
        const saved = await savePatternMemory(pattern.topic, pattern.count, pattern.memoryIds);
        if (saved) {
            // Send Discord notification
            const message = `Pattern detected: You've referenced "${pattern.topic}" across ${pattern.count} separate memories. Worth addressing directly?`;
            await sendDM(message);
        }
    }

    logJson('info', { message: `Pattern detection complete. Found ${patterns.length} new patterns.` });
}

main().catch(err => {
    logJson('error', { message: 'Pattern detection error', error: err.message });
    process.exit(1);
});