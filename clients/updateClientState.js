'use strict';

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

async function getClientState(clientId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('memories')
    .select('id, content, created_at')
    .eq('client_id', clientId)
    .eq('type', 'client_state')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`getClientState failed for ${clientId}: ${error.message}`);
  if (!data || data.length === 0) return null;

  const row = data[0];
  const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  return { rowId: row.id, createdAt: row.created_at, state: content };
}

async function updateClientState(clientId, updates, options = {}) {
  const supabase = getSupabase();
  const { importance = 10, extra_tags = [] } = options;

  const current = await getClientState(clientId);
  const currentState = current ? current.state : {};
  const previousVersionId = current ? current.rowId : null;

  const newState = {
    ...currentState,
    ...updates,
    _version: new Date().toISOString(),
    _previous_version_id: previousVersionId
  };

  const tags = ['client_state', clientId, ...extra_tags];

  const { data, error } = await supabase
    .from('memories')
    .insert({
      type: 'client_state',
      client_id: clientId,
      content: JSON.stringify(newState),
      importance,
      tags,
      confidence_level: 'high'
    })
    .select('id')
    .single();

  if (error) throw new Error(`updateClientState failed for ${clientId}: ${error.message}`);
  return { newRowId: data.id, previousVersionId, version: newState._version };
}

async function getClientStateHistory(clientId, maxDepth = 10) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('memories')
    .select('id, content, created_at')
    .eq('client_id', clientId)
    .eq('type', 'client_state')
    .order('created_at', { ascending: false })
    .limit(maxDepth);

  if (error) throw new Error(`getClientStateHistory failed for ${clientId}: ${error.message}`);
  if (!data || data.length === 0) return [];

  return data.map(row => {
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    return {
      rowId: row.id,
      createdAt: row.created_at,
      version: content._version || row.created_at,
      previousVersionId: content._previous_version_id || null,
      state: content
    };
  });
}

module.exports = { getClientState, updateClientState, getClientStateHistory };
