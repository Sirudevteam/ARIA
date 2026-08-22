-- =============================================================================
-- Migration: 00002_full_schema.sql
-- ARIA — Annotation RAG Intelligence Assistant
-- Full production schema
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for full-text search on text fields

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_status        AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE role_scope         AS ENUM ('system', 'organization', 'project');
CREATE TYPE project_status     AS ENUM ('active', 'archived', 'draft');
CREATE TYPE doc_status         AS ENUM ('pending', 'processing', 'indexed', 'failed', 'archived');
CREATE TYPE doc_type           AS ENUM ('manual', 'spec', 'faq', 'guide', 'annotation_schema', 'other');
CREATE TYPE chunk_status       AS ENUM ('pending', 'embedded', 'failed');
CREATE TYPE message_role       AS ENUM ('user', 'assistant', 'system');
CREATE TYPE conversation_status AS ENUM ('active', 'archived');
CREATE TYPE feedback_rating    AS ENUM ('thumbs_up', 'thumbs_down');
CREATE TYPE audit_action       AS ENUM (
  'create', 'read', 'update', 'delete',
  'login', 'logout', 'upload', 'download',
  'invite', 'revoke', 'export'
);

-- =============================================================================
-- HELPER: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro to attach the trigger to any table
CREATE OR REPLACE PROCEDURE attach_updated_at(tbl TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl
  );
END;
$$;

-- =============================================================================
-- 1. ORGANIZATIONS
-- =============================================================================

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,           -- URL-friendly identifier
  logo_url    TEXT,
  settings    JSONB NOT NULL DEFAULT '{}',    -- feature flags, limits, etc.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('organizations');
CREATE INDEX idx_organizations_slug ON organizations (slug);

-- =============================================================================
-- 2. DEPARTMENTS
-- =============================================================================

CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, name)
);

CALL attach_updated_at('departments');
CREATE INDEX idx_departments_org ON departments (organization_id);

-- =============================================================================
-- 3. ROLES
-- =============================================================================

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  scope       role_scope NOT NULL DEFAULT 'organization',
  permissions JSONB NOT NULL DEFAULT '[]',   -- array of permission strings
  is_system   BOOLEAN NOT NULL DEFAULT FALSE, -- system roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (name, scope)
);

CALL attach_updated_at('roles');

-- Seed default system roles
INSERT INTO roles (name, scope, permissions, is_system) VALUES
  ('super_admin',  'system',       '["*"]',                             TRUE),
  ('org_admin',    'organization', '["org.*","project.*","user.*"]',    TRUE),
  ('project_lead', 'project',      '["project.read","project.write","document.*","conversation.*"]', TRUE),
  ('annotator',    'project',      '["project.read","document.read","conversation.*"]', TRUE),
  ('viewer',       'project',      '["project.read","document.read","conversation.read"]', TRUE);

-- =============================================================================
-- 4. USERS
-- =============================================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  status          user_status NOT NULL DEFAULT 'pending',
  last_seen_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('users');
CREATE INDEX idx_users_org        ON users (organization_id);
CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_role       ON users (role_id);
CREATE INDEX idx_users_status     ON users (status);

-- =============================================================================
-- 5. TEAMS
-- =============================================================================

CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, name)
);

CALL attach_updated_at('teams');
CREATE INDEX idx_teams_org    ON teams (organization_id);
CREATE INDEX idx_teams_dept   ON teams (department_id);

-- Team membership (users ↔ teams)
CREATE TABLE team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID REFERENCES roles(id) ON DELETE SET NULL,  -- team-level role override
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members (user_id);

-- =============================================================================
-- 6. PROJECTS
-- =============================================================================

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  status          project_status NOT NULL DEFAULT 'active',
  settings        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('projects');
CREATE INDEX idx_projects_org    ON projects (organization_id);
CREATE INDEX idx_projects_team   ON projects (team_id);
CREATE INDEX idx_projects_status ON projects (status);

-- =============================================================================
-- 7. PROJECT MEMBERS
-- =============================================================================

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID REFERENCES roles(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user    ON project_members (user_id);
CREATE INDEX idx_project_members_project ON project_members (project_id);

-- =============================================================================
-- 8. DOCUMENTS
-- =============================================================================

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  doc_type        doc_type NOT NULL DEFAULT 'other',
  status          doc_status NOT NULL DEFAULT 'pending',
  source_url      TEXT,                          -- original URL or S3 path
  file_size_bytes BIGINT,
  mime_type       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',  -- tags, language, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('documents');
CREATE INDEX idx_documents_project ON documents (project_id);
CREATE INDEX idx_documents_org     ON documents (organization_id);
CREATE INDEX idx_documents_status  ON documents (status);
CREATE INDEX idx_documents_type    ON documents (doc_type);

-- =============================================================================
-- 9. DOCUMENT VERSIONS
-- =============================================================================

CREATE TABLE document_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  storage_path    TEXT NOT NULL,               -- S3/storage object path
  checksum        TEXT,                        -- SHA-256 of file content
  change_summary  TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, version_number)
);

