-- =============================================================================
-- Migration 00003: Core Schema
-- ARIA — Annotation RAG Intelligence Assistant
--
-- Table creation order respects FK dependencies:
--   organizations → departments → teams → users/roles
--   → projects → project_members
--   → documents → document_versions → document_chunks
--   → conversations → messages → message_sources
--   → feedback
--   → audit_logs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at on any row modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Convenience macro — call after each table that has updated_at
CREATE OR REPLACE PROCEDURE add_updated_at_trigger(p_table TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_%I_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
    p_table, p_table
  );
END;
$$;

-- ============================================================================
-- 1. ORGANIZATIONS
--    Top-level tenant boundary. Every other record roots back to an org.
-- ============================================================================
CREATE TABLE organizations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,  -- e.g. "acme-corp"
  logo_url    TEXT,
  website     TEXT,
  settings    JSONB       NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL add_updated_at_trigger('organizations');

CREATE INDEX idx_orgs_slug      ON organizations (slug);
CREATE INDEX idx_orgs_active    ON organizations (is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. DEPARTMENTS
--    Optional grouping within an org (e.g. "Perception", "QA").
-- ============================================================================
CREATE TABLE departments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_dept_name_per_org UNIQUE (organization_id, name)
);

CALL add_updated_at_trigger('departments');

CREATE INDEX idx_departments_org ON departments (organization_id);

-- ============================================================================
-- 3. ROLES
--    Named permission sets. Scoped to system / org / project.
--    System roles (is_system=TRUE) cannot be deleted.
-- ============================================================================
CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  scope       role_scope  NOT NULL DEFAULT 'organization',
  permissions JSONB       NOT NULL DEFAULT '[]',   -- ["document.read", "project.write", …]
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_name_scope UNIQUE (name, scope)
);

CALL add_updated_at_trigger('roles');

-- Seed system roles (idempotent via ON CONFLICT)
INSERT INTO roles (name, scope, permissions, is_system, description) VALUES
  ('super_admin',  'system',       '["*"]',
   TRUE,  'Full platform access'),
  ('org_admin',    'organization', '["org.*","project.*","user.*","document.*"]',
   TRUE,  'Full access within an organisation'),
  ('project_lead', 'project',      '["project.read","project.write","document.*","conversation.*","user.invite"]',
   TRUE,  'Manages a project and its members'),
  ('annotator',    'project',      '["project.read","document.read","document.upload","conversation.*"]',
   TRUE,  'Creates and reviews annotations'),
  ('viewer',       'project',      '["project.read","document.read","conversation.read"]',
   TRUE,  'Read-only access to a project')
ON CONFLICT (name, scope) DO NOTHING;

