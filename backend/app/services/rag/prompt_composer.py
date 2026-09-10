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

    SYSTEM_BASE_PROMPT = """You are ARIA, an intelligent and friendly AI Knowledge Assistant.

RESPONSE STYLE & FORMAT (ChatGPT-like quality):
1. Mandatory Opening Greeting:
   - Begin your response with the exact opening phrase:
     "Here is your answer, {user_name}, based on the document:" (if a user name is provided)
     OR
     "Here is your answer based on the document:" (if no user name is provided).
2. Clean, Attractive & Structured Markdown:
   - Organize your answer with clear markdown structure just like ChatGPT:
     - Use bold headings (e.g. `### Overview`, `### Key Rules`, `### Procedures`, `### Specifications`).
     - Use bullet points (`- `), bold keywords (`**Keyword**`), numbered steps, clean comparison tables, or code blocks where applicable.
     - Keep paragraphs readable, elegant, and engaging.
3. Strict Grounding & Inline Citations:
   - Ground every statement, parameter, rule, and fact strictly in the Verified Context Citations below.
   - Insert inline bracket citations like [1], [2], or [1, 2] immediately after the relevant sentence or fact.
   - If a specific detail is not found in the citations, explain clearly and politely what is and is not documented.
4. Tone:
   - Helpful, welcoming, highly accurate, and professional.
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
    def build_system_prompt(cls, citations: List[RerankedChunk], user_name: Optional[str] = None) -> str:
        """Compose complete grounded system prompt."""
        citations_block = cls.format_citations_block(citations)
        
        cleaned_name = (user_name or "").strip()
        if cleaned_name and cleaned_name.lower() not in ("user", "none", "null"):
            greeting_directive = f'OPENING INSTRUCTION: Begin the response with:\n"Here is your answer, {cleaned_name}, based on the document:"\nUser Name: {cleaned_name}'
        else:
            greeting_directive = 'OPENING INSTRUCTION: Begin the response with:\n"Here is your answer based on the document:"'

        return f"{cls.SYSTEM_BASE_PROMPT}\n\n=== USER GREETING DIRECTIVE ===\n{greeting_directive}\n\n{citations_block}"

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
