const https = require('https');
const apiKey = process.env.PROXYCURL_API_KEY;
const targetUrl = 'https://www.linkedin.com/in/lasthenes/';

const variants = [
    '/proxycurl/api/v2/linkedin?url=',
    '/proxycurl/api/v2/linkedin/profile?url=',
    '/proxycurl/api/linkedin?url=',
    '/proxycurl/api/linkedin/profile?url=',
    '/api/v2/linkedin?url=',
    '/api/linkedin?url='
];

variants.forEach(path => {
    const options = {
        hostname: 'nubela.co',
        path: path + encodeURIComponent(targetUrl),
        headers: { 'Authorization': `Bearer ${apiKey}` }
    };
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Path: ${path}`);
            console.log(`Status: ${res.statusCode}`);
            if (res.statusCode !== 410 && res.statusCode !== 404) {
                console.log(`Body: ${data}`);
            } else {
                console.log(`Body (truncated): ${data.substring(0, 200)}`);
            }
            console.log('---');
        });
    });
    req.on('error', (err) => console.error(`Error ${path}: ${err}`));
    req.end();
});