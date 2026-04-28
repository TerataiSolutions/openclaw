const https = require('https');
const apiKey = process.env.PROXYCURL_API_KEY;
const targetUrl = 'https://www.linkedin.com/in/lasthenes/';

// Person profile endpoint from docs
const options = {
    hostname: 'nubela.co',
    path: '/api/v1/person/profile?url=' + encodeURIComponent(targetUrl),
    headers: { 'Authorization': `Bearer ${apiKey}` }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers: ${JSON.stringify(res.headers)}`);
        console.log(`Body: ${data}`);
    });
});
req.on('error', (err) => console.error(err));
req.end();