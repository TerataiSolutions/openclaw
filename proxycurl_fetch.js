const apiKey = '799129aaf1a14eb891793e1bf46d16ca';
const profileUrl = 'https://www.linkedin.com/in/lasthenes/';
const apiUrl = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(profileUrl)}`;

async function fetchProfile() {
    console.log('Calling Proxycurl API...');
    const response = await fetch(apiUrl, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
        },
    });
    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response length:', text.length);
    if (!response.ok) {
        console.error('Error response:', text);
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        console.log('Raw response start:', text.substring(0, 500));
        return null;
    }
}

(async () => {
    const data = await fetchProfile();
    if (!data) {
        console.log('No data returned from Proxycurl API.');
        process.exit(1);
    }
    console.log('\n=== Raw Proxycurl API response ===');
    console.log(JSON.stringify(data, null, 2));
})();