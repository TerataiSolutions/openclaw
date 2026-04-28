#!/usr/bin/env node
// Initialize client states for all five clients
const { initializeClientState } = require('./clients/client_state.js');

async function main() {
    const clientIds = ['opp', 'customer_contact_services', 'sturdy', 'seneca_global', 'pecan'];
    console.log('Initializing client states...');
    for (const clientId of clientIds) {
        try {
            const state = await initializeClientState(clientId);
            console.log(`✓ ${clientId}: initialized`);
            console.log('  State:', JSON.stringify(state, null, 2));
        } catch (err) {
            console.error(`✗ ${clientId}: ${err.message}`);
        }
    }
    console.log('Done.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});