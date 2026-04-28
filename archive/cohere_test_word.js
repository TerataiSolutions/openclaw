const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_ENDPOINT = 'https://api.cohere.ai/v1/embed';

async function test() {
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
    if (response.ok) {
        const json = JSON.parse(text);
        const emb = json.embeddings[0];
        console.log(`First 3 values of embedding for "test": ${emb.slice(0, 3).map(v => v.toFixed(8)).join(', ')}`);
        console.log(`Embedding length: ${emb.length}`);
    } else {
        console.log('Error:', text);
    }
}
test().catch(err => console.error(err));