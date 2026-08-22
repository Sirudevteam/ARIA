-- =============================================================================
-- Migration 00006: Row Level Security (Supabase RLS)
-- ARIA — Annotation RAG Intelligence Assistant
--
-- Policy design:
--   - auth.uid() maps to users.id via the users table
--   - Users can only see data within their own organization
--   - Project data requires project membership
--   - Audit logs are insert-only from app code; no user reads
-- =============================================================================

-- Helper: get the org_id for the currently authenticated user
CREATE OR REPLACE FUNCTION fn_auth_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

-- Helper: check if current user is a member of a project
CREATE OR REPLACE FUNCTION fn_is_project_member(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  )
$$;

-- Helper: check if current user has org-level admin role
CREATE OR REPLACE FUNCTION fn_is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   users u
    JOIN   roles r ON r.id = u.role_id
    WHERE  u.id = auth.uid()
      AND  r.name IN ('super_admin', 'org_admin')
  )
$$;

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS — users see only their own org
-- ============================================================================
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id = fn_auth_org_id());

CREATE POLICY org_update ON organizations FOR UPDATE
  USING (id = fn_auth_org_id() AND fn_is_org_admin());

-- ============================================================================
-- DEPARTMENTS — visible to all org members
-- ============================================================================
CREATE POLICY dept_select ON departments FOR SELECT
  USING (organization_id = fn_auth_org_id());

CREATE POLICY dept_write ON departments FOR ALL
  USING (organization_id = fn_auth_org_id() AND fn_is_org_admin());

-- ============================================================================
-- ROLES — readable by all; write by org admins
-- ============================================================================
CREATE POLICY roles_select ON roles FOR SELECT USING (TRUE);

CREATE POLICY roles_write ON roles FOR ALL
  USING (fn_is_org_admin() AND is_system = FALSE);

-- ============================================================================
-- USERS — see colleagues in the same org
-- ============================================================================
CREATE POLICY users_select ON users FOR SELECT
  USING (organization_id = fn_auth_org_id());

CREATE POLICY users_update_self ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY users_admin ON users FOR ALL
  USING (organization_id = fn_auth_org_id() AND fn_is_org_admin());

-- ============================================================================
-- TEAMS — visible within org
-- ============================================================================
CREATE POLICY teams_select ON teams FOR SELECT
  USING (organization_id = fn_auth_org_id());

CREATE POLICY teams_write ON teams FOR ALL
  USING (organization_id = fn_auth_org_id() AND fn_is_org_admin());

CREATE POLICY team_members_select ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND t.organization_id = fn_auth_org_id()
    )
  );

-- ============================================================================
-- PROJECTS — visible to project members only
-- ============================================================================
CREATE POLICY projects_select ON projects FOR SELECT
  USING (
    organization_id = fn_auth_org_id()
    AND (fn_is_project_member(id) OR fn_is_org_admin())
  );

CREATE POLICY projects_write ON projects FOR ALL
  USING (organization_id = fn_auth_org_id() AND fn_is_org_admin());

CREATE POLICY project_members_select ON project_members FOR SELECT
  USING (fn_is_project_member(project_id) OR fn_is_org_admin());

CREATE POLICY project_members_write ON project_members FOR ALL
  USING (fn_is_org_admin());

-- ============================================================================
-- DOCUMENTS — project members only
-- ============================================================================
CREATE POLICY documents_select ON documents FOR SELECT
  USING (
    organization_id = fn_auth_org_id()
    AND fn_is_project_member(project_id)
  );

CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (
    organization_id = fn_auth_org_id()
    AND fn_is_project_member(project_id)
  );

CREATE POLICY documents_update ON documents FOR UPDATE
  USING (
    organization_id = fn_auth_org_id()
    AND fn_is_project_member(project_id)
  );

CREATE POLICY documents_delete ON documents FOR DELETE
  USING (fn_is_org_admin());

-- ============================================================================
-- DOCUMENT VERSIONS — follow document access
-- ============================================================================
CREATE POLICY doc_versions_select ON document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
        AND d.organization_id = fn_auth_org_id()
        AND fn_is_project_member(d.project_id)
    )
  );

CREATE POLICY doc_versions_insert ON document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
        AND fn_is_project_member(d.project_id)
    )
  );

-- ============================================================================
-- DOCUMENT CHUNKS — follow document access
-- ============================================================================
CREATE POLICY chunks_select ON document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_chunks.document_id
        AND d.organization_id = fn_auth_org_id()
        AND fn_is_project_member(d.project_id)
    )
  );

-- ============================================================================
-- CONVERSATIONS — own conversations only (or project scope)
-- ============================================================================
CREATE POLICY convs_select ON conversations FOR SELECT
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND fn_is_project_member(project_id) AND fn_is_org_admin())
  );

CREATE POLICY convs_insert ON conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY convs_update ON conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY convs_delete ON conversations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- MESSAGES — follow conversation access
-- ============================================================================
CREATE POLICY msgs_select ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY msgs_insert ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- MESSAGE SOURCES — follow message access
-- ============================================================================
CREATE POLICY sources_select ON message_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   messages m
      JOIN   conversations c ON c.id = m.conversation_id
      WHERE  m.id = message_sources.message_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FEEDBACK — own feedback + org admin reads all
-- ============================================================================
CREATE POLICY feedback_select ON feedback FOR SELECT
  USING (user_id = auth.uid() OR fn_is_org_admin());

CREATE POLICY feedback_insert ON feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY feedback_update ON feedback FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- AUDIT LOGS — append-only; org admins can read; no user deletes
-- ============================================================================
CREATE POLICY audit_select ON audit_logs FOR SELECT
  USING (org_id = fn_auth_org_id() AND fn_is_org_admin());

CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (TRUE);   -- application inserts on behalf of any user
