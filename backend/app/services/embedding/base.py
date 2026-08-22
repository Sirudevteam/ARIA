"""
Abstract Base Embedding Provider Interface.
Ensures zero hardcoding of embedding providers across the ARIA application.
"""

from abc import ABC, abstractmethod
import hashlib
from typing import List


class BaseEmbeddingProvider(ABC):
    """
    Abstract interface for embedding models (BGE-M3, OpenAI, HuggingFace, Mock, etc.).
    All embedding integrations must implement this contract.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. 'bge_m3', 'openai', 'mock')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Underlying model name / checkpoint (e.g. 'BAAI/bge-m3', 'text-embedding-3-small')."""
        pass

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Vector output dimensions (e.g. 1024, 1536)."""
        pass

    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embedding vectors for a batch of text chunks.
        Must return unit-normalized vectors.
        """
        pass

    @abstractmethod
    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding vector for a single search query string.
        Must return unit-normalized vector.
        """
        pass

    def compute_content_hash(self, text: str) -> str:
        """
        Compute deterministic SHA-256 hash of normalized chunk text
        to detect and avoid duplicate embedding computations.
        """
        normalized = text.strip()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get_model_identifier(self) -> str:
        """
        Unique model signature for version tracking and re-embedding checks.
        Example: 'bge_m3:BAAI/bge-m3:1024' or 'openai:text-embedding-3-small:1536'.
        """
        return f"{self.provider_name}:{self.model_name}:{self.dimensions}"
