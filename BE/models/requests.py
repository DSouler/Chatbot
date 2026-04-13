from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str

class LLMSettings(BaseModel):
    model: str

class EmbeddingSettings(BaseModel):
    model: str
    api_key: str

class RetrievalSettings(BaseModel):
    retrieval_mode: str
    use_MMR: bool
    use_reranking: bool
    use_llm_relevant_scoring: bool
    prioritize_table: bool
    embedding_settings: Optional[EmbeddingSettings] = None
    llm_relevant_scoring: Optional[LLMSettings] = None

class ReasoningSettings(BaseModel):
    language: str
    llm: LLMSettings

    planner_prompt: Optional[str] = None
    solver_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    max_interations: Optional[int] = 5

class ConversationCreateRequest(BaseModel):
    user_id: int
    name: str

class ConversationRenameRequest(BaseModel):
    user_id: int
    name: str

class ImageData(BaseModel):
    data: str        # base64 string (không có prefix "data:...")
    media_type: str  # "image/jpeg" | "image/png" | "image/gif" | "image/webp"

class QuestionRequest(BaseModel):
    question: str
    system_prompt: Optional[str] = None
    tenant_id: Optional[str] = None
    sources: Optional[List[str]] = None
    chat_history: List[Message]
    top_k: Optional[int] = None
    n_last_interactions: Optional[int] = None
    max_context_rewrite_length: Optional[int] = None
    qa_prompt: Optional[str] = None
    decompose_prompt: Optional[str] = None
    complex_prompt: Optional[str] = None
    retrieval_settings: Optional[RetrievalSettings] = None
    reasoning_settings: Optional[ReasoningSettings] = None
    mode: Optional[str] = "RAG"
    conversation_id: Optional[int] = None
    created_by: Optional[int] = None
    images: Optional[List[ImageData]] = None