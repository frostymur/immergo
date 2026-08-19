-- Alem embedder (text-1024) produces 1024-dim vectors; resize the column.
-- Existing data has none (test rows removed), so a plain ALTER is safe.

DROP INDEX IF EXISTS document_chunks_embedding_idx;
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);