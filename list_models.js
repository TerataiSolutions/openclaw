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
    // filter for embedding-like names
    const embeddingModels = models.filter(m => 
        m.id.toLowerCase().includes('embed') ||
        m.id.includes('gte') ||
        m.id.includes('bge') ||
        m.id.includes('e5')
    );
    console.log('Embedding-like models:', embeddingModels.map(m => m.id).slice(0, 10));
    // also show first few models
    console.log('First 5 models:', models.slice(0, 5).map(m => m.id));
}

listModels().catch(err => console.error(err));