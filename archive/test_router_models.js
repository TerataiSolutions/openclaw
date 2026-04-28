const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function test() {
    const url = 'https://router.huggingface.co/v1/models';
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        },
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    if (response.ok) {
        try {
            const json = JSON.parse(text);
            console.log('Models count:', json.data?.length || 'unknown');
            // show first few
            json.data?.slice(0, 5).forEach(m => console.log(m.id));
        } catch (e) {
            console.log('Response:', text.substring(0, 200));
        }
    } else {
        console.log('Error:', text);
    }
}
test().catch(err => console.error(err));