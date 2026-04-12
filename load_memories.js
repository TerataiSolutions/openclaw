const https = require('https');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const url = `${supabaseUrl}/rest/v1/memories?order=importance.desc,created_at.desc&limit=40&select=type,content,importance,tags,created_at`;
const options = {
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json'
    },
    timeout: 10000
};

const req = https.request(url, options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const memories = JSON.parse(data);
            console.log(`Found ${memories.length} memories:`);
            memories.forEach((mem, i) => {
                console.log(`\n[${i+1}] ${mem.type} (importance: ${mem.importance})`);
                console.log(`Content: ${mem.content}`);
                console.log(`Tags: ${mem.tags ? mem.tags.join(', ') : 'none'}`);
                console.log(`Created: ${mem.created_at}`);
            });
        } catch (err) {
            console.error('Parse error:', err);
            console.log('Raw response:', data);
        }
    });
});

req.on('timeout', () => {
    console.error('Request timeout');
    req.destroy();
    process.exit(1);
});

req.on('error', (err) => {
    console.error('Request error:', err);
    process.exit(1);
});

req.end();