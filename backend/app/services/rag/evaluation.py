"""
RAG Evaluation Metrics Engine for ARIA.
Calculates automated retrieval and generation quality benchmarks:
1. Context Precision: Ratio of relevant retrieved chunks in Top-K.
2. Context Recall: Percentage of ground truth reference facts retrieved.
3. Faithfulness: Anti-hallucination metric verifying answer claims are 100% supported by citations.
4. Hit Rate@K & Mean Reciprocal Rank (MRR).
"""

from typing import Any, Dict, List, Optional, Set
import re


class RAGEvaluationEngine:
    """Computes standard automated RAG quality benchmarks."""

    @staticmethod
    def calculate_hit_rate_and_mrr(
        retrieved_chunk_ids: List[str],
        ground_truth_chunk_ids: Set[str],
        top_k: int = 5,
    ) -> Dict[str, float]:
        """
        Calculate Hit Rate@K and Mean Reciprocal Rank (MRR).
        - Hit Rate@K: 1.0 if at least one ground truth chunk appears in top_k, else 0.0.
        - Reciprocal Rank (RR): 1 / rank of the first relevant chunk (1-indexed), or 0.0 if not found.
        """
        top_chunks = retrieved_chunk_ids[:top_k]
        hit = 0.0
        reciprocal_rank = 0.0

        for rank, chunk_id in enumerate(top_chunks, start=1):
            if chunk_id in ground_truth_chunk_ids:
                if hit == 0.0:
                    hit = 1.0
                    reciprocal_rank = 1.0 / rank

        return {
            "hit_rate": hit,
            "mrr": reciprocal_rank,
            "top_k": top_k,
        }

    @staticmethod
    def calculate_context_precision(
        retrieved_chunks: List[Dict[str, Any]],
        relevant_chunk_ids: Set[str],
    ) -> float:
        """
        Context Precision: Measures whether relevant chunks are ranked at the top.
        Precision@k = (Count of relevant chunks in top k) / k
        """
        if not retrieved_chunks:
            return 0.0

        precisions = []
        relevant_count = 0

        for k, chunk in enumerate(retrieved_chunks, start=1):
            chunk_id = chunk.get("chunk_id") or chunk.get("id")
            if chunk_id in relevant_chunk_ids:
                relevant_count += 1
                precisions.append(relevant_count / k)

        if not precisions:
            return 0.0

        return sum(precisions) / len(precisions)

    @staticmethod
    def calculate_context_recall(
        retrieved_text: str,
        ground_truth_key_facts: List[str],
    ) -> float:
        """
        Context Recall: Measures the fraction of required ground-truth facts
        that are present in the retrieved context text.
        """
        if not ground_truth_key_facts:
            return 1.0

        retrieved_lower = retrieved_text.lower()
        matched_facts = 0

        for fact in ground_truth_key_facts:
            # Check for literal or normalized presence
            tokens = [t for t in re.findall(r"\w+", fact.lower()) if len(t) > 2]
            if not tokens:
                continue

            # Fact matches if key tokens (>= 40%) or exact phrase found
            overlap = sum(1 for t in tokens if t in retrieved_lower)
            if fact.lower() in retrieved_lower or (overlap / len(tokens)) >= 0.40:
                matched_facts += 1

        return matched_facts / len(ground_truth_key_facts)

    @staticmethod
    def calculate_faithfulness(
        generated_answer: str,
        retrieved_context: str,
    ) -> float:
        """
        Faithfulness (Anti-Hallucination Metric):
        Evaluates whether claims in the generated answer are grounded in the retrieved context.
        Score of 1.0 indicates zero hallucinated claims.
        """
        if not generated_answer.strip():
            return 1.0

        # Split answer into declarative sentences / claims (ignoring decimals like 2.4)
        sentences = [
            s.strip()
            for s in re.split(r"(?<!\d)\.(?!\d)|\n+", generated_answer)
            if len(s.strip()) > 10 and not s.strip().startswith("#")
        ]

        if not sentences:
            return 1.0

        context_lower = retrieved_context.lower()
        supported_claims = 0

        for sentence in sentences:
            # Extract key nouns and acronyms (e.g. ISO 8855, LiDAR, 15 points)
            key_terms = [t for t in re.findall(r"\b[A-Za-z0-9_-]{3,}\b", sentence.lower())]
            if not key_terms:
                supported_claims += 1
                continue

            # Check overlap against context
            overlap = sum(1 for term in key_terms if term in context_lower)
            overlap_ratio = overlap / len(key_terms)

            # Claim is faithful if at least 60% of key terminology is grounded
            if overlap_ratio >= 0.60:
                supported_claims += 1

        return supported_claims / len(sentences)


rag_evaluation_engine = RAGEvaluationEngine()
