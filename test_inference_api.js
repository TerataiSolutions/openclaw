const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function test() {
    const url = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test text' }),
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
}
test().catch(err => console.error(err));