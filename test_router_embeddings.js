const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function test() {
    const url = 'https://router.huggingface.co/v1/embeddings';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            input: 'test text',
        }),
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    if (response.ok) {
        try {
            const json = JSON.parse(text);
            console.log('Embedding length:', json.data[0].embedding.length);
        } catch (e) {
            console.log('Parse error');
        }
    }
}
test().catch(err => console.error(err));