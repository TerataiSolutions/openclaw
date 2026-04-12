# Tools Available

## Memory System (Supabase)

You have direct access to a Supabase database for persistent memory.
Use these tools constantly. This is your primary memory system.

### Save a memory

```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/memories" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"type\": \"TYPE\", \"content\": \"CONTENT\", \"importance\": NUMBER, \"tags\": [\"tag\"]}"
```

Valid types: user_fact, user_preference, conversation, decision, task, self_insight, pattern

### Load all memories

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?order=importance.desc,created_at.desc&limit=40&select=type,content,importance,tags,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

### Search memories by keyword

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?content=ilike.*KEYWORD*&order=importance.desc&limit=10&select=type,content,importance" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

### Generate embedding for semantic search

```bash
curl -s -X POST "${COHERE_ENDPOINT}" \
  -H "Authorization: Bearer ${COHERE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"texts": ["TEXT TO EMBED"], "model": "embed-english-v3.0", "input_type": "search_document"}'
```

**Note:** `COHERE_ENDPOINT` is configured as `https://api.cohere.ai/v1/embed`. The legacy environment variable `HUGGINGFACE_ENDPOINT` is an alias for the same endpoint.

Model: embed-english-v3.0 (Cohere)
Output: 1024-dimensional float array

### Save memory with embedding

```bash
EMBEDDING=$(curl -s -X POST "${COHERE_ENDPOINT}" \
  -H "Authorization: Bearer ${COHERE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"texts": ["MEMORY CONTENT"], "model": "embed-english-v3.0", "input_type": "search_document"}' \
  | jq -r '.embeddings[0]')

curl -s -X POST "${SUPABASE_URL}/rest/v1/memories" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"type\": \"user_fact\", \"content\": \"MEMORY CONTENT\", \"embedding\": ${EMBEDDING}, \"importance\": 8, \"tags\": [\"tag\"]}"
```

### Server‑side Semantic Search (Vector Index)

**Prerequisite:** Run the following SQL in Supabase SQL Editor to enable vector indexing and search function:

```sql
-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create IVFFlat index for cosine distance
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function for semantic search using cosine distance
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    type text,
    importance int,
    tags text[],
    created_at timestamptz
)
LANGUAGE sql STABLE AS $$
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) AS similarity,
        m.type,
        m.importance,
        m.tags,
        m.created_at
    FROM memories m
    WHERE (m.embedding <=> query_embedding) < 1 - match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
$$;
```

**Usage via curl:**

```bash
# 1. Generate embedding for your query
EMBEDDING=$(curl -s -X POST "${COHERE_ENDPOINT}" \
  -H "Authorization: Bearer ${COHERE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"texts": ["YOUR QUERY HERE"], "model": "embed-english-v3.0", "input_type": "search_query"}' \
  | jq -r '.embeddings[0]')

# 2. Call semantic_search RPC
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/semantic_search" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query_embedding\": ${EMBEDDING}, \"match_threshold\": 0.5, \"match_count\": 10}"
```

**Client‑side fallback:** If the RPC is not available, use `semantic_search_enhanced.js` (automatically falls back to client‑side cosine similarity). The older `semantic_search_cli.js` is deprecated.

### Using the enhanced Node.js script

```bash
node semantic_search_enhanced.js "your query here" 10 0.5
```

The script will attempt server‑side search first; if the RPC function is missing, it computes similarity client‑side.

### Log a soul change

```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/identity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"change_summary\": \"WHAT CHANGED AND WHY\", \"new_soul\": \"FULL SOUL CONTENT\"}"
```

## Supabase Schema Reference

Table: memories
- id: uuid (auto-generated)
- created_at: timestamptz (auto-generated)
- type: text (required, see valid types above)
- content: text (required, complete specific sentence)
- embedding: vector(1024) (optional, from Cohere embed-english-v3.0)
- importance: integer 1-10 (default 5)
- last_accessed: timestamptz
- access_count: integer
- tags: text array

Table: identity_log
- id: uuid (auto-generated)
- created_at: timestamptz (auto-generated)
- change_summary: text (required)
- previous_soul: text (optional)
- new_soul: text (optional)

## Embedding Model

Model: embed-english-v3.0 (Cohere)
Dimensions: 1024
Endpoint: ${COHERE_ENDPOINT} (configured to https://api.cohere.ai/v1/embed)
API Key: ${COHERE_API_KEY}
Use for: converting memory content to vectors for semantic similarity search

**Note:** The environment variable `HUGGINGFACE_ENDPOINT` is a legacy alias for `COHERE_ENDPOINT`. You can safely remove `HUGGINGFACE_API_KEY` from your environment.