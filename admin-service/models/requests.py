from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional, Any
from fastapi import UploadFile

import config

class Message(BaseModel):
    role: str
    content: str

class LLMSettings(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None
    project_id: Optional[str] = None
    region: Optional[str] = None
    application_credentials: Optional[Dict[str, Any]] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None

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
    framework: str
    llm: LLMSettings

    planner_prompt: Optional[str] = None
    solver_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    max_interations: Optional[int] = 5

class QuestionRequest(BaseModel):
    question: str
    system_prompt: Optional[str] = None
    # collection_id: Optional[str] = None
    tenant_id: Optional[str] = None
    sources: Optional[List[str]] = None
    # user_group_id: Optional[str] = None
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

class IngestRequest(BaseModel):
    object_keys: List[str]
    bucket_name: str
    # collection_id: str
    tenant_id: str
    # user_group_id: str
    file_loader: Optional[Literal["PyPDFLoader", "DoclingLoader"]] = Field(default="PyPDFLoader")

class S3UploadRequest(BaseModel):
    files: List[UploadFile]
    bucket_name: str
    prefix: str

class DeleteRequest(BaseModel):
    object_keys: List[str] = Field(..., min_length=1, description="A list of exact S3 object keys (e.g., 'prefix/file.pdf') whose corresponding vectors should be deleted.")
    tenant_id: str = Field(..., description="The ID of the tenant whose documents should be deleted.")

class DeleteAllRequest(BaseModel):
    object_keys: List[str] = Field(..., min_length=1, description="A list of exact S3 object keys (e.g., 'prefix/file.pdf') whose corresponding vectors should be deleted.")
    tenant_id: str = Field(..., description="The ID of the tenant whose documents should be deleted.")

class AddTenantRequest(BaseModel):
    tenant_id: str
    embedding_dimension: int
    embedding_model: str