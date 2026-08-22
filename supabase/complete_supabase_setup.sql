-- =============================================================================
-- ARIA COMPLETE SUPABASE DATABASE SETUP (Extensions, Enums, Schema, Indexes, Seed)
-- Run this complete script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mstdshwztxwjsdiesnbv/sql
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 2. ENUMS
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('pending', 'active', 'inactive', 'suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE role_scope AS ENUM ('system', 'organization', 'project'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('draft', 'active', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'ready', 'indexed', 'failed', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE doc_type AS ENUM ('manual', 'spec', 'faq', 'guide', 'annotation_schema', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE chunk_status AS ENUM ('pending', 'embedded', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE message_role AS ENUM ('system', 'user', 'assistant'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('active', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE feedback_rating AS ENUM ('thumbs_up', 'thumbs_down', 'like', 'dislike'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'upload', 'download', 'invite', 'revoke', 'export'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. CORE TABLES

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  website     TEXT,
  settings    JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  scope       role_scope NOT NULL DEFAULT 'project',
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  status          user_status NOT NULL DEFAULT 'active',
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  status          project_status NOT NULL DEFAULT 'active',
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  author          TEXT,
  doc_type        doc_type NOT NULL DEFAULT 'other',
  status          doc_status NOT NULL DEFAULT 'ready',
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  file_size_bytes BIGINT,
  mime_type       TEXT,
  page_count      INTEGER,
  language        TEXT NOT NULL DEFAULT 'en',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size_bytes BIGINT,
  checksum        TEXT,
  change_summary  TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

-- Document Chunks (Vector 1024d for BGE-M3 dense embeddings)
CREATE TABLE IF NOT EXISTS document_chunks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  chunk_index         INTEGER NOT NULL,
  content             TEXT NOT NULL,
  token_count         INTEGER,
  embedding           vector(1024),
  tsv_content         tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  status              chunk_status NOT NULL DEFAULT 'embedded',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Vector & Search Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING gin (tsv_content);
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);

-- Conversations & Messages
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  title           TEXT NOT NULL DEFAULT 'New Conversation',
  status          conversation_status NOT NULL DEFAULT 'active',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT NOT NULL,
  reasoning_content TEXT,
  token_count     INTEGER,
  latency_ms      REAL,
  model           TEXT,
  feedback_rating TEXT,
  feedback_reason TEXT,
  feedback_comment TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback & Knowledge Gap Queue
CREATE TABLE IF NOT EXISTS chat_feedback (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  query             TEXT NOT NULL,
  response_content  TEXT,
  rating            TEXT NOT NULL,
  reason            TEXT,
  comment           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  resource_name   TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  status          TEXT NOT NULL DEFAULT 'success',
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SEED INITIAL ROLES & DEENA CHANDRAN (SUPER_ADMIN)
INSERT INTO roles (name, description, scope, permissions, is_system) VALUES
('SUPER_ADMIN', 'Platform Super Administrator with absolute access', 'system', '["*"]'::jsonb, TRUE),
('ADMIN', 'Organization Administrator with full tenant access', 'organization', '["org.*", "user.*", "project.*", "admin.*"]'::jsonb, TRUE),
('MANAGER', 'Team & Project Manager', 'organization', '["project.read", "project.write", "doc.read", "doc.write"]'::jsonb, TRUE),
('ANNOTATOR', '3D Perception Annotator', 'project', '["annotation.read", "annotation.write", "doc.read"]'::jsonb, TRUE),
('QC', 'Quality Control Inspector', 'project', '["annotation.review", "doc.read"]'::jsonb, TRUE),
('VALIDATOR', 'Autonomous Systems Validator', 'project', '["validation.read", "doc.read"]'::jsonb, TRUE),
('VIEWER', 'Read-only Auditor / Observer', 'project', '["view.read"]'::jsonb, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed Organization
INSERT INTO organizations (id, name, slug, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Autocruise Dynamics AI', 'autocruise-ai', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Super Admin User (Deena Chandran)
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'SUPER_ADMIN';
  INSERT INTO users (id, organization_id, role_id, email, name, status, metadata)
  VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    v_role_id,
    'deenathedev@protonmail.com',
    'Deena Chandran',
    'active',
    '{"title": "Head of AI & Perception", "role_badge": "SUPER_ADMIN"}'::jsonb
  ) ON CONFLICT (email) DO NOTHING;
END $$;
