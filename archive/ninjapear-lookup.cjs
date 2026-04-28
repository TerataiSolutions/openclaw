const https = require('https');

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  params[args[i]] = args[i + 1];
}

if (!process.env.PROXYCURL_API_KEY) {
  console.error('ERROR: PROXYCURL_API_KEY environment variable is not set');
  process.exit(1);
}

const query = new URLSearchParams(params).toString();
const url = `https://nubela.co/api/v1/employee/profile?${query}`;

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.PROXYCURL_API_KEY}`
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`HTTP_STATUS: ${res.statusCode}`);
    console.log(`CREDITS_REMAINING_HEADER: ${res.headers['x-ninjapear-credit-cost'] || 'not returned'}`);
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log(JSON.stringify(parsed, null, 2));
      } catch(e) {
        console.log(data);
      }
    } else {
      console.log(`API_RESPONSE: ${data}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`REQUEST_ERROR: ${e.message}`);
  process.exit(1);
});

req.end();
