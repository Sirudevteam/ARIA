-- =============================================================================
-- Migration 00002: Enum Types
-- ARIA — Annotation RAG Intelligence Assistant
-- All custom PostgreSQL enum types used across the schema.
-- =============================================================================

-- User lifecycle
CREATE TYPE user_status AS ENUM (
  'pending',      -- invited, not yet activated
  'active',       -- fully active
  'inactive',     -- voluntarily disabled
  'suspended'     -- admin-disabled
);

-- Role scoping levels
CREATE TYPE role_scope AS ENUM (
  'system',       -- global platform role (super_admin)
  'organization', -- org-level role
  'project'       -- project-level role
);

-- Project lifecycle
CREATE TYPE project_status AS ENUM (
  'draft',        -- not yet published
  'active',       -- in use
  'archived'      -- read-only, historical
);

-- Document pipeline states
CREATE TYPE doc_status AS ENUM (
  'pending',      -- just uploaded, not yet processed
  'processing',   -- chunking / embedding in progress
  'indexed',      -- fully embedded, searchable
  'failed',       -- processing error
  'archived'      -- soft-removed from search
);

-- Document classification
CREATE TYPE doc_type AS ENUM (
  'manual',             -- user / operator manual
  'spec',               -- technical specification
  'faq',                -- FAQ document
  'guide',              -- how-to guide
  'annotation_schema',  -- LiDAR label taxonomy
  'other'
);

-- Embedding pipeline states
CREATE TYPE chunk_status AS ENUM (
  'pending',    -- text extracted, embedding not yet run
  'embedded',   -- vector stored in pgvector
  'failed'      -- embedding call failed
);

-- Chat message roles (aligns with LLM APIs)
CREATE TYPE message_role AS ENUM (
  'system',
  'user',
  'assistant'
);

-- Conversation lifecycle
CREATE TYPE conversation_status AS ENUM (
  'active',
  'archived'
);

-- Simple thumbs feedback
CREATE TYPE feedback_rating AS ENUM (
  'thumbs_up',
  'thumbs_down'
);

-- Audit trail action verbs
CREATE TYPE audit_action AS ENUM (
  'create',
  'read',
  'update',
  'delete',
  'login',
  'logout',
  'upload',
  'download',
  'invite',
  'revoke',
  'export'
);
