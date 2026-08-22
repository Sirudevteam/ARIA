-- =============================================================================
-- Migration 00004: Views
-- ARIA — Annotation RAG Intelligence Assistant
-- Reusable query views for application layer consumption.
-- =============================================================================

-- ============================================================================
-- v_project_members
-- Project members with user profile and role details.
-- Usage: SELECT * FROM v_project_members WHERE project_id = $1;
-- ============================================================================
CREATE OR REPLACE VIEW v_project_members AS
SELECT
  pm.project_id,
  pm.user_id,
  pm.joined_at,
  u.name            AS user_name,
  u.email           AS user_email,
  u.avatar_url,
  u.status          AS user_status,
  r.name            AS role_name,
  r.scope           AS role_scope,
  r.permissions     AS role_permissions
FROM project_members pm
JOIN  users u ON u.id = pm.user_id
LEFT JOIN roles r ON r.id = pm.role_id;

-- ============================================================================
-- v_documents_latest
-- Documents with their current version info pre-joined.
-- ============================================================================
CREATE OR REPLACE VIEW v_documents_latest AS
SELECT
  d.*,
  dv.id              AS version_id,
  dv.version_number,
  dv.storage_path,
  dv.checksum,
  dv.file_size_bytes AS version_size_bytes,
  dv.created_at      AS version_created_at
FROM documents d
LEFT JOIN LATERAL (
  SELECT *
  FROM   document_versions
  WHERE  document_id = d.id AND is_current = TRUE
  LIMIT  1
) dv ON TRUE;

-- ============================================================================
-- v_conversation_summary
-- Conversations with message count, last message, and project name.
-- ============================================================================
CREATE OR REPLACE VIEW v_conversation_summary AS
SELECT
  c.id,
  c.user_id,
  c.project_id,
  c.title,
  c.status,
  c.created_at,
  c.updated_at,
  p.name               AS project_name,
  COUNT(m.id)          AS message_count,
  MAX(m.created_at)    AS last_message_at,
  (
    SELECT content
    FROM   messages
    WHERE  conversation_id = c.id
    ORDER  BY created_at DESC
    LIMIT  1
  )                    AS last_message_preview
FROM conversations c
LEFT JOIN projects  p ON p.id = c.project_id
LEFT JOIN messages  m ON m.conversation_id = c.id
GROUP BY c.id, p.name;

-- ============================================================================
-- v_document_chunk_stats
-- Per-document embedding pipeline progress.
-- ============================================================================
CREATE OR REPLACE VIEW v_document_chunk_stats AS
SELECT
  document_id,
  COUNT(*)                                        AS total_chunks,
  COUNT(*) FILTER (WHERE status = 'embedded')     AS embedded_chunks,
  COUNT(*) FILTER (WHERE status = 'pending')      AS pending_chunks,
  COUNT(*) FILTER (WHERE status = 'failed')       AS failed_chunks,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'embedded') / NULLIF(COUNT(*), 0), 1
  )                                               AS embed_pct
FROM document_chunks
GROUP BY document_id;
