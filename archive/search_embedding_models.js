const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function listModels() {
    const url = 'https://router.huggingface.co/v1/models';
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const models = data.data || [];
    console.log(`Total models: ${models.length}`);
    const embeddingCandidates = models.filter(m => 
        m.id.toLowerCase().includes('embed') ||
        m.id.includes('mini') ||
        m.id.includes('gte') ||
        m.id.includes('bge') ||
        m.id.includes('e5') ||
        m.id.includes('sentence-transformers')
    );
    console.log('Embedding candidate models:');
    embeddingCandidates.forEach(m => console.log(`  ${m.id}`));
    if (embeddingCandidates.length === 0) {
        console.log('No embedding models found in router list.');
    }
}

listModels().catch(err => console.error(err));