-- =============================================================================
-- Migration 00001: Extensions
-- ARIA — Annotation RAG Intelligence Assistant
-- Run once per database. All CREATE EXTENSION calls are idempotent.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS vector;         -- pgvector: embeddings + ANN search
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- trigram index: fast ILIKE / similarity
CREATE EXTENSION IF NOT EXISTS btree_gin;      -- GIN index on scalar types
