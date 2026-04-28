const https = require('https');
const apiKey = process.env.PROXYCURL_API_KEY;
const targetUrl = 'https://www.linkedin.com/in/lasthenes/';

function callProxycurl(hostname, path) {
    const options = {
        hostname,
        path,
        headers: { 'Authorization': `Bearer ${apiKey}` }
    };
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Host: ${hostname}${path}`);
            console.log(`Status: ${res.statusCode}`);
            console.log(`Body: ${data}`);
        });
    });
    req.on('error', (err) => console.error(err));
    req.end();
}

// Try api.proxycurl.com
callProxycurl('api.proxycurl.com', `/v2/linkedin?url=${encodeURIComponent(targetUrl)}`);
// Try nubela.co again but maybe different path
callProxycurl('nubela.co', '/proxycurl/api/v2/linkedin?url=' + encodeURIComponent(targetUrl));