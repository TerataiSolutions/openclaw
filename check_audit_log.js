const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function check() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Status: ${response.status}`);
        if (response.status === 200) {
            const data = await response.json();
            console.log(`Table exists, ${data.length} rows`);
            return true;
        } else {
            console.log(`Table may not exist or error: ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return false;
    }
}

check();