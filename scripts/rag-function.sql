-- RAG: vector similarity search function
-- Run this AFTER migration.sql in Supabase SQL editor

CREATE OR REPLACE FUNCTION match_policy_chunks(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5,
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  policy_id UUID,
  document_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.content,
    pc.metadata,
    1 - (pc.embedding <=> query_embedding) AS similarity,
    pc.policy_id,
    pc.document_id
  FROM policy_chunks pc
  WHERE pc.company_id = p_company_id
    AND pc.embedding IS NOT NULL
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