CREATE INDEX idx_doc_versions_doc ON document_versions (document_id);

-- =============================================================================
-- 10. DOCUMENT CHUNKS  (RAG backbone)
-- =============================================================================

CREATE TABLE document_chunks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  chunk_index     INTEGER NOT NULL,            -- order within document
  content         TEXT NOT NULL,               -- raw text of the chunk
  token_count     INTEGER,
  status          chunk_status NOT NULL DEFAULT 'pending',
  embedding       vector(1536),                -- OpenAI / DeepSeek embedding dim
  metadata        JSONB NOT NULL DEFAULT '{}', -- page num, section, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks (document_id);
CREATE INDEX idx_chunks_status   ON document_chunks (status);

-- pgvector cosine similarity index (used by RAG retrieval)
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- 11. CONVERSATIONS
-- =============================================================================

CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  status      conversation_status NOT NULL DEFAULT 'active',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('conversations');
CREATE INDEX idx_conversations_user    ON conversations (user_id);
CREATE INDEX idx_conversations_project ON conversations (project_id);
CREATE INDEX idx_conversations_status  ON conversations (status);

-- =============================================================================
-- 12. MESSAGES
-- =============================================================================

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             message_role NOT NULL,
  content          TEXT NOT NULL,
  token_count      INTEGER,
  model_used       TEXT,                        -- e.g. "deepseek-chat", "gpt-4o"
  latency_ms       INTEGER,                     -- time to generate response
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_role         ON messages (role);
CREATE INDEX idx_messages_created      ON messages (created_at DESC);

-- =============================================================================
-- 13. MESSAGE SOURCES  (RAG citations)
-- =============================================================================

CREATE TABLE message_sources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chunk_id     UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  relevance    FLOAT,                          -- cosine similarity score 0–1
  excerpt      TEXT,                           -- snippet shown to user
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sources_message  ON message_sources (message_id);
CREATE INDEX idx_sources_document ON message_sources (document_id);

-- =============================================================================
-- 14. FEEDBACK
-- =============================================================================

CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      feedback_rating NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (message_id, user_id)  -- one rating per user per message
);

CREATE INDEX idx_feedback_message ON feedback (message_id);
CREATE INDEX idx_feedback_user    ON feedback (user_id);
CREATE INDEX idx_feedback_rating  ON feedback (rating);

-- =============================================================================
-- 15. AUDIT LOGS
-- =============================================================================

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action       audit_action NOT NULL,
  resource     TEXT NOT NULL,   -- e.g. "document", "conversation", "user"
  resource_id  UUID,            -- ID of the affected record
  ip_address   INET,
  user_agent   TEXT,
  old_value    JSONB,           -- snapshot before change
  new_value    JSONB,           -- snapshot after change
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs are append-only — no updated_at needed
CREATE INDEX idx_audit_user      ON audit_logs (user_id);
CREATE INDEX idx_audit_org       ON audit_logs (org_id);
CREATE INDEX idx_audit_action    ON audit_logs (action);
CREATE INDEX idx_audit_resource  ON audit_logs (resource, resource_id);
CREATE INDEX idx_audit_created   ON audit_logs (created_at DESC);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Active project members with user + role details
CREATE OR REPLACE VIEW v_project_members AS
SELECT
  pm.project_id,
  pm.user_id,
  u.name        AS user_name,
  u.email       AS user_email,
  u.avatar_url,
  r.name        AS role_name,
  r.permissions,
  pm.joined_at
FROM project_members pm
JOIN users u ON u.id = pm.user_id
LEFT JOIN roles r ON r.id = pm.role_id;

-- Document with latest version info
CREATE OR REPLACE VIEW v_documents_latest AS
SELECT
  d.*,
  dv.version_number  AS latest_version,
  dv.storage_path    AS latest_path,
  dv.checksum        AS latest_checksum,
  dv.created_at      AS last_uploaded_at
FROM documents d
LEFT JOIN LATERAL (
  SELECT * FROM document_versions
  WHERE document_id = d.id
  ORDER BY version_number DESC
  LIMIT 1
) dv ON TRUE;
