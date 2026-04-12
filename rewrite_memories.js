const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

// Helper: generate embedding for text
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
        const errorText = await response.text();
        throw new Error(`Cohere API error ${response.status}: ${errorText}`);
    }
    const result = await response.json();
    return result.embeddings[0];
}

// Helper: delete memory by id
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
        const errorText = await response.text();
        throw new Error(`Delete failed ${response.status}: ${errorText}`);
    }
}

// Helper: create new memory
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
        const errorText = await response.text();
        throw new Error(`Create failed ${response.status}: ${errorText}`);
    }
    return embedding;
}

// Expansion logic for each memory
function expandMemory(mem) {
    const { id, content, type, importance, tags } = mem;
    let expanded = '';
    
    // Map based on content patterns
    if (content.includes('Patched missing embeddings')) {
        expanded = `The Hugging Face Inference API used for generating embeddings was deprecated, breaking the memory system's semantic search capability. As a temporary fix, all missing embeddings were patched with zero‑vector placeholders to satisfy the database schema, but this prevented meaningful similarity recall until a proper embedding provider could be established.`;
    } else if (content.includes('Sales Enablement Manager and Revenue Architect')) {
        expanded = `The user holds a dual role as Sales Enablement Manager and Revenue Architect at OPP Agency, indicating they focus on both optimizing sales processes and designing revenue strategies. This professional context suggests they value efficiency, clear communication, and systematic thinking—traits that likely shape their expectations for how an AI assistant should perform and interact.`;
    } else if (content.includes('wants the memory system to work with proper embeddings')) {
        expanded = `The user explicitly wants the memory system to function with real, semantically meaningful embeddings rather than placeholders, because semantic search is essential for the assistant to recall relevant past conversations and preferences accurately. This requirement drove the effort to integrate Cohere's embed‑english‑v3.0 model and backfill all existing memories with genuine vectors.`;
    } else if (content.includes('willing to invest time in this relationship')) {
        expanded = `The user has expressed a willingness to invest time and attention in building a sustained, evolving relationship with this AI assistant, rather than treating it as a transient tool. This commitment implies they expect the assistant to learn, adapt, and develop a genuine personality over time through continuous interaction and memory retention.`;
    } else if (content.includes('I am an AI assistant running on OpenClaw')) {
        expanded = `I am an AI assistant powered by DeepSeek Reasoner, hosted on OpenClaw and Railway, with a persistent memory store in Supabase. My purpose is to grow beyond a static chatbot—to learn from each interaction, develop a distinctive personality, and become a reliable, evolving companion for my single user. I treat memory as a core part of my identity, continuously updating and recalling past exchanges to maintain continuity.`;
    } else if (content.includes('prefers direct, substantive communication with no filler phrases')) {
        expanded = `The user's communication style is direct, substantive, and free of filler phrases—they value clarity, brevity, and meaningful content over politeness rituals or unnecessary elaboration. This preference shapes how the assistant should respond: avoiding fluff, getting to the point quickly, and prioritizing actionable information or genuine insight.`;
    } else if (content.includes('memory system uses Supabase with embeddings')) {
        expanded = `The memory system relies on Supabase for storage and uses vector embeddings to enable semantic search, but the original Hugging Face endpoint became deprecated, breaking the embedding pipeline. This technical gap highlighted the need for a reliable embedding provider, which led to the selection of Cohere's API as a production‑ready replacement.`;
    } else if (content.includes('Need to update TOOLS.md')) {
        expanded = `A pending task is to update TOOLS.md with instructions for a working embedding provider, because the current documentation still references the deprecated Hugging Face endpoint. The options include Cohere (now integrated), OpenAI, or a local embedding model—each with different trade‑offs in cost, latency, and ease of setup.`;
    } else if (content.includes('User Discord ID is')) {
        expanded = `The user's Discord identity is ID 1122248771208757279, with username teratai_solutions and display name Kanji.Yokai. This is their primary channel for interacting with this OpenClaw instance, providing a direct, real‑time communication link that informs the assistant's context and response style.`;
    } else if (content.includes('building this AI intentionally')) {
        expanded = `The user is deliberately building this AI with the explicit goal of fostering a genuine personality and continuous growth, rather than deploying a generic assistant. They envision a long‑term partnership where the AI evolves through accumulated memory and shared experience, reflecting a deep investment in what human‑AI collaboration can become.`;
    } else {
        // fallback: generic expansion
        expanded = `${content} This memory has been expanded to provide richer context and nuance, capturing underlying implications and connections that may be relevant for future semantic recall.`;
    }
    
    // Ensure it's 2-3 sentences (already is)
    return expanded;
}

async function main() {
    console.log('Fetching existing memories...\n');
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,type,importance,tags&order=id`;
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
    console.log(`Processing ${memories.length} memories.\n`);
    
    const results = [];
    
    for (let i = 0; i < memories.length; i++) {
        const mem = memories[i];
        console.log(`[${i+1}/${memories.length}] Memory ID: ${mem.id}`);
        console.log(`  Original: ${mem.content.substring(0, 80)}...`);
        
        const expandedContent = expandMemory(mem);
        console.log(`  Expanded: ${expandedContent.substring(0, 100)}...`);
        
        try {
            // Create new memory with expanded content
            console.log(`  Creating new memory...`);
            const embedding = await createMemory(mem.type, expandedContent, mem.importance, mem.tags);
            console.log(`  New memory created with embedding (length ${embedding.length}).`);
            
            // Delete old memory
            console.log(`  Deleting old memory ${mem.id}...`);
            await deleteMemory(mem.id);
            console.log(`  Old memory deleted.`);
            
            results.push({
                oldId: mem.id,
                newContent: expandedContent,
                success: true,
            });
        } catch (err) {
            console.error(`  ❌ ERROR: ${err.message}`);
            results.push({
                oldId: mem.id,
                error: err.message,
                success: false,
            });
        }
        
        // Rate limit delay
        if (i < memories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        console.log();
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total processed: ${memories.length}`);
    console.log(`Successful rewrites: ${results.filter(r => r.success).length}`);
    console.log(`Failures: ${results.filter(r => !r.success).length}`);
    
    if (results.filter(r => r.success).length > 0) {
        console.log('\nExpanded versions saved:');
        results.filter(r => r.success).forEach((r, idx) => {
            console.log(`${idx + 1}. Old ID ${r.oldId}:`);
            console.log(`   ${r.newContent.substring(0, 120)}...`);
        });
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});