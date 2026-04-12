-- Update semantic_search function default threshold from 0.65 to 0.25
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.25,   -- changed from 0.65
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
    WHERE m.embedding IS NOT NULL
      AND (m.embedding <=> query_embedding) < 1 - match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Verify the change
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'semantic_search';