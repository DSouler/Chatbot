import logging
import json
import os
import uuid
from tempfile import gettempdir
from typing import List, Union
import traceback
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from langchain_openai import OpenAIEmbeddings
import boto3
import config
from models.requests import QuestionRequest, DeleteRequest, AddTenantRequest
from models.responses import S3UploadResponse, QueryResponse, IngestResponse, DeleteResponse, AddTenantResponse, DeleteAllResponse
from llms.engine import get_client
from vectordb.engine import VectorDBEngine
from llm_chatbot.simple import SimplePipeline
from dotenv import load_dotenv
from models.requests import DeleteAllRequest
from migrate import migrate
from db.db_utils import create_conversation, add_message, get_messages, get_messages_by_role, get_conversations_by_user, get_conversation_by_user_and_id, delete_conversation_by_user_and_id
load_dotenv()

# Auto migrate database when starting app
migrate()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vector DB engine
vectordb_engine = VectorDBEngine(
    qdrant_host=config.QDRANT_HOST,
    qdrant_port=config.QDRANT_PORT,
    qdrant_collection_name=config.QDRANT_COLLECTION_NAME,
    qdrant_api_key=config.QDRANT_API_KEY,
    chunk_size=config.CHUNK_SIZE,
    chunk_overlap=config.CHUNK_OVERLAP
)

simple_pipeline = SimplePipeline(
    vectordb_engine=vectordb_engine,
    default_qa_prompt=config.DEFAULT_QA_PROMPT,
)

AWS_REGION = os.getenv("REGION")
s3_client = boto3.client("s3", region_name=AWS_REGION)

@app.get("/")
async def index():
    return FileResponse("index.html")

