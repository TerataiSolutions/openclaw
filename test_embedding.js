const HUGGINGFACE_ENDPOINT = process.env.HUGGINGFACE_ENDPOINT;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function testEmbedding() {
    const response = await fetch(HUGGINGFACE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test text' }),
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response:', text);
}
testEmbedding().catch(err => console.error(err));