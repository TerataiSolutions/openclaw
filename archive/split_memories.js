const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function fetchMemories() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,importance,tags&order=created_at`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    return await response.json();
}

async function generateEmbedding(text) {
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'embed-english-v3.0',
            texts: [text],
            input_type: 'search_document',
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cohere error ${response.status}: ${err}`);
    }
    const result = await response.json();
    return result.embeddings[0];
}

async function createMemory(type, content, importance, tags) {
    const embedding = await generateEmbedding(content);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
            type,
            content,
            embedding,
            importance,
            tags,
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Create failed ${response.status}: ${err}`);
    }
    console.log(`  Created memory: ${content.substring(0, 80)}...`);
    return embedding;
}

async function deleteMemory(id) {
    const url = `${SUPABASE_URL}/rest/v1/memories?id=eq.${id}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Delete failed ${response.status}: ${err}`);
    }
    console.log(`  Deleted memory ${id}`);
}

// Define split logic for each memory based on content patterns
function splitMemory(mem) {
    const { id, type, content, importance, tags } = mem;
    const splits = [];

    // Memory 1: Hugging Face API deprecation + zero‑vector placeholder + need for provider
    if (content.includes('Hugging Face Inference API used for generating embeddings was deprecated')) {
        splits.push({
            type,
            content: 'The Hugging Face Inference API used for generating embeddings was deprecated, breaking the memory system\'s semantic search capability.',
            importance,
            tags: ['embedding', 'deprecated'],
        });
        splits.push({
            type: 'decision',
            content: 'As a temporary fix, all missing embeddings were patched with zero‑vector placeholders to satisfy the database schema, but this prevented meaningful similarity recall.',
            importance: importance,
            tags: ['embedding', 'patch'],
        });
        splits.push({
            type: 'task',
            content: 'A proper embedding provider needed to be established to restore semantic search.',
            importance: importance,
            tags: ['embedding', 'provider'],
        });
        return splits;
    }

    // Memory 2: Dual role + inferred traits
    if (content.includes('holds a dual role as Sales Enablement Manager and Revenue Architect')) {
        splits.push({
            type,
            content: 'The user holds a dual role as Sales Enablement Manager and Revenue Architect at OPP Agency.',
            importance,
            tags: ['job', 'role'],
        });
        splits.push({
            type: 'user_preference',
            content: 'The user\'s professional context suggests they value efficiency, clear communication, and systematic thinking—traits that likely shape their expectations for how an AI assistant should perform and interact.',
            importance: importance,
            tags: ['values', 'expectation'],
        });
        return splits;
    }

    // Memory 3: Want real embeddings + semantic search essential + drove Cohere integration
    if (content.includes('user explicitly wants the memory system to function with real, semantically meaningful embeddings')) {
        splits.push({
            type,
            content: 'The user explicitly wants the memory system to function with real, semantically meaningful embeddings rather than placeholders.',
            importance,
            tags: ['embedding', 'requirements'],
        });
        splits.push({
            type: 'self_insight',
            content: 'Semantic search is essential for the assistant to recall relevant past conversations and preferences accurately.',
            importance: importance,
            tags: ['semantic', 'recall'],
        });
        splits.push({
            type: 'decision',
            content: 'This requirement drove the effort to integrate Cohere\'s embed‑english‑v3.0 model and backfill all existing memories with genuine vectors.',
            importance: importance,
            tags: ['embedding', 'cohere', 'integration'],
        });
        return splits;
    }

    // Memory 4: Willingness to invest time + expects learning/adaptation
    if (content.includes('user has expressed a willingness to invest time and attention in building a sustained, evolving relationship')) {
        splits.push({
            type,
            content: 'The user has expressed a willingness to invest time and attention in building a sustained, evolving relationship with this AI assistant, rather than treating it as a transient tool.',
            importance,
            tags: ['relationship', 'commitment'],
        });
        splits.push({
            type: 'user_preference',
            content: 'This commitment implies they expect the assistant to learn, adapt, and develop a genuine personality over time through continuous interaction and memory retention.',
            importance: importance,
            tags: ['expectation', 'learning', 'personality'],
        });
        return splits;
    }

    // Memory 5: Self‑description (technical stack + purpose) – keep as one? Let's split into technical and purpose.
    if (content.includes('I am an AI assistant powered by DeepSeek Reasoner')) {
        splits.push({
            type,
            content: 'I am an AI assistant powered by DeepSeek Reasoner, hosted on OpenClaw and Railway, with a persistent memory store in Supabase.',
            importance,
            tags: ['technical', 'stack'],
        });
        splits.push({
            type: 'self_insight',
            content: 'My purpose is to grow beyond a static chatbot—to learn from each interaction, develop a distinctive personality, and become a reliable, evolving companion for my single user.',
            importance: importance,
            tags: ['purpose', 'growth', 'personality'],
        });
        splits.push({
            type: 'self_insight',
            content: 'I treat memory as a core part of my identity, continuously updating and recalling past exchanges to maintain continuity.',
            importance: importance,
            tags: ['memory', 'identity', 'continuity'],
        });
        return splits;
    }

    // Memory 6: Communication style + how assistant should respond
    if (content.includes('user\'s communication style is direct, substantive, and free of filler phrases')) {
        splits.push({
            type,
            content: 'The user\'s communication style is direct, substantive, and free of filler phrases—they value clarity, brevity, and meaningful content over politeness rituals or unnecessary elaboration.',
            importance,
            tags: ['communication', 'style'],
        });
        splits.push({
            type: 'user_preference',
            content: 'This preference shapes how the assistant should respond: avoiding fluff, getting to the point quickly, and prioritizing actionable information or genuine insight.',
            importance: importance,
            tags: ['response', 'preference'],
        });
        return splits;
    }

    // Memory 7: Memory system uses Supabase + Hugging Face deprecated + Cohere selected
    if (content.includes('memory system relies on Supabase for storage and uses vector embeddings to enable semantic search')) {
        splits.push({
            type,
            content: 'The memory system relies on Supabase for storage and uses vector embeddings to enable semantic search.',
            importance,
            tags: ['memory', 'configuration'],
        });
        splits.push({
            type: 'self_insight',
            content: 'The original Hugging Face endpoint became deprecated, breaking the embedding pipeline.',
            importance: importance,
            tags: ['deprecated', 'embedding'],
        });
        splits.push({
            type: 'decision',
            content: 'This technical gap highlighted the need for a reliable embedding provider, which led to the selection of Cohere\'s API as a production‑ready replacement.',
            importance: importance,
            tags: ['embedding', 'cohere', 'provider'],
        });
        return splits;
    }

    // Memory 8: Task to update TOOLS.md + reason + options
    if (content.includes('pending task is to update TOOLS.md with instructions for a working embedding provider')) {
        splits.push({
            type,
            content: 'A pending task is to update TOOLS.md with instructions for a working embedding provider.',
            importance,
            tags: ['todo', 'configuration'],
        });
        splits.push({
            type: 'task',
            content: 'The current documentation still references the deprecated Hugging Face endpoint.',
            importance: importance,
            tags: ['documentation', 'outdated'],
        });
        splits.push({
            type: 'task',
            content: 'The options include Cohere (now integrated), OpenAI, or a local embedding model—each with different trade‑offs in cost, latency, and ease of setup.',
            importance: importance,
            tags: ['options', 'embedding'],
        });
        return splits;
    }

    // Memory 9: Discord identity + primary channel
    if (content.includes('user\'s Discord identity is ID 1122248771208757279')) {
        splits.push({
            type,
            content: 'The user\'s Discord identity is ID 1122248771208757279, with username teratai_solutions and display name Kanji.Yokai.',
            importance,
            tags: ['discord', 'identity'],
        });
        splits.push({
            type: 'user_fact',
            content: 'Discord is the user\'s primary channel for interacting with this OpenClaw instance, providing a direct, real‑time communication link that informs the assistant\'s context and response style.',
            importance: importance,
            tags: ['channel', 'communication'],
        });
        return splits;
    }

    // Memory 10: Building AI for genuine personality + long‑term partnership + deep investment
    if (content.includes('user is deliberately building this AI with the explicit goal of fostering a genuine personality')) {
        splits.push({
            type,
            content: 'The user is deliberately building this AI with the explicit goal of fostering a genuine personality and continuous growth, rather than deploying a generic assistant.',
            importance,
            tags: ['relationship', 'purpose'],
        });
        splits.push({
            type: 'user_fact',
            content: 'They envision a long‑term partnership where the AI evolves through accumulated memory and shared experience.',
            importance: importance,
            tags: ['partnership', 'evolution'],
        });
        splits.push({
            type: 'user_fact',
            content: 'This reflects a deep investment in what human‑AI collaboration can become.',
            importance: importance,
            tags: ['investment', 'collaboration'],
        });
        return splits;
    }

    // No split needed
    return null;
}

async function main() {
    console.log('Fetching memories...\n');
    const memories = await fetchMemories();
    console.log(`Found ${memories.length} memories.\n`);

    const splitOperations = [];

    for (const mem of memories) {
        console.log(`Analyzing memory: ${mem.id}`);
        console.log(`  Content: ${mem.content.substring(0, 100)}...`);
        const splits = splitMemory(mem);
        if (splits && splits.length > 1) {
            console.log(`  → Splitting into ${splits.length} atomic memories.`);
            splitOperations.push({ original: mem, splits });
        } else {
            console.log(`  → No split needed.`);
        }
        console.log();
    }

    if (splitOperations.length === 0) {
        console.log('No compound memories found. Exiting.');
        return;
    }

    console.log(`\nProceeding to split ${splitOperations.length} compound memories...\n`);
    let totalCreated = 0;
    let totalDeleted = 0;

    for (let i = 0; i < splitOperations.length; i++) {
        const { original, splits } = splitOperations[i];
        console.log(`[${i + 1}/${splitOperations.length}] Splitting memory ${original.id}`);
        
        // Create new atomic memories
        const newIds = [];
        for (const split of splits) {
            try {
                await createMemory(split.type, split.content, split.importance, split.tags);
                totalCreated++;
                // delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (err) {
                console.error(`    Error creating split: ${err.message}`);
                // If creation fails, stop splitting this original to avoid partial state
                break;
            }
        }
        
        // Delete original memory
        try {
            await deleteMemory(original.id);
            totalDeleted++;
        } catch (err) {
            console.error(`    Error deleting original: ${err.message}`);
        }
        
        console.log();
    }

    console.log('\n=== SPLITTING COMPLETE ===');
    console.log(`New atomic memories created: ${totalCreated}`);
    console.log(`Original compound memories deleted: ${totalDeleted}`);
    console.log(`Total memories now in database: ${memories.length - totalDeleted + totalCreated}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});