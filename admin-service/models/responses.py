from pydantic import BaseModel
from typing import List, Dict, Optional, Any


class QueryResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, Any]]] = None


class IngestedFileDetail(BaseModel):
    file_path: str
    documents_loaded: int
    chunks_added: int


class FailedFileDetail(BaseModel):
    file_path: str
    error: str


class IngestionDetails(BaseModel):
    total_files_processed: int
    total_chunks_ingested: int
    total_embedding_tokens: int
    successful_files: List[IngestedFileDetail]
    failed_files: List[FailedFileDetail]


class IngestResponse(BaseModel):
    status: str
    message: str
    details: IngestionDetails


class S3UploadResponse(BaseModel):
    status: str
    message: str
    object_keys: List[str]

class DeleteResponse(BaseModel):
    status: str
    message: str

class AddTenantResponse(BaseModel):
    status: str
    message: str
    collection_name: Optional[str] = None


    

class DeleteAllResponse(BaseModel):
    status: str
    message: str

