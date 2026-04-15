const { createClient } = require('@supabase/supabase-js');
const { clients } = require('./registry.js');
const { getClientState } = require('./client_state.js');
const { sendMessage } = require('../cron/message_bridge.js');
const { logAuditEvent } = require('../security/audit_logger.js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getClientContext(client_id, query) {
 const client = clients.find(c => c.id === client_id);
 if (!client) throw new Error(`Invalid client_id: '${client_id}'`);

 // Always load client state first
 const state = await getClientState(client_id);

 let memories = [];
 // Semantic search with hard client_id filter
 const { data: results, error } = await supabase.rpc('semantic_search_filtered', {
 query_text: query,
 filter_client_id: client_id,
 match_threshold: 0.25,
 match_count: 5
 });

 if (error) {
 // Fallback: direct filter query
 const { data: fallback } = await supabase
 .from('memories')
 .select('*')
 .eq('client_id', client_id)
 .order('importance', { ascending: false })
 .limit(5);
 memories = fallback || [];
 } else {
 // Verify no cross-client contamination -- hard check
 const clean = (results || []).filter(r => r.client_id === client_id);
 if (clean.length !== (results || []).length) {
 console.error(`CROSS-CLIENT CONTAMINATION DETECTED for ${client_id}. Filtered out ${(results || []).length - clean.length} records.`);
 }
 memories = clean;
 }

 // Audit logging
 await logAuditEvent({
 event_type: 'client_data_access',
 client_id,
 memory_id: null,
 action: 'getClientContext',
 details: { query, memories_returned: memories.length }
 });

 return { state, memories, client: client.name };
}

async function confirmActiveClient(client_id) {
 const client = clients.find(c => c.id === client_id);
 if (!client) throw new Error(`Invalid client_id: '${client_id}'`);
 await sendMessage(`ACTIVE CLIENT: ${client.name}\nAll actions will be scoped to this client. Confirm? Reply YES to proceed.`);
 
 // Audit logging
 await logAuditEvent({
 event_type: 'client_confirmation',
 client_id,
 memory_id: null,
 action: 'confirmActiveClient',
 details: { client_name: client.name }
 });
 
 return client.name;
}

function getConfidenceWarning(confidence_level) {
 if (confidence_level === 'medium') return 'NOTE: This information is from a conversational source and should be verified before use in live contexts.';
 if (confidence_level === 'low') return 'WARNING: This information has not been verified. Do not use in live client contexts without confirmation.';
 return null;
}

async function crossClientAnalysis(query) {
 // Only runs when explicitly requested -- never automatic
 const allResults = [];
 for (const client of clients) {
 const { data } = await supabase
 .from('memories')
 .select('*')
 .eq('client_id', client.id)
 .order('importance', { ascending: false })
 .limit(3);
 if (data && data.length > 0) {
 allResults.push({ client: client.name, client_id: client.id, memories: data });
 }
 }
 
 // Audit logging
 await logAuditEvent({
 event_type: 'cross_client_analysis',
 client_id: null,
 memory_id: null,
 action: 'crossClientAnalysis',
 details: { query, clients_queried: allResults.map(r => r.client_id) }
 });
 
 return allResults; // Always grouped by client, never mixed
}

module.exports = { getClientContext, confirmActiveClient, getConfidenceWarning, crossClientAnalysis };