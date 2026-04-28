/**
 * Generate a Cohere embedding for text.
 * Uses the global fetch available in Node 18+.
 */

async function generateEmbedding(text, input_type = 'search_document') {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY required');

  const endpoint = process.env.COHERE_ENDPOINT || 'https://api.cohere.ai/v1/embed';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-english-v3.0',
      input_type,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    throw new Error('Cohere response missing embeddings');
  }
  return data.embeddings[0];
}

module.exports = { generateEmbedding };
