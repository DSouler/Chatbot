from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator, Callable
import logging
from vectordb.engine import VectorDBEngine
from models.requests import RetrievalSettings, ReasoningSettings

logger = logging.getLogger(__name__)

class BasePipeline(ABC):
    """
    Abstract base class for all RAG-enabled pipelines
    """
    def __init__(
            self,
            vectordb_engine: VectorDBEngine,
            default_qa_prompt: str,
    ):
        self.vectordb = vectordb_engine
        self.default_qa_prompt = default_qa_prompt

    @abstractmethod
    def _create_augmented_prompt(self, query: str, relevant_docs: List[Dict[str, Any]], qa_prompt: Optional[str] = None) -> str:
        """
        Create an augmented prompt with relevant context for the query
        Must be implemented by concrete pipeline classes
        """
        pass

    @abstractmethod
    async def retrieve(self, embedding: Any, retrieval_settings: RetrievalSettings, query: str, top_k: int, filter_payload: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retrieve relevant documents for a query."""
        pass

    @abstractmethod
    async def stream(
            self,
            original_question: str,
            chat_history: List[Dict[str, str]],
            llm_client: Any,
            messages: List[Dict[str, str]],
            retrieval_settings: RetrievalSettings,
            reasoning_settings: ReasoningSettings,
            user_content=None,
    ) -> AsyncGenerator[str, None]:
        """Stream a response from the LLM."""
        pass

    @abstractmethod
    async def stream_completion(
            self,
            model_name: str,
            llm_client: Any,
            messages: List[Dict[str, str]],
            callback: Optional[Callable[[str], None]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a response from the LLM."""
        pass 