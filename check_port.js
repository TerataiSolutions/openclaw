const http = require('http');
const req = http.request({ hostname: 'localhost', port: 8080, path: '/', method: 'GET', timeout: 2000 }, (res) => {
    console.log(`Webhook server responding: ${res.statusCode}`);
    process.exit(0);
});
req.on('error', (err) => {
    console.log(`Webhook server not responding: ${err.message}`);
    process.exit(1);
});
req.end();