-- =============================================================================
-- Seed Data: Development & Local Testing
-- ARIA — Annotation RAG Intelligence Assistant
-- Designed for multi-project enterprise LiDAR annotation workflows
-- =============================================================================

-- =============================================================================
-- 1. ORGANIZATIONS
-- =============================================================================
INSERT INTO organizations (id, name, slug, logo_url, website, settings, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Autocruise Dynamics AI',
  'autocruise-ai',
  'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=128&q=80',
  'https://autocruise.example.com',
  '{
    "default_model": "deepseek-chat",
    "embedding_model": "text-embedding-3-small",
    "max_upload_size_mb": 100,
    "chunk_size_tokens": 512,
    "chunk_overlap_tokens": 64,
    "allowed_file_types": [".pdf", ".docx", ".txt", ".md", ".json"]
  }'::jsonb,
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. DEPARTMENTS
-- =============================================================================
INSERT INTO departments (id, organization_id, name, description)
VALUES 
(
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Perception & Autonomous Systems',
  'Core engineering team responsible for 3D LiDAR, Radar, and Camera sensor fusion algorithms'
),
(
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Data Operations & Annotation QA',
  'Specialist operations team producing ground-truth 3D point cloud labels and quality assurance benchmarks'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. USERS
-- =============================================================================
-- Grab role IDs
DO $$
DECLARE
  v_super_admin_id UUID;
  v_org_admin_id   UUID;
  v_proj_lead_id   UUID;
  v_annotator_id   UUID;
  v_viewer_id      UUID;
BEGIN
  SELECT id INTO v_super_admin_id FROM roles WHERE name = 'super_admin' AND scope = 'system';
  SELECT id INTO v_org_admin_id   FROM roles WHERE name = 'org_admin'   AND scope = 'organization';
  SELECT id INTO v_proj_lead_id   FROM roles WHERE name = 'project_lead' AND scope = 'project';
  SELECT id INTO v_annotator_id   FROM roles WHERE name = 'annotator'   AND scope = 'project';
  SELECT id INTO v_viewer_id      FROM roles WHERE name = 'viewer'      AND scope = 'project';

  -- User 1: Deena Chandran (Lead Admin)
  INSERT INTO users (id, organization_id, role_id, email, name, avatar_url, status, metadata)
  VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    v_super_admin_id,
    'deenathedev@protonmail.com',
    'Deena Chandran',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&q=80',
    'active',
    '{"title": "Head of AI & Perception", "department": "Perception & Autonomous Systems"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- User 2: Sarah Chen (Project Lead)
  INSERT INTO users (id, organization_id, role_id, email, name, avatar_url, status, metadata)
  VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    v_org_admin_id,
    'sarah.chen@autocruise.example.com',
    'Sarah Chen',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&q=80',
    'active',
    '{"title": "Senior 3D Annotation Lead", "department": "Data Operations & Annotation QA"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- User 3: Alex Rivera (3D LiDAR Annotator)
  INSERT INTO users (id, organization_id, role_id, email, name, avatar_url, status, metadata)
  VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    v_annotator_id,
    'alex.rivera@autocruise.example.com',
    'Alex Rivera',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&q=80',
    'active',
    '{"title": "3D Point Cloud Specialist", "skills": ["Pandar64", "Velodyne", "OpenPCDet"]}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- User 4: Maya Patel (Quality Assurance Reviewer)
  INSERT INTO users (id, organization_id, role_id, email, name, avatar_url, status, metadata)
  VALUES (
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    v_viewer_id,
    'maya.patel@autocruise.example.com',
    'Maya Patel',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&q=80',
    'active',
    '{"title": "Sensor Calibration & QA Auditor", "department": "Perception & Autonomous Systems"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

END $$;

-- =============================================================================
-- 4. TEAMS & TEAM MEMBERS
-- =============================================================================
INSERT INTO teams (id, organization_id, department_id, created_by, name, description)
VALUES 
(
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001',
  '3D LiDAR Point Cloud Annotation Core',
  'Production labeling team focused on 3D oriented bounding boxes, semantic segmentation, and temporal tracking'
),
(
  'd0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Sensor Rig Calibration & Extrinsics QA',
  'Responsible for extrinsic camera-LiDAR transform matrices, ground-plane estimation, and beam intensity calibration'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO team_members (team_id, user_id)
VALUES 
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- =============================================================================
-- 5. PROJECTS & PROJECT MEMBERS
-- =============================================================================
INSERT INTO projects (id, organization_id, team_id, created_by, name, description, status, settings)
VALUES
(
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Autonomous Urban Shuttle - Pandar64 Dataset',
  'High-density 64-beam LiDAR annotation project for urban shuttle perception at speeds up to 45 km/h. Covers pedestrian, cyclist, car, bus, and road furniture classes.',
  'active',
  '{
    "coordinate_system": "ISO 8855 (Right-Handed, X=Forward, Y=Left, Z=Up)",
    "point_cloud_format": "PCD binary_compressed",
    "required_classes": ["Vehicle_Car", "Vehicle_Bus", "Pedestrian_Adult", "Pedestrian_Child", "Cyclist", "Traffic_Barrier"],
    "min_points_per_box": 5,
    "max_heading_error_deg": 3.0
  }'::jsonb
),
(
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Highway Long-Range Perception 128-Beam',
  'Long-range (250m) 128-beam highway dataset with adverse weather annotations (rain, spray, fog) and high-speed dynamic tracking.',
  'active',
  '{
    "coordinate_system": "ISO 8855",
    "range_cutoff_meters": 250.0,
    "confidence_threshold": 0.85
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Project Members with explicit project roles
DO $$
DECLARE
  v_lead_role UUID;
  v_annot_role UUID;
  v_view_role  UUID;
BEGIN
  SELECT id INTO v_lead_role  FROM roles WHERE name = 'project_lead' AND scope = 'project';
  SELECT id INTO v_annot_role FROM roles WHERE name = 'annotator'    AND scope = 'project';
  SELECT id INTO v_view_role  FROM roles WHERE name = 'viewer'       AND scope = 'project';

  INSERT INTO project_members (project_id, user_id, role_id, invited_by)
  VALUES 
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', v_lead_role,  NULL),
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', v_lead_role,  'c0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', v_annot_role, 'c0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', v_view_role,  'c0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', v_lead_role,  NULL),
    ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', v_annot_role, 'c0000000-0000-0000-0000-000000000001')
  ON CONFLICT (project_id, user_id) DO NOTHING;
END $$;

-- =============================================================================
-- 6. DOCUMENTS & VERSIONS
-- =============================================================================
INSERT INTO documents (
  id, project_id, organization_id, uploaded_by, title, description,
  doc_type, status, source_url, file_size_bytes, mime_type, page_count, language, metadata
)
VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  '3D LiDAR Annotation Standard Operating Procedure (SOP) v3.2',
  'Master specification for 3D bounding box dimensions, yaw/pitch/roll alignment, occlusion levels (0-3), and truncation flags.',
  'manual',
  'indexed',
  's3://autocruise-docs/lidar-sop-v3.2.pdf',
  2457600,
  'application/pdf',
  42,
  'en',
  '{"sensor": "Hesai Pandar64", "revision": "3.2.0", "author": "Perception QA"}'::jsonb
),
(
  'f0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'LiDAR Object Class Taxonomy & Dimension Bounds Reference',
  'Strict physical dimension bounds (min/max length, width, height) and default geometric priors for 18 annotated classes.',
  'annotation_schema',
  'indexed',
  's3://autocruise-docs/taxonomy-bounds-2026.json',
  524288,
  'application/json',
  12,
  'en',
  '{"standard": "OpenLABEL / ASAM", "classes_count": 18}'::jsonb
),
(
  'f0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'LiDAR QA Edge Cases & Severe Weather Annotation FAQ',
  'Solutions for ghost points, retro-reflector bloom, spray trails behind trucks in wet conditions, and sparse returns at 100m+.',
  'faq',
  'indexed',
  's3://autocruise-docs/qa-edge-cases-faq.md',
  131072,
  'text/markdown',
  8,
  'en',
  '{"topics": ["retro-reflector bloom", "wet asphalt", "sparse clusters"]}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Document Versions
INSERT INTO document_versions (
  id, document_id, created_by, version_number, storage_path, file_size_bytes, checksum, change_summary, is_current
)
VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  1,
  'storage/v1/lidar-sop-v3.1.pdf',
  2100000,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'Initial version for 32-beam sensors',
  FALSE
),
(
  '10000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  2,
  'storage/v2/lidar-sop-v3.2.pdf',
  2457600,
  'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
  'Updated with Pandar64 64-beam density rules and pedestrian child height standards',
  TRUE
),
(
  '10000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000002',
  1,
  'storage/v1/taxonomy-bounds-2026.json',
  524288,
  '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
  'Baseline 2026 dimension priors',
  TRUE
),
(
  '10000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000002',
  1,
  'storage/v1/qa-edge-cases-faq.md',
  131072,
  '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
  'Edge case knowledge base',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. DOCUMENT CHUNKS (with 1536-dim vector embeddings)
-- =============================================================================
-- Helper to generate a normalized 1536-dim test vector with high values at specific seed coordinates
-- This allows cosine similarity to yield realistic deterministic ranking in tests.
DO $$
DECLARE
  v_vec1 TEXT;
  v_vec2 TEXT;
  v_vec3 TEXT;
  v_vec4 TEXT;
BEGIN
  -- Create sample 1536-dim vector string with deterministic non-zero features
  SELECT '[' || string_agg((CASE WHEN i IN (1, 10, 50, 100) THEN '0.25' ELSE '0.001' END), ',') || ']'
  INTO v_vec1 FROM generate_series(1, 1536) i;

  SELECT '[' || string_agg((CASE WHEN i IN (2, 20, 60, 200) THEN '0.25' ELSE '0.001' END), ',') || ']'
  INTO v_vec2 FROM generate_series(1, 1536) i;

  SELECT '[' || string_agg((CASE WHEN i IN (3, 30, 70, 300) THEN '0.25' ELSE '0.001' END), ',') || ']'
  INTO v_vec3 FROM generate_series(1, 1536) i;

  SELECT '[' || string_agg((CASE WHEN i IN (4, 40, 80, 400) THEN '0.25' ELSE '0.001' END), ',') || ']'
  INTO v_vec4 FROM generate_series(1, 1536) i;

  -- Chunk 1: 3D Bounding Box Yaw Orientation
  INSERT INTO document_chunks (
    id, document_id, version_id, chunk_index, content, token_count, status, embedding, metadata
  ) VALUES (
    '20000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    0,
    'Section 4.2 — 3D Bounding Box Heading (Yaw) Alignment: The yaw angle must align with the physical forward direction of the vehicle chassis, regardless of movement direction. For partially occluded vehicles (where only the rear or side cluster is visible), annotators must reference temporal consecutive frames (±5 frames at 10Hz) to confirm the motion vector and chassis orientation. The bounding box bottom plane must align tangent to the estimated ground plane mesh (within ±2cm tolerance).',
    128,
    'embedded',
    v_vec1::vector,
    '{"section": "4.2", "page_number": 14, "topic": "yaw_alignment"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Chunk 2: Pedestrian and Cyclist Bounding Box Tightness
  INSERT INTO document_chunks (
    id, document_id, version_id, chunk_index, content, token_count, status, embedding, metadata
  ) VALUES (
    '20000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    1,
    'Section 5.1 — Pedestrian & Cyclist Annotation Standards: Pedestrians must be encapsulated from the lowest ground-contact point of their shoes to the highest point of their head or helmet. Backpacks, handheld umbrellas, and small carried items must be enclosed within the bounding box. For cyclists, the rider and bicycle must be enclosed in a single joint 3D bounding box labeled Cyclist_Riding, with the forward heading matching the front wheel orientation.',
    115,
    'embedded',
    v_vec2::vector,
    '{"section": "5.1", "page_number": 18, "topic": "pedestrians_cyclists"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Chunk 3: Physical Dimension Bounds
  INSERT INTO document_chunks (
    id, document_id, version_id, chunk_index, content, token_count, status, embedding, metadata
  ) VALUES (
    '20000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    0,
    'Vehicle_Car Geometric Priors: Length: [3.80m, 5.20m], Width: [1.60m, 2.10m], Height: [1.30m, 1.95m]. If LiDAR points suggest a length outside [3.50m, 5.50m], the annotator must verify if the object is a Vehicle_Van or Vehicle_Truck. Bounding boxes must not expand arbitrarily to capture noise artifacts or multipath ground reflections.',
    98,
    'embedded',
    v_vec3::vector,
    '{"class": "Vehicle_Car", "page_number": 3, "topic": "dimension_priors"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Chunk 4: Retro-reflector bloom and ghost points
  INSERT INTO document_chunks (
    id, document_id, version_id, chunk_index, content, token_count, status, embedding, metadata
  ) VALUES (
    '20000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    0,
    'Q: How should annotators handle high-intensity bloom around traffic signs and vehicle license plates? A: Pandar64 return intensities > 240 often cause optical dilation (retro-reflector bloom), making license plates appear 20-30cm wider than reality. Annotators must shrink the 3D bounding box to match standard vehicle dimension priors rather than expanding to encompass the optical halo.',
    102,
    'embedded',
    v_vec4::vector,
    '{"faq_id": "FAQ-012", "page_number": 4, "topic": "retro_reflector_bloom"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- =============================================================================
-- 8. CONVERSATIONS, MESSAGES & SOURCES
-- =============================================================================
INSERT INTO conversations (id, user_id, project_id, title, status, metadata)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000001',
  'How to align yaw for occluded vehicles parked at curbs?',
  'active',
  '{"tags": ["yaw", "occlusion", "curb_parking"]}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Messages: Turn 1 (User Query)
INSERT INTO messages (
  id, conversation_id, role, content, token_count, model_used, latency_ms, finish_reason
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'user',
  'When a car is parked along the curb and 70% occluded by a tree, how do I accurately determine the 3D box yaw heading?',
  28,
  NULL,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Messages: Turn 2 (ARIA Assistant Answer with RAG grounding)
INSERT INTO messages (
  id, conversation_id, role, content, token_count, model_used, latency_ms, finish_reason
)
VALUES (
  '40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  'assistant',
  'According to **Section 4.2 of the 3D LiDAR Annotation SOP (v3.2)**, when annotating occluded vehicles:

1. **Chassis Alignment Rule**: The bounding box yaw heading must align with the physical forward direction of the vehicle chassis, regardless of which side or corner is visible.
2. **Temporal Multi-Frame Verification**: Check adjacent temporal frames (±5 frames at 10Hz) to locate points where the vehicle was less occluded, or follow the curb tangent geometry.
3. **Dimension Priors**: For `Vehicle_Car`, maintain standard physical dimension bounds (Length: 3.80m–5.20m, Width: 1.60m–2.10m, Height: 1.30m–1.95m) and do not expand the box into tree foliage or ground reflection points.
4. **Ground Plane Tangency**: Align the bottom face within ±2cm of the estimated road mesh surface.',
  175,
  'deepseek-chat',
  420,
  'stop'
) ON CONFLICT (id) DO NOTHING;

-- Message Sources (Citations)
INSERT INTO message_sources (id, message_id, chunk_id, document_id, relevance, excerpt, page_number)
VALUES 
(
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  0.94,
  'Section 4.2 — 3D Bounding Box Heading (Yaw) Alignment: The yaw angle must align with the physical forward direction of the vehicle chassis... reference temporal consecutive frames (±5 frames at 10Hz)...',
  14
),
(
  '50000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000002',
  0.87,
  'Vehicle_Car Geometric Priors: Length: [3.80m, 5.20m], Width: [1.60m, 2.10m], Height: [1.30m, 1.95m]...',
  3
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. USER FEEDBACK
-- =============================================================================
INSERT INTO feedback (id, message_id, user_id, rating, comment)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  'thumbs_up',
  'Clear citation of SOP section 4.2 and exact dimension bounds. Solved my blocker.'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 10. AUDIT LOGS
-- =============================================================================
INSERT INTO audit_logs (
  id, org_id, user_id, action, resource, resource_id, ip_address, user_agent, metadata
)
VALUES
(
  '70000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'login',
  'user',
  'c0000000-0000-0000-0000-000000000001',
  '127.0.0.1'::inet,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  '{"auth_method": "sso_oauth"}'::jsonb
),
(
  '70000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'upload',
  'document',
  'f0000000-0000-0000-0000-000000000001',
  '127.0.0.1'::inet,
  'ARIA-Ingestion-Worker/1.0',
  '{"file_name": "lidar-sop-v3.2.pdf", "chunks_generated": 14}'::jsonb
),
(
  '70000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'create',
  'project',
  'e0000000-0000-0000-0000-000000000001',
  '127.0.0.1'::inet,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  '{"project_name": "Autonomous Urban Shuttle - Pandar64 Dataset"}'::jsonb
) ON CONFLICT (id) DO NOTHING;