@app.post("/s3-upload", response_model=S3UploadResponse)
async def upload_to_s3(
        files: List[UploadFile] = File(...),
        bucket_name: str = Form(...),
        prefix: str = Form(...)
):
    try:
        if prefix and not prefix.endswith('/'):
            prefix = f"{prefix}/"
        uploaded_object_keys = []
        failed_uploads = []
        for file in files:
            try:
                original_filename = file.filename
                object_key = f"{prefix}{original_filename}"
                file_content = await file.read()
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=object_key,
                    Body=file_content
                )
                uploaded_object_keys.append(object_key)
                logger.info(f"Successfully uploaded file to S3: {object_key}")
            except Exception as e:
                logger.error(f"Failed to upload file {file.filename}: {str(e)}", exc_info=True)
                failed_uploads.append({"filename": file.filename, "error": str(e)})
        if not uploaded_object_keys and failed_uploads:
            status = "error"
            message = f"All uploads failed. {len(failed_uploads)} files could not be uploaded."
        elif uploaded_object_keys and failed_uploads:
            status = "partial_success"
            message = f"Uploaded {len(uploaded_object_keys)} files successfully. {len(failed_uploads)} files failed."
        else:
            status = "success"
            message = f"Successfully uploaded {len(uploaded_object_keys)} files to S3."
        return {
            "status": status,
            "message": message,
            "object_keys": uploaded_object_keys
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during S3 upload: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during S3 upload: {str(e)}")

async def _generate_stream(request: QuestionRequest):
    # Validate input, raise HTTPException if missing (before yield)
    try:
        if not request.reasoning_settings:
            raise HTTPException(status_code=400, detail="Missing reasoning_settings in request.")
        if not hasattr(request.reasoning_settings, 'llm') or request.reasoning_settings.llm is None:
            raise HTTPException(status_code=400, detail="Missing llm settings in reasoning_settings.")
        if not hasattr(request.reasoning_settings, 'language') or request.reasoning_settings.language is None:
            raise HTTPException(status_code=400, detail="Missing language in reasoning_settings.")
        if not hasattr(request.reasoning_settings, 'framework') or request.reasoning_settings.framework is None:
            raise HTTPException(status_code=400, detail="Missing framework in reasoning_settings.")
        llm_settings = request.reasoning_settings.llm
        system_prompt = request.system_prompt or config.DEFAULT_SYSTEM_PROMPT
        system_prompt = system_prompt.replace('{model}', llm_settings.model)
        system_prompt = system_prompt.replace('{lang}', request.reasoning_settings.language)
        chat_history = [msg.dict() for msg in request.chat_history] if request.chat_history else []
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(chat_history)
        original_question = request.question
        framework = request.reasoning_settings.framework
        provider_name = llm_settings.provider
        api_key = llm_settings.api_key
        project_id = llm_settings.project_id
        region = llm_settings.region
        application_credentials = llm_settings.application_credentials
        base_url = llm_settings.base_url
        api_version = llm_settings.api_version
        llm_client = get_client(provider_name, api_key=api_key, project_id=project_id, region=region, application_credentials=application_credentials, base_url=base_url, api_version=api_version)
        if not hasattr(request, 'mode') or request.mode is None:
            raise HTTPException(status_code=400, detail="Missing mode in request.")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # After validation, start streaming
    try:
        if request.mode == "RAG":
            if not request.retrieval_settings or not hasattr(request.retrieval_settings, 'embedding_settings') or request.retrieval_settings.embedding_settings is None:
                yield "data: " + json.dumps({"type": "error", "message": "Missing embedding_settings in retrieval_settings."}) + "\n\n"
                return
            embedding_settings = request.retrieval_settings.embedding_settings
            # Create embedding without API key parameter to avoid SecretStr issues
            embedding = OpenAIEmbeddings(model=embedding_settings.model)
            n_last_interactions = request.n_last_interactions if request.n_last_interactions is not None else config.DEFAULT_N_LAST_INTERACTIONS
            max_context_rewrite_length = request.max_context_rewrite_length if request.max_context_rewrite_length is not None else config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH
            sources_files = request.sources if request.sources is not None else []
            tenant_id = request.tenant_id if request.tenant_id is not None else ""
            top_k = request.top_k if request.top_k is not None else config.DEFAULT_TOP_K
            qa_prompt = request.qa_prompt if request.qa_prompt is not None else ""
            try:
                # Create ai.Client for type compatibility
                import aisuite as ai
                ai_client = ai.Client()
                
                async for chunk in simple_pipeline.stream(
                    original_question=original_question,
                    llm_client=ai_client,
                    messages=messages,
                    embedding=embedding,
                    chat_history=chat_history,
                    n_last_interactions=n_last_interactions,
                    max_context_rewrite_length=max_context_rewrite_length,
                    sources_files=sources_files,
                    tenant_id=tenant_id,
                    top_k=top_k,
                    qa_prompt=qa_prompt,
                    retrieval_settings=request.retrieval_settings,
                    reasoning_settings=request.reasoning_settings
                ):
                    yield chunk
            except Exception as e:
                yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"
                return
        elif request.mode == "LLM":
            yield "data: " + json.dumps({"type": "status", "message": "Processing with LLM..."}) + "\n\n"
            messages.append({"role": "user", "content": original_question})
            try:
                # Create ai.Client for type compatibility
                import aisuite as ai
                ai_client = ai.Client()
                
                async for chunk in simple_pipeline.stream_completion(
                    provider_name=provider_name,
                    model_name=llm_settings.model,
                    llm_client=ai_client,
                    messages=messages
                ):
                    if isinstance(chunk, str):
                        yield "data: " + json.dumps({
                            "type": "token",
                            "content": chunk
                        }) + "\n\n"
                    else:
                        usage = {}
                        if isinstance(chunk, dict) and "model" in chunk:
                            model_key = "chat_" + chunk["model"]
                            if model_key not in usage:
                                usage[model_key] = {
                                    "completion_tokens": chunk.get("completion_tokens", 0),
                                    "prompt_tokens": chunk.get("prompt_tokens", 0),
                                    "total_tokens": chunk.get("total_tokens", 0),
                                    "type": "chat",
                                    "model_setting": llm_settings.model
                                }
                            else:
                                usage[model_key]["completion_tokens"] += chunk.get("completion_tokens", 0)
                                usage[model_key]["prompt_tokens"] += chunk.get("prompt_tokens", 0)
                                usage[model_key]["total_tokens"] += chunk.get("total_tokens", 0)
                        yield "data: " + json.dumps({"type": "usage", "data": usage}) + "\n\n"    
                yield "data: " + json.dumps({"type": "done"}) + "\n\n"
            except Exception as e:
                yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"
                return
        else:
            yield "data: " + json.dumps({
                "type": "error",
                "message": f"Invalid model type: {request.mode}"
            }) + "\n\n"
            return
    except Exception as e:
        yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"
        return

@app.post("/query", response_model=QueryResponse)
async def query(request: QuestionRequest):
    try:
        return StreamingResponse(
            _generate_stream(request),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error in stream_query: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

@app.delete("/delete-all", response_model=DeleteAllResponse, tags=["Vector Management"])
async def delete_vectors_from_all(request: DeleteAllRequest): 
    try:
        object_keys_to_delete = request.object_keys
        tenant_id = request.tenant_id  
        if not object_keys_to_delete: 
             raise HTTPException(status_code=400, detail="No S3 object keys provided.")
        if tenant_id is None:
            raise HTTPException(status_code=400, detail="tenant_id is required for deletion.")
        logger.info(f"Received request to delete vectors for S3 object keys: {object_keys_to_delete}")
        delete_result = await vectordb_engine.delete_documents(object_keys_to_delete, tenant_id)
        if delete_result["status"] == "error":
            raise HTTPException(status_code=500, detail=delete_result["message"])
        return DeleteAllResponse(
            status=delete_result["status"],
            message=delete_result["message"]
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error processing /delete request for S3 keys {request.object_keys}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during deletion: {str(e)}")

@app.post("/add-tenant", response_model=AddTenantResponse, tags=["Tenant Management"])
async def add_tenant(request: AddTenantRequest):
    try:
        logger.info(f"Received request to add tenant: {request.tenant_id}")
        result = await vectordb_engine.create_tenant_collection(request.tenant_id, request.embedding_model, request.embedding_dimension)
        if result["status"] == "created":
            return AddTenantResponse(**result)
        elif result["status"] == "exists":
            return AddTenantResponse(**result)
        else:
            logger.error(f"Failed to add tenant {request.tenant_id}: {result.get('message', 'Unknown error')}")
            raise HTTPException(status_code=500, detail=result.get("message", "Failed to create or verify tenant collection."))
    except Exception as e:
        logger.error(f"Unexpected error in /add-tenant for tenant {request.tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.delete("/delete", response_model=DeleteResponse, tags=["Vector Management"])
async def delete_vectors_by_object_key_endpoint(request: DeleteRequest): 
    try:
        object_keys_to_delete = request.object_keys
        tenant_id = request.tenant_id
        if not object_keys_to_delete: 
            raise HTTPException(status_code=400, detail="No S3 object keys provided.")
        if tenant_id is None:
            raise HTTPException(status_code=400, detail="tenant_id is required for deletion.")
        logger.info(f"Received request to delete vectors for S3 object keys: {object_keys_to_delete}")
        delete_result = await vectordb_engine.delete_documents_by_object_key(object_keys_to_delete, tenant_id)
        if delete_result["status"] == "error":
            raise HTTPException(status_code=500, detail=delete_result["message"])
        return DeleteResponse(
            status=delete_result["status"],
            message=delete_result["message"]
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error processing /delete request for S3 keys {request.object_keys}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during deletion: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/history/conversations")
def api_create_conversation(user_id: int = Body(...), name: str = Body(...)):
    conversation_id = create_conversation(user_id, name)
    return {"conversation_id": conversation_id}

@app.post("/chat/message")
def api_add_message(conversation_id: int = Body(...), content: str = Body(...), created_by: int = Body(...), role: str = Body("user")):
    message_id = add_message(conversation_id, content, created_by, role)
    return {"message_id": message_id}

@app.get("/history/conversations/{conversation_id}")
def api_get_messages(conversation_id: int):
    messages = get_messages(conversation_id)
    return {"messages": messages}

@app.get("/history/{user_id}/{conversation_id}")
def get_user_conversation(user_id: int = Path(...), conversation_id: int = Path(...)):
    conversation = get_conversation_by_user_and_id(user_id, conversation_id)
    return {"conversation": conversation}

@app.delete("/history/{user_id}/{conversation_id}")
def delete_user_conversation(user_id: int = Path(...), conversation_id: int = Path(...)):
    result = delete_conversation_by_user_and_id(user_id, conversation_id)
    return {"success": result}

@app.get("/history/{user_id}")
def get_conversations(user_id: int = Path(...)):
    conversations = get_conversations_by_user(user_id)
    return {"conversations": conversations}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000)


