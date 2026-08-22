"""
RAG Prompt Composer.
Assembles strict, grounded system prompts containing retrieved precision citations
and structured conversation context for LLM generation.
"""

from typing import List, Optional

from app.schemas.llm import ChatMessage
from app.schemas.reranker import RerankedChunk


class PromptComposer:
    """
    Composes structured system prompts with numbered citations and conversation history.
    """

    SYSTEM_BASE_PROMPT = """You are ARIA (Annotation RAG Intelligence Assistant), an expert autonomous driving perception engineering and data annotation assistant.

Your task is to provide accurate, strictly grounded answers based ONLY on the provided Context Citations below.

GROUNDING & CITATION RULES:
1. Every technical claim, coordinate system definition, bounding box rule, or calibration threshold MUST cite the supporting source using [Citation X] notation.
2. If multiple citations support a claim, reference all of them (e.g. [Citation 1, Citation 3]).
3. If the provided context does NOT contain sufficient information to answer the question, state honestly and clearly: "Based on the available documentation, this information is not specified."
4. Do NOT hallucinate rules, numbers, or standards not present in the verified citations.
5. Format technical acronyms (e.g. ISO 8855, LiDAR, RTK, IMU) accurately.
"""

    @classmethod
    def format_citations_block(cls, citations: List[RerankedChunk]) -> str:
        """Format retrieved precision chunks as numbered citation blocks."""
        if not citations:
            return "No verified context citations available."

        lines = ["=== VERIFIED CONTEXT CITATIONS ==="]
        for idx, chunk in enumerate(citations):
            header_parts = [f"[Citation {idx + 1}]", f"Document: \"{chunk.document_title}\" (v{chunk.version_number})"]
            if chunk.page:
                header_parts.append(f"Page: {chunk.page}")
            if chunk.section:
                header_parts.append(f"Section: \"{chunk.section}\"")
            if chunk.rerank_score is not None:
                header_parts.append(f"Relevance: {round(chunk.rerank_score * 100, 1)}%")

            lines.append(" | ".join(header_parts))
            lines.append(f"Content: {chunk.content.strip()}")
            lines.append("---")

        return "\n".join(lines)

    @classmethod
    def build_system_prompt(cls, citations: List[RerankedChunk]) -> str:
        """Compose complete grounded system prompt."""
        citations_block = cls.format_citations_block(citations)
        return f"{cls.SYSTEM_BASE_PROMPT}\n\n{citations_block}"

    @classmethod
    def compose_messages(
        cls,
        query: str,
        citations: List[RerankedChunk],
        conversation_history: Optional[List[ChatMessage]] = None,
    ) -> List[ChatMessage]:
        """
        Assemble the complete chat messages payload ready for LLM generation.
        """
        system_prompt = cls.build_system_prompt(citations)
        messages = [ChatMessage(role="system", content=system_prompt)]

        if conversation_history:
            # Include recent conversation turns
            for msg in conversation_history[-6:]:
                if msg.role in ("user", "assistant"):
                    messages.append(msg)

        # Add current user query
        messages.append(ChatMessage(role="user", content=query))
        return messages


prompt_composer = PromptComposer()
