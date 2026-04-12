-- Enable pgvector extension (if not already enabled)
-- Run this in Supabase SQL Editor as superuser
CREATE EXTENSION IF NOT EXISTS vector;

-- Create an IVFFlat index for cosine distance on the embedding column
-- Adjust lists parameter based on dataset size (default 100 is fine for up to ~1M rows)
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function for semantic search using cosine distance
-- Returns memories where cosine similarity >= match_threshold
-- Ordered by similarity (descending) limited to match_count
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
LANGUAGE sql
STABLE
AS $$
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

-- Optional: Create a simpler function that returns all columns of memories table
-- and uses the built‑in pgvector cosine distance operator <=> (smaller is more similar)
CREATE OR REPLACE FUNCTION semantic_search_simple(
    query_embedding vector(1024),
    match_count int DEFAULT 10
)
RETURNS SETOF memories
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM memories
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Test the function with a dummy vector (optional)
-- SELECT * FROM semantic_search_simple('[0.1,0.2,...]'::vector(1024), 5);

-- Note: The operator <=> computes cosine distance (0 = identical, 2 = orthogonal).
-- We convert distance to similarity via 1 - distance.