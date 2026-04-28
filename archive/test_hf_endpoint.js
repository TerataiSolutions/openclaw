const HUGGINGFACE_ENDPOINT = process.env.HUGGINGFACE_ENDPOINT;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function test() {
    console.log('Testing endpoint:', HUGGINGFACE_ENDPOINT);
    const response = await fetch(HUGGINGFACE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test text for embedding' }),
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response length:', text.length);
    if (response.ok) {
        try {
            const json = JSON.parse(text);
            console.log('Response type:', Array.isArray(json) ? 'array' : typeof json);
            if (Array.isArray(json)) {
                console.log('First element type:', typeof json[0]);
                if (Array.isArray(json[0])) {
                    console.log('Embedding length:', json[0].length);
                    console.log('First 3 values:', json[0].slice(0, 3));
                }
            } else if (json.error) {
                console.log('Error:', json.error);
            }
        } catch (e) {
            console.log('Response:', text.substring(0, 200));
        }
    } else {
        console.log('Full response:', text);
    }
}
test().catch(err => console.error(err));