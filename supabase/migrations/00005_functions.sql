-- =============================================================================
-- Migration 00005: Functions & Stored Procedures
-- ARIA — Annotation RAG Intelligence Assistant
-- =============================================================================

-- ============================================================================
-- fn_search_chunks
-- Semantic similarity search on document_chunks using pgvector.
-- Returns the top-k most relevant chunks for a query embedding,
-- optionally scoped to specific projects.
--
-- Usage:
--   SELECT * FROM fn_search_chunks(
--     query_embedding := '[0.1, 0.2, ...]'::vector,
--     p_project_ids   := ARRAY['uuid1','uuid2']::uuid[],
--     p_limit         := 5,
--     p_threshold     := 0.7
--   );
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_search_chunks(
  query_embedding vector(1536),
  p_project_ids   uuid[]  DEFAULT NULL,
  p_limit         integer DEFAULT 5,
  p_threshold     real    DEFAULT 0.5
)
RETURNS TABLE (
  chunk_id       uuid,
  document_id    uuid,
  project_id     uuid,
  chunk_index    integer,
  content        text,
  token_count    integer,
  similarity     real,
  doc_title      text,
  doc_type       doc_type,
  page_number    integer
)
LANGUAGE sql STABLE AS $$
  SELECT
    dc.id                                       AS chunk_id,
    dc.document_id,
    d.project_id,
    dc.chunk_index,
    dc.content,
    dc.token_count,
    (1 - (dc.embedding <=> query_embedding))    AS similarity,
    d.title                                     AS doc_title,
    d.doc_type,
    (dc.metadata->>'page_number')::integer      AS page_number
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE
    dc.status = 'embedded'
    AND dc.embedding IS NOT NULL
    AND (p_project_ids IS NULL OR d.project_id = ANY(p_project_ids))
    AND (1 - (dc.embedding <=> query_embedding)) >= p_threshold
  ORDER BY dc.embedding <=> query_embedding   -- cosine distance ascending
  LIMIT p_limit;
$$;

-- ============================================================================
-- fn_get_user_permissions
-- Returns the merged permission set for a user within a given project.
-- Combines org-level role permissions with project-level role permissions.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_user_permissions(
  p_user_id    uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_org_perms     jsonb;
  v_project_perms jsonb;
BEGIN
  -- Org-level permissions (from user.role_id)
  SELECT r.permissions INTO v_org_perms
  FROM   users u
  JOIN   roles r ON r.id = u.role_id
  WHERE  u.id = p_user_id;

  -- Project-level permissions (from project_members.role_id)
  IF p_project_id IS NOT NULL THEN
    SELECT r.permissions INTO v_project_perms
    FROM   project_members pm
    JOIN   roles r ON r.id = pm.role_id
    WHERE  pm.user_id = p_user_id
      AND  pm.project_id = p_project_id;
  END IF;

  -- Merge: project perms extend/override org perms
  RETURN COALESCE(v_org_perms, '[]'::jsonb)
      || COALESCE(v_project_perms, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- fn_new_document_version
-- Creates a new version row and marks the previous one as not current.
-- Ensures only one is_current = TRUE per document atomically.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_new_document_version(
  p_document_id    uuid,
  p_storage_path   text,
  p_created_by     uuid  DEFAULT NULL,
  p_checksum       text  DEFAULT NULL,
  p_file_size      bigint DEFAULT NULL,
  p_change_summary text  DEFAULT NULL
)
RETURNS document_versions
LANGUAGE plpgsql AS $$
DECLARE
  v_next_version  integer;
  v_new_row       document_versions;
BEGIN
  -- Determine next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO   v_next_version
  FROM   document_versions
  WHERE  document_id = p_document_id;

  -- Mark all existing versions as not current
  UPDATE document_versions
  SET    is_current = FALSE
  WHERE  document_id = p_document_id AND is_current = TRUE;

  -- Insert new current version
  INSERT INTO document_versions (
    document_id, version_number, storage_path,
    created_by, checksum, file_size_bytes, change_summary, is_current
  ) VALUES (
    p_document_id, v_next_version, p_storage_path,
    p_created_by, p_checksum, p_file_size, p_change_summary, TRUE
  )
  RETURNING * INTO v_new_row;

  -- Bump document updated_at
  UPDATE documents SET updated_at = NOW() WHERE id = p_document_id;

  RETURN v_new_row;
END;
$$;

-- ============================================================================
-- fn_write_audit_log
-- Convenience function to insert an audit record. Call from app code or
-- other triggers to avoid repeating INSERT boilerplate.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_write_audit_log(
  p_org_id      uuid,
  p_user_id     uuid,
  p_action      audit_action,
  p_resource    text,
  p_resource_id uuid    DEFAULT NULL,
  p_old_value   jsonb   DEFAULT NULL,
  p_new_value   jsonb   DEFAULT NULL,
  p_ip          inet    DEFAULT NULL,
  p_user_agent  text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT '{}'
)
RETURNS void
LANGUAGE sql AS $$
  INSERT INTO audit_logs (
    org_id, user_id, action, resource, resource_id,
    old_value, new_value, ip_address, user_agent, metadata
  ) VALUES (
    p_org_id, p_user_id, p_action, p_resource, p_resource_id,
    p_old_value, p_new_value, p_ip, p_user_agent, p_metadata
  );
$$;
