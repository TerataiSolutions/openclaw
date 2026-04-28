/**
 * session-primer.js — Context priming at session start.
 *
 * Takes a user query (first message), generates an embedding, and finds the
 * top-5 semantically related memories. Returns a context block injected into
 * the session preamble so Aether never starts cold.
 *
 * This implements HEARTBEAT.md §8.3 (Context Priming) and closes the gap
 * identified in the production audit: semantic search was available but not
 * wired into session initialization.
 */

const { getSupabaseClient } = require('./clients/supabase');
const { generateEmbedding } = require('./clients/cohere');

/**
 * Retrieve the top-N semantically similar memories for a query.
 * Falls back to the 5 most recent memories if the query is too short
 * to generate a meaningful embedding or if the RPC is unavailable.
 *
 * @param {string} query - The user's first message or an explicit search query.
 * @param {object} [opts]
 * @param {number} [opts.limit=5]
 * @param {number} [opts.threshold=0.5]
 * @returns {Promise<Array<{content: string, type: string, importance: number, similarity: number, created_at: string}>>}
 */
async function searchMemories(query, opts = {}) {
  const limit = opts.limit || 5;
  const threshold = opts.threshold || 0.5;

  // If query is too short or ambiguous, fall back to recent memories
  if (!query || query.split(/\s+/).filter(Boolean).length < 3) {
    return getRecentMemories(limit);
  }

  try {
    const embedding = await generateEmbedding(query, 'search_query');
    if (!embedding || !embedding.length) {
      return getRecentMemories(limit);
    }

    const sb = getSupabaseClient();
    const { data, error } = await sb.rpc('semantic_search', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('[session-primer] RPC failed, falling back to recents:', error.message);
      return getRecentMemories(limit);
    }

    return data || [];
  } catch (err) {
    console.error('[session-primer] Search failed, falling back to recents:', err.message);
    return getRecentMemories(limit);
  }
}

/**
 * Fallback: fetch the N most recent memories by created_at.
 */
async function getRecentMemories(limit = 5) {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('memories')
      .select('content, type, importance, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(m => ({ ...m, similarity: 0 }));
  } catch (err) {
    console.error('[session-primer] Recent fetch failed:', err.message);
    return [];
  }
}

/**
 * Generate a context string for session priming.
 * Returns an empty string if no memories are found.
 */
async function primeSessionContext(userQuery) {
  const related = await searchMemories(userQuery, { limit: 5, threshold: 0.5 });

  if (related.length === 0) {
    return '';
  }

  const lines = related.map(m => {
    const label = m.type === 'conversation' ? '' : `[${m.type}] `;
    const similarity = m.similarity > 0
      ? ` (${(m.similarity * 100).toFixed(0)}% match)`
      : ' (recent)';
    return `- ${label}${m.content.substring(0, 120)}${similarity}`;
  });

  return `\n**Relevant context from past conversations:**\n${lines.join('\n')}\n`;
}

module.exports = { primeSessionContext, searchMemories };
