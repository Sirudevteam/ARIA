"""
Unit & Integration Tests for Qdrant Vector DB & Hybrid Retrieval Engine.
"""

import uuid
import pytest
import pytest_asyncio

from app.services.vector_db.qdrant_service import QdrantService, text_to_sparse_vector


def test_text_to_sparse_vector():
    """Test sparse BM25 token hashing and score calculations."""
    text = "LiDAR 3D bounding box annotation for VLS-128 sensor ISO 8855"
    indices, values = text_to_sparse_vector(text)

    assert len(indices) > 0
    assert len(values) == len(indices)
    assert all(isinstance(i, int) and i > 0 for i in indices)
    assert all(isinstance(v, float) and v > 0.0 for v in values)


def test_empty_text_to_sparse_vector():
    """Test sparse vector generation on empty string."""
    indices, values = text_to_sparse_vector("")
    assert len(indices) == 1
    assert values[0] == 0.0


@pytest.mark.asyncio
async def test_qdrant_service_upsert_and_search():
    """Test QdrantService upsert and hybrid search with pre-retrieval filtering."""
    service = QdrantService()

    org_id = uuid.uuid4()
    proj_a = uuid.uuid4()
    proj_b = uuid.uuid4()
    doc_1 = uuid.uuid4()
    doc_2 = uuid.uuid4()

    # Create orthogonal dummy dense vectors
    dummy_dense_1 = [1.0] * 512 + [0.0] * 512
    dummy_dense_2 = [0.0] * 512 + [1.0] * 512

    chunks = [
        {
            "chunk_id": str(uuid.uuid4()),
            "document_id": str(doc_1),
            "organization_id": str(org_id),
            "project_id": str(proj_a),
            "department_id": None,
            "confidentiality": "INTERNAL",
            "doc_type": "MANUAL",
            "document_title": "LiDAR Annotation Guideline",
            "version_number": 1,
            "is_current": True,
            "chunk_index": 0,
            "page_number": 1,
            "token_count": 50,
            "content": "Velodyne VLS-128 LiDAR 3D bounding box calibration rules.",
            "dense_embedding": dummy_dense_1,
            "metadata": {"section_heading": "Calibration"},
        },
        {
            "chunk_id": str(uuid.uuid4()),
            "document_id": str(doc_2),
            "organization_id": str(org_id),
            "project_id": str(proj_b),
            "department_id": None,
            "confidentiality": "RESTRICTED",
            "doc_type": "SPECIFICATION",
            "document_title": "Secret Perception Protocol",
            "version_number": 1,
            "is_current": True,
            "chunk_index": 0,
            "page_number": 1,
            "token_count": 60,
            "content": "Top secret autonomous radar tracking threshold specifications.",
            "dense_embedding": dummy_dense_2,
            "metadata": {"section_heading": "Restricted"},
        },
    ]

    upserted = await service.upsert_chunks(chunks)
    assert upserted == 2

    # Query for LiDAR in Project A
    results = await service.hybrid_search(
        query="LiDAR bounding box",
        dense_vector=dummy_dense_1,
        organization_id=org_id,
        allowed_project_ids=[proj_a],
        confidentiality_levels=["INTERNAL", "PUBLIC"],
        top_k=5,
    )

    assert len(results) >= 1
    assert results[0]["document_title"] == "LiDAR Annotation Guideline"
    assert "LiDAR" in results[0]["content"]

    # Security check: User with Project A access cannot retrieve Project B Restricted chunk
    results_unauth = await service.hybrid_search(
        query="radar tracking specifications",
        dense_vector=dummy_dense_2,
        organization_id=org_id,
        allowed_project_ids=[proj_a],  # User only has access to Project A
        confidentiality_levels=["INTERNAL"],
        top_k=5,
    )
    assert len(results_unauth) == 0


@pytest.mark.asyncio
async def test_qdrant_service_delete():
    """Test deleting points by document_id in QdrantService."""
    service = QdrantService()
    doc_id = uuid.uuid4()

    chunks = [
        {
            "chunk_id": str(uuid.uuid4()),
            "document_id": str(doc_id),
            "organization_id": str(uuid.uuid4()),
            "project_id": str(uuid.uuid4()),
            "document_title": "Doc to delete",
            "content": "Delete this content",
            "dense_embedding": [0.5] * 1024,
            "metadata": {},
        }
    ]

    await service.upsert_chunks(chunks)
    deleted = await service.delete_document_chunks(doc_id)
    assert deleted is True