-- ============================================================================
-- 4. USERS
--    One row per human. Tied to one org; may join many teams and projects.
-- ============================================================================
CREATE TABLE users (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id         UUID        REFERENCES roles(id) ON DELETE SET NULL,
  email           TEXT        NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  avatar_url      TEXT,
  status          user_status NOT NULL DEFAULT 'pending',
  last_seen_at    TIMESTAMPTZ,
  metadata        JSONB       NOT NULL DEFAULT '{}',  -- extra profile fields
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL add_updated_at_trigger('users');

CREATE INDEX idx_users_org     ON users (organization_id);
CREATE INDEX idx_users_role    ON users (role_id);
CREATE INDEX idx_users_status  ON users (status);
CREATE INDEX idx_users_email   ON users USING gin (email gin_trgm_ops); -- fast email search

-- ============================================================================
-- 5. TEAMS
--    Cross-functional groups within a department.
-- ============================================================================
CREATE TABLE teams (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_team_name_per_org UNIQUE (organization_id, name)
);

CALL add_updated_at_trigger('teams');

CREATE INDEX idx_teams_org  ON teams (organization_id);
CREATE INDEX idx_teams_dept ON teams (department_id);

-- Team ↔ User membership (many-to-many)
CREATE TABLE team_members (
  team_id   UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id   UUID        REFERENCES roles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members (user_id);

-- ============================================================================
-- 6. PROJECTS
--    The main unit of work. Documents and conversations live inside projects.
-- ============================================================================
CREATE TABLE projects (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         UUID           REFERENCES teams(id) ON DELETE SET NULL,
  created_by      UUID           REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT           NOT NULL,
  description     TEXT,
  status          project_status NOT NULL DEFAULT 'active',
  settings        JSONB          NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CALL add_updated_at_trigger('projects');

CREATE INDEX idx_projects_org    ON projects (organization_id);
CREATE INDEX idx_projects_team   ON projects (team_id);
CREATE INDEX idx_projects_status ON projects (status);

-- ============================================================================
-- 7. PROJECT MEMBERS
--    Controls who can access a project and at what role level.
-- ============================================================================
CREATE TABLE project_members (
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role_id    UUID        REFERENCES roles(id) ON DELETE SET NULL,
  invited_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user    ON project_members (user_id);
CREATE INDEX idx_project_members_project ON project_members (project_id);
CREATE INDEX idx_project_members_role    ON project_members (role_id);

-- ============================================================================
-- 8. DOCUMENTS
--    Source knowledge assets uploaded to a project.
-- ============================================================================
CREATE TABLE documents (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  doc_type        doc_type    NOT NULL DEFAULT 'other',
  status          doc_status  NOT NULL DEFAULT 'pending',
  source_url      TEXT,                    -- original URL or cloud storage path
  file_size_bytes BIGINT,
  mime_type       TEXT,
  page_count      INTEGER,
  language        TEXT        NOT NULL DEFAULT 'en',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL add_updated_at_trigger('documents');

CREATE INDEX idx_documents_project ON documents (project_id);
CREATE INDEX idx_documents_org     ON documents (organization_id);
CREATE INDEX idx_documents_status  ON documents (status);
CREATE INDEX idx_documents_type    ON documents (doc_type);
CREATE INDEX idx_documents_title   ON documents USING gin (title gin_trgm_ops);

-- ============================================================================
-- 9. DOCUMENT VERSIONS
--    Immutable snapshot each time a document file is replaced.
--    New upload → new version_number. Old versions kept for audit.
-- ============================================================================
CREATE TABLE document_versions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  version_number INTEGER     NOT NULL,          -- monotonically increasing per document
  storage_path   TEXT        NOT NULL,           -- S3 / Supabase Storage object key
  file_size_bytes BIGINT,
  checksum       TEXT,                           -- SHA-256 hex for dedup
  change_summary TEXT,                           -- optional human note
  is_current     BOOLEAN     NOT NULL DEFAULT TRUE,  -- only one TRUE per document
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_doc_version UNIQUE (document_id, version_number)
);

CREATE INDEX idx_doc_versions_doc     ON document_versions (document_id);
CREATE INDEX idx_doc_versions_current ON document_versions (document_id, is_current) WHERE is_current = TRUE;

-- Ensure only one current version per document
CREATE UNIQUE INDEX idx_doc_one_current
  ON document_versions (document_id)
  WHERE is_current = TRUE;

-- ============================================================================
-- 10. DOCUMENT CHUNKS
--     Fixed-size text segments used for embedding and RAG retrieval.
--     embedding column holds the pgvector vector.
-- ============================================================================
CREATE TABLE document_chunks (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID         NOT NULL REFERENCES documents(id)         ON DELETE CASCADE,
  version_id  UUID         REFERENCES document_versions(id)          ON DELETE SET NULL,
  chunk_index INTEGER      NOT NULL,            -- 0-based position within the document
  content     TEXT         NOT NULL,            -- raw text of this chunk
  token_count INTEGER,                          -- approximate token count
  status      chunk_status NOT NULL DEFAULT 'pending',
  embedding   vector(1536),                     -- pgvector: 1536-dim for OpenAI / DeepSeek-v2
  metadata    JSONB        NOT NULL DEFAULT '{}', -- page_num, section, headings, bbox, …
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_chunk_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks (document_id);
CREATE INDEX idx_chunks_version  ON document_chunks (version_id);
CREATE INDEX idx_chunks_status   ON document_chunks (status);

-- ANN index for cosine similarity search (IVFFlat — good for <1M vectors)
-- Increase `lists` to ~sqrt(rows) as dataset grows
CREATE INDEX idx_chunks_embedding
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- 11. CONVERSATIONS
--     A threaded chat session between a user and ARIA, optionally scoped
--     to a specific project for targeted retrieval.
-- ============================================================================
CREATE TABLE conversations (
  id         UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  project_id UUID                REFERENCES projects(id)          ON DELETE SET NULL,
  title      TEXT,               -- auto-generated or user-named
  status     conversation_status NOT NULL DEFAULT 'active',
  metadata   JSONB               NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CALL add_updated_at_trigger('conversations');

CREATE INDEX idx_conversations_user    ON conversations (user_id);
CREATE INDEX idx_conversations_project ON conversations (project_id);
CREATE INDEX idx_conversations_status  ON conversations (status);
CREATE INDEX idx_conversations_updated ON conversations (updated_at DESC);

-- ============================================================================
-- 12. MESSAGES
--     Individual turns within a conversation.
-- ============================================================================
CREATE TABLE messages (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT         NOT NULL,
  token_count     INTEGER,               -- prompt+completion tokens for cost tracking
  model_used      TEXT,                  -- "deepseek-chat", "gpt-4o-mini", etc.
  latency_ms      INTEGER,               -- wall-clock time to first token
  finish_reason   TEXT,                  -- "stop", "length", "tool_calls"
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_role         ON messages (role);
CREATE INDEX idx_messages_created      ON messages (conversation_id, created_at ASC);

-- ============================================================================
-- 13. MESSAGE SOURCES
--     Which document chunks were used to answer a specific assistant message.
--     Enables UI citation / "Sources" panel.
-- ============================================================================
CREATE TABLE message_sources (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID        NOT NULL REFERENCES messages(id)         ON DELETE CASCADE,
  chunk_id    UUID        REFERENCES document_chunks(id)            ON DELETE SET NULL,
  document_id UUID        REFERENCES documents(id)                  ON DELETE SET NULL,
  relevance   REAL,                     -- cosine similarity score [0, 1]
  excerpt     TEXT,                     -- short snippet shown to the user
  page_number INTEGER,                  -- optional page reference
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_relevance CHECK (relevance IS NULL OR (relevance >= 0 AND relevance <= 1))
);

CREATE INDEX idx_sources_message  ON message_sources (message_id);
CREATE INDEX idx_sources_chunk    ON message_sources (chunk_id);
CREATE INDEX idx_sources_document ON message_sources (document_id);

-- ============================================================================
-- 14. FEEDBACK
--     Per-message thumbs-up / thumbs-down from users.
--     One rating per (message, user) pair — enforced by primary key.
-- ============================================================================
CREATE TABLE feedback (
  id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID            NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID            NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rating     feedback_rating NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_feedback_per_user UNIQUE (message_id, user_id)
);

CALL add_updated_at_trigger('feedback');

CREATE INDEX idx_feedback_message ON feedback (message_id);
CREATE INDEX idx_feedback_user    ON feedback (user_id);
CREATE INDEX idx_feedback_rating  ON feedback (rating);

-- ============================================================================
-- 15. AUDIT LOGS
--     Append-only tamper-resistant event log. No UPDATE / DELETE ever.
-- ============================================================================
CREATE TABLE audit_logs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID         REFERENCES organizations(id) ON DELETE SET NULL,
  user_id     UUID         REFERENCES users(id)         ON DELETE SET NULL,
  action      audit_action NOT NULL,
  resource    TEXT         NOT NULL,   -- table / entity name, e.g. "document"
  resource_id UUID,                    -- pk of the affected row
  ip_address  INET,
  user_agent  TEXT,
  old_value   JSONB,                   -- state before change (UPDATE/DELETE)
  new_value   JSONB,                   -- state after change  (CREATE/UPDATE)
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()

  -- No updated_at — audit rows are immutable
);

CREATE INDEX idx_audit_org      ON audit_logs (org_id);
CREATE INDEX idx_audit_user     ON audit_logs (user_id);
CREATE INDEX idx_audit_action   ON audit_logs (action);
CREATE INDEX idx_audit_resource ON audit_logs (resource, resource_id);
CREATE INDEX idx_audit_created  ON audit_logs (created_at DESC);
