#!/usr/bin/env node
const { getClientState } = require('./clients/client_state.js');
const { saveMemoryWithEmbedding } = require('./utils.js');
const { getClientContext } = require('./clients/retrieve.js');
const { ingestDocument } = require('./clients/ingest.js');
const { getConfidenceWarning, crossClientAnalysis } = require('./clients/retrieve.js');

async function test1() {
    console.log('Test 1: getClientState("sturdy") — structured JSON with all 10 fields');
    try {
        const state = await getClientState('sturdy');
        if (!state) {
            return { pass: false, details: 'State is null' };
        }
        const required = ['current_campaign_strategy', 'last_interaction_summary', 'active_priorities', 'open_items', 'key_contacts', 'current_icp_focus', 'messaging_working', 'messaging_not_working', 'red_flags', 'last_updated'];
        const missing = required.filter(f => !(f in state));
        if (missing.length > 0) {
            return { pass: false, details: `Missing fields: ${missing.join(', ')}` };
        }
        return { pass: true, details: `All ${required.length} fields present` };
    } catch (err) {
        return { pass: false, details: `Error: ${err.message}` };
    }
}

async function test2() {
    console.log('Test 2: saveMemoryWithEmbedding without client_id for client_intel type');
    try {
        await saveMemoryWithEmbedding({
            type: 'client_intel',
            content: 'test',
            importance: 8
        });
        return { pass: false, details: 'Expected error but succeeded' };
    } catch (err) {
        if (err.message.includes('client_id is required')) {
            return { pass: true, details: 'Correctly threw validation error' };
        }
        return { pass: false, details: `Wrong error: ${err.message}` };
    }
}

async function test3() {
    console.log('Test 3: getClientContext("sturdy", "value proposition") — all results have client_id = "sturdy"');
    try {
        const { memories } = await getClientContext('sturdy', 'value proposition');
        if (!Array.isArray(memories)) {
            return { pass: false, details: 'Memories not an array' };
        }
        const foreign = memories.filter(m => m.client_id !== 'sturdy');
        if (foreign.length > 0) {
            return { pass: false, details: `${foreign.length} memories with wrong client_id: ${foreign.map(m => m.client_id).join(', ')}` };
        }
        return { pass: true, details: `All ${memories.length} memories scoped to sturdy` };
    } catch (err) {
        return { pass: false, details: `Error: ${err.message}` };
    }
}

async function test4() {
    console.log('Test 4: ingestDocument with invalid client_id');
    try {
        await ingestDocument({
            client_id: 'invalid_client',
            document_type_id: 'cold_call_script_client',
            file_format: 'pdf',
            file_content: ''
        });
        return { pass: false, details: 'Expected error but succeeded' };
    } catch (err) {
        if (err.message.includes('Invalid client_id') || err.message.includes('Valid clients:')) {
            return { pass: true, details: 'Correctly rejected invalid client' };
        }
        return { pass: false, details: `Wrong error: ${err.message}` };
    }
}

async function test5() {
    console.log('Test 5: ingestDocument with invalid document_type_id');
    try {
        await ingestDocument({
            client_id: 'sturdy',
            document_type_id: 'invalid_type',
            file_format: 'pdf',
            file_content: ''
        });
        return { pass: false, details: 'Expected error but succeeded' };
    } catch (err) {
        if (err.message.includes('Unknown document type')) {
            return { pass: true, details: 'Correctly rejected invalid document type' };
        }
        return { pass: false, details: `Wrong error: ${err.message}` };
    }
}

async function test6() {
    console.log('Test 6: getConfidenceWarning("medium") returns correct warning');
    const warning = getConfidenceWarning('medium');
    const expected = 'NOTE: This information is from a conversational source and should be verified before use in live contexts.';
    if (warning === expected) {
        return { pass: true, details: 'Warning matches' };
    } else {
        return { pass: false, details: `Expected "${expected}", got "${warning}"` };
    }
}

async function test7() {
    console.log('Test 7: crossClientAnalysis("value proposition") — results grouped by client with no mixing');
    try {
        const results = await crossClientAnalysis('value proposition');
        if (!Array.isArray(results)) {
            return { pass: false, details: 'Results not an array' };
        }
        // Check each group has distinct client_id and memories belong to that client
        for (const group of results) {
            if (!group.client || !group.client_id || !Array.isArray(group.memories)) {
                return { pass: false, details: 'Group missing required fields' };
            }
            const mismatched = group.memories.filter(m => m.client_id !== group.client_id);
            if (mismatched.length > 0) {
                return { pass: false, details: `Group ${group.client} contains memories from other clients` };
            }
        }
        return { pass: true, details: `All ${results.length} client groups correctly segregated` };
    } catch (err) {
        return { pass: false, details: `Error: ${err.message}` };
    }
}

async function runAll() {
    console.log('=== Client Architecture Verification Tests ===\n');
    const tests = [
        { name: 'Test 1', fn: test1 },
        { name: 'Test 2', fn: test2 },
        { name: 'Test 3', fn: test3 },
        { name: 'Test 4', fn: test4 },
        { name: 'Test 5', fn: test5 },
        { name: 'Test 6', fn: test6 },
        { name: 'Test 7', fn: test7 }
    ];
    const results = [];
    for (const test of tests) {
        const result = await test.fn();
        results.push({ ...result, name: test.name });
        console.log(`${test.name}: ${result.pass ? 'PASS' : 'FAIL'} — ${result.details}\n`);
    }
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`\nSummary: ${passed}/${total} tests passed`);
    return { passed, total, results };
}

if (require.main === module) {
    runAll().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { test1, test2, test3, test4, test5, test6, test7, runAll };