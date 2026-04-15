const { createClient } = require('@supabase/supabase-js');
const { saveMemoryWithEmbedding } = require('../utils.js');
const { clients } = require('./registry.js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const BLANK_STATE = {
 current_campaign_strategy: 'Not yet established',
 last_interaction_summary: 'Not yet established',
 active_priorities: [],
 open_items: [],
 key_contacts: [],
 current_icp_focus: 'Not yet established',
 messaging_working: [],
 messaging_not_working: [],
 red_flags: [],
 last_updated: null
};

async function getClientState(client_id) {
 // Direct query -- never use semantic search for this
 const { data, error } = await supabase
 .from('memories')
 .select('*')
 .eq('client_id', client_id)
 .eq('type', 'client_state')
 .not('tags', 'cs', '{archived_state}')
 .order('created_at', { ascending: false })
 .limit(1);
 if (error) throw new Error(`Failed to fetch client state: ${error.message}`);
 if (!data || data.length === 0) return null;
 try {
 return JSON.parse(data[0].content);
 } catch (e) {
 throw new Error(`Failed to parse client state JSON: ${e.message}`);
 }
}

async function updateClientState(client_id, updates) {
 // Archive existing state
 const { data: existing } = await supabase
 .from('memories')
 .select('id, tags')
 .eq('client_id', client_id)
 .eq('type', 'client_state')
 .not('tags', 'cs', '{archived_state}')
 .limit(1);
 if (existing && existing.length > 0) {
 const currentTags = existing[0].tags || [];
 await supabase.from('memories').update({
 tags: [...currentTags, 'archived_state']
 }).eq('id', existing[0].id);
 }
 // Get current state and merge
 const currentState = existing && existing.length > 0
 ? JSON.parse((await supabase.from('memories').select('content').eq('id', existing[0].id).single()).data.content)
 : { ...BLANK_STATE };
 const newState = { ...currentState, ...updates, last_updated: new Date().toISOString() };
 // Save new state
 await saveMemoryWithEmbedding({
 type: 'client_state',
 content: JSON.stringify(newState),
 importance: 10,
 tags: ['client_state', client_id],
 client_id,
 confidence_level: 'high'
 });
 return newState;
}

async function initializeClientState(client_id) {
 const clientExists = clients.find(c => c.id === client_id);
 if (!clientExists) throw new Error(`Invalid client_id: '${client_id}'`);
 const existing = await getClientState(client_id);
 if (existing) {
 console.log(`Client state already exists for ${client_id}. Skipping initialization.`);
 return existing;
 }
 const state = { ...BLANK_STATE, last_updated: new Date().toISOString() };
 await saveMemoryWithEmbedding({
 type: 'client_state',
 content: JSON.stringify(state),
 importance: 10,
 tags: ['client_state', client_id],
 client_id,
 confidence_level: 'high'
 });
 console.log(`Client state initialized for ${client_id}`);
 return state;
}

async function getStateField(client_id, field_name) {
 const state = await getClientState(client_id);
 if (!state) return null;
 return state[field_name] ?? null;
}

module.exports = { getClientState, updateClientState, initializeClientState, getStateField };