const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,type,content,importance,tags,created_at&order=created_at.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    const memories = await response.json();
    console.log(`Total memories in database: ${memories.length}\n`);
    
    // Group by original pattern (heuristic: first few words)
    const groups = {};
    memories.forEach(mem => {
        // Determine original topic from content
        let topic = '';
        if (mem.content.includes('Hugging Face Inference API')) topic = 'Hugging Face deprecation';
        else if (mem.content.includes('Sales Enablement Manager')) topic = 'User role';
        else if (mem.content.includes('real, semantically meaningful embeddings')) topic = 'Embedding requirement';
        else if (mem.content.includes('willingness to invest time')) topic = 'Time investment';
        else if (mem.content.includes('AI assistant powered by DeepSeek')) topic = 'Self‑description';
        else if (mem.content.includes('communication style is direct')) topic = 'Communication style';
        else if (mem.content.includes('memory system relies on Supabase')) topic = 'Memory system config';
        else if (mem.content.includes('update TOOLS.md')) topic = 'TOOLS.md task';
        else if (mem.content.includes('Discord identity')) topic = 'Discord identity';
        else if (mem.content.includes('deliberately building this AI')) topic = 'Intentional AI building';
        else topic = 'Other';
        
        if (!groups[topic]) groups[topic] = [];
        groups[topic].push(mem);
    });
    
    // Output each group
    Object.entries(groups).forEach(([topic, mems]) => {
        console.log(`=== ${topic.toUpperCase()} (${mems.length} memories) ===`);
        mems.forEach((mem, idx) => {
            console.log(`\n${idx + 1}. ID: ${mem.id}`);
            console.log(`   Type: ${mem.type}, Importance: ${mem.importance}`);
            console.log(`   Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
            console.log(`   Content: ${mem.content}`);
        });
        console.log('\n' + '─'.repeat(80) + '\n');
    });
}

main().catch(err => console.error(err));