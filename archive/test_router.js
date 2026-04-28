const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function testRouter() {
    const url = 'https://router.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
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
    console.log('Response length:', text.length);
    if (response.ok) {
        const json = JSON.parse(text);
        console.log('Embedding length:', json.length);
    } else {
        console.log('Error:', text);
    }
}
testRouter().catch(err => console.error(err));