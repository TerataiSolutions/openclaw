const { getClientContext } = require('./clients/retrieve.js');

async function countAuditEvents(clientId) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_log?event_type=eq.client_data_access&client_id=eq.${clientId}&select=id`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );
    if (!response.ok) {
        console.error('Failed to query audit_log:', response.status);
        return 0;
    }
    const data = await response.json();
    return data.length;
}

async function run() {
    const clientId = 'sturdy';
    const query = 'test integration';
    
    console.log('Counting existing audit events...');
    const before = await countAuditEvents(clientId);
    console.log(`Before: ${before} events`);
    
    console.log('Calling getClientContext...');
    try {
        const result = await getClientContext(clientId, query);
        console.log(`Got ${result.memories.length} memories`);
    } catch (err) {
        console.error('Error:', err.message);
    }
    
    console.log('Waiting 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const after = await countAuditEvents(clientId);
    console.log(`After: ${after} events`);
    
    if (after > before) {
        console.log('✓ PASS - audit log entry created');
        process.exit(0);
    } else {
        console.log('✗ FAIL - no new audit log entry');
        process.exit(1);
    }
}

run();