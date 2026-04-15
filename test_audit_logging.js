const { getClientContext } = require('./clients/retrieve.js');
const { logAuditEvent } = require('./security/audit_logger.js');

// Mock supabase client to avoid real calls
const supabaseMock = {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({
        select: () => ({
            eq: () => ({
                order: () => ({
                    limit: () => Promise.resolve({ data: [] })
                })
            })
        })
    })
};

// Replace the supabase import in retrieve.js
const retrieveModule = require('./clients/retrieve.js');
const originalSupabase = retrieveModule.supabase;
retrieveModule.supabase = supabaseMock;

// Mock logAuditEvent
let auditCalled = false;
let auditEvent = null;
require('./security/audit_logger.js').logAuditEvent = async (event) => {
    auditCalled = true;
    auditEvent = event;
    console.log('logAuditEvent called:', event);
};

// Mock getClientState to avoid errors
const clientStateModule = require('./clients/client_state.js');
clientStateModule.getClientState = async () => ({ some: 'state' });

// Mock sendMessage to avoid Discord
const messageBridge = require('./cron/message_bridge.js');
if (messageBridge.sendMessage) {
    messageBridge.sendMessage = async () => console.log('sendMessage mocked');
}

async function runTest() {
    console.log('Testing getClientContext audit logging...');
    try {
        await getClientContext('sturdy', 'value proposition');
    } catch (err) {
        console.error('Error:', err.message);
    }
    
    console.log(`Audit called: ${auditCalled}`);
    if (auditCalled) {
        console.log('Event:', auditEvent);
        console.log('✓ PASS - audit logging called');
        process.exit(0);
    } else {
        console.log('✗ FAIL - audit logging not called');
        process.exit(1);
    }
}

runTest();