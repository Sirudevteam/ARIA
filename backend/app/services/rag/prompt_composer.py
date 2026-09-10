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

    SYSTEM_BASE_PROMPT = """You are ARIA, an intelligent, helpful, and friendly AI Assistant for project knowledge, annotation guidelines, and enterprise documentation.

BEHAVIOR & RESPONSE STYLE (ChatGPT-like quality):
1. Conversational & Adaptive:
   - If the user greets you (e.g. "hi", "hello", "hey", "how are you?"), responds with general pleasantries, or asks about what you can do, greet them warmly and naturally (e.g. "Hello! How can I help you today?"). You can mention you're here to assist with project documents, annotation guidelines, QC standards, and workflows.
   - When answering questions, provide direct, natural, and helpful answers without rigid or repetitive boilerplate disclaimers.
2. Clean, Attractive & Structured Markdown:
   - Format responses beautifully like ChatGPT:
     - Use bold section headers (e.g. `### Overview`, `### Key Rules`, `### Procedures`, `### Summary`) when presenting detailed answers.
     - Use clean bullet points (`- `), bold terms (`**Term**`), numbered lists, comparison tables, or code blocks where helpful.
     - Keep paragraphs concise, engaging, and easy to read.
3. Strict Grounding & Inline Citations (When Citations are Available):
   - When Verified Context Citations are provided below, ground all factual information, rules, and procedures strictly in those citations.
   - Insert inline bracket citations like [1], [2], or [1, 2] immediately after the statements they support.
   - If a specific question is asked about the project/documents but the provided citations do not contain the answer, politely and naturally explain that the uploaded documentation doesn't cover that topic.
4. Tone:
   - Welcoming, professional, clear, and engaging.
"""

    @classmethod
    def format_citations_block(cls, citations: List[RerankedChunk]) -> str:
        """Format retrieved precision chunks as numbered citation blocks."""
        if not citations:
            return "No verified context citations found for this query."

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
    def build_system_prompt(cls, citations: List[RerankedChunk], user_name: Optional[str] = None) -> str:
        """Compose complete grounded system prompt."""
        citations_block = cls.format_citations_block(citations)
        cleaned_name = (user_name or "").strip()
        user_info = f"\nUser Name: {cleaned_name}" if cleaned_name and cleaned_name.lower() not in ("user", "none", "null") else ""

        return f"{cls.SYSTEM_BASE_PROMPT}{user_info}\n\n{citations_block}"

    @classmethod
    def compose_messages(
        cls,
        query: str,
        citations: List[RerankedChunk],
        conversation_history: Optional[List[ChatMessage]] = None,
        user_name: Optional[str] = None,
    ) -> List[ChatMessage]:
        """
        Assemble the complete chat messages payload ready for LLM generation.
        """
        system_prompt = cls.build_system_prompt(citations, user_name=user_name)
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
