"""
Automated Test Suite for RAG Evaluation Benchmarks.
Tests Context Precision, Context Recall, Faithfulness (Anti-Hallucination),
Hit Rate@5, and Mean Reciprocal Rank (MRR) on 3D LiDAR perception datasets.
"""

import pytest

from app.services.rag.evaluation import rag_evaluation_engine


def test_hit_rate_and_mrr_benchmark():
    """Test Hit Rate@5 and MRR calculations on ranked search candidates."""
    ground_truth_chunks = {"chunk-sop-iso8855", "chunk-velodyne-calib"}

    # Scenario 1: Target chunk ranked #1
    results_1 = ["chunk-sop-iso8855", "chunk-other-1", "chunk-other-2"]
    metrics_1 = rag_evaluation_engine.calculate_hit_rate_and_mrr(results_1, ground_truth_chunks, top_k=5)
    assert metrics_1["hit_rate"] == 1.0
    assert metrics_1["mrr"] == 1.0  # 1/1

    # Scenario 2: Target chunk ranked #2
    results_2 = ["chunk-other-1", "chunk-velodyne-calib", "chunk-other-3"]
    metrics_2 = rag_evaluation_engine.calculate_hit_rate_and_mrr(results_2, ground_truth_chunks, top_k=5)
    assert metrics_2["hit_rate"] == 1.0
    assert metrics_2["mrr"] == 0.5  # 1/2

    # Scenario 3: Target chunk outside top 5
    results_3 = ["chunk-x1", "chunk-x2", "chunk-x3", "chunk-x4", "chunk-x5", "chunk-sop-iso8855"]
    metrics_3 = rag_evaluation_engine.calculate_hit_rate_and_mrr(results_3, ground_truth_chunks, top_k=5)
    assert metrics_3["hit_rate"] == 0.0
    assert metrics_3["mrr"] == 0.0


def test_context_precision_benchmark():
    """Test Context Precision score calculation."""
    relevant_ids = {"chunk-1", "chunk-3"}

    retrieved = [
        {"chunk_id": "chunk-1"},
        {"chunk_id": "chunk-2"},
        {"chunk_id": "chunk-3"},
        {"chunk_id": "chunk-4"},
    ]

    precision = rag_evaluation_engine.calculate_context_precision(retrieved, relevant_ids)
    # k=1: 1/1 = 1.0, k=3: 2/3 = 0.667 -> avg ~0.833
    assert precision >= 0.80


def test_context_recall_benchmark():
    """Test Context Recall calculation on required technical facts."""
    retrieved_text = (
        "According to ISO 8855, the LiDAR sensor X-axis points forward, Y-axis points left, "
        "and Z-axis points upward. Minimum required point density is 15 laser points per vehicle."
    )

    required_facts = [
        "ISO 8855 coordinate orientation standard",
        "X-axis forward Y-axis left Z-axis upward",
        "Minimum required point density 15 laser points",
    ]

    recall = rag_evaluation_engine.calculate_context_recall(retrieved_text, required_facts)
    assert recall == 1.0  # 100% recall


def test_faithfulness_anti_hallucination_benchmark():
    """Test Faithfulness score detects grounded vs hallucinated claims."""
    context = (
        "Velodyne VLS-128 LiDAR features 128 laser channels, a 360-degree horizontal field of view, "
        "and generates up to 2.4 million points per second with calibrated beam divergence."
    )

    # 1. Grounded Answer (Faithful)
    faithful_answer = (
        "The Velodyne VLS-128 sensor has 128 laser channels and provides a 360-degree horizontal field of view. "
        "It can generate up to 2.4 million points per second."
    )
    score_faithful = rag_evaluation_engine.calculate_faithfulness(faithful_answer, context)
    assert score_faithful >= 0.95

    # 2. Hallucinated Answer (Unfaithful)
    hallucinated_answer = (
        "The sensor operates on a 905nm wavelength with 512 channels and outputs 10 million points per second. "
        "It uses quantum photon detectors manufactured by Sony Corporation."
    )
    score_hallucinated = rag_evaluation_engine.calculate_faithfulness(hallucinated_answer, context)
    assert score_hallucinated < 0.40
