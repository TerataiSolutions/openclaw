const https = require('https');
const url = require('url');

const apiKey = process.env.PROXYCURL_API_KEY;
if (!apiKey) {
    console.error('PROXYCURL_API_KEY not set');
    process.exit(1);
}

const targetUrl = 'https://www.linkedin.com/in/lasthenes/';
const apiUrl = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(targetUrl)}`;

const options = {
    hostname: 'nubela.co',
    path: '/proxycurl/api/v2/linkedin?url=' + encodeURIComponent(targetUrl),
    headers: {
        'Authorization': `Bearer ${apiKey}`
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log('Response Body:');
        console.log(data);
    });
});

req.on('error', (err) => {
    console.error('Request error:', err);
});

req.end();