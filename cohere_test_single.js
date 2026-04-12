const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function test() {
    console.log('Testing Cohere API key...');
    console.log('Key (first 8 chars):', COHERE_API_KEY ? COHERE_API_KEY.substring(0, 8) + '...' : 'missing');
    
    const response = await fetch(COHERE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'embed-english-v3.0',
            texts: ['test'],
            input_type: 'search_document',
        }),
    });
    
    console.log(`HTTP Status Code: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    console.log('Response length:', text.length);
    
    if (response.ok) {
        try {
            const json = JSON.parse(text);
            if (json.embeddings && Array.isArray(json.embeddings) && json.embeddings.length > 0) {
                const emb = json.embeddings[0];
                console.log('Embedding length:', emb.length);
                console.log('First 3 values:', emb.slice(0, 3));
                console.log('All values numeric?', emb.slice(0, 5).every(v => typeof v === 'number'));
            } else {
                console.log('Unexpected response structure:', Object.keys(json));
                console.log('Response snippet:', text.substring(0, 200));
            }
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log('Response:', text.substring(0, 200));
        }
    } else {
        console.log('Error response:', text);
    }
}

test().catch(err => console.error('Fatal:', err));