import logging
import json
import re
from difflib import SequenceMatcher
import traceback
from fastapi import FastAPI, HTTPException, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import config
from models.requests import QuestionRequest, RetrievalSettings
from models.responses import QueryResponse
from llms.engine import get_client
from reflection.engine import ReflectionEngine
from vectordb.engine import VectorDBEngine
from llm_chatbot.simple import SimplePipeline
from dotenv import load_dotenv
from db.db_utils import create_conversation, add_message, get_messages, get_conversations_by_user, get_conversation_by_user_and_id, delete_conversation_by_user_and_id
from metadata_extractor.engine import MetaDataFilterEngine
from hyde.engine import HyDEEngine

load_dotenv()

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
    qdrant_api_key=config.QDRANT_API_KEY
)

# Initialize model embedding
llm_client = get_client()

filter_pipeline = MetaDataFilterEngine(llm_client)

hyde_engine = HyDEEngine(llm_client)

reflection_engine = ReflectionEngine(llm_client)

simple_pipeline = SimplePipeline(
    vectordb_engine=vectordb_engine,
    filter_pipeline=filter_pipeline,
    reflection_engine=reflection_engine,
    hyde_engine=hyde_engine,
    default_qa_prompt=config.DEFAULT_QA_PROMPT
)

# Thay thế logic lấy embedding cho RAG
COLLECTION_NAME = config.QDRANT_COLLECTION_NAME
EMBEDDING_MODEL = config.EMBEDDING_MODEL_NAME
EMBEDDING_DIM = config.EMBEDDING_DIMENSION

@app.get("/")
async def index():
    return FileResponse("index.html")


async def _generate_stream(request: QuestionRequest):
    # Validate input, raise HTTPException if missing (before yield)
    try:
        if not request.reasoning_settings:
            raise HTTPException(status_code=400, detail="Missing reasoning_settings in request.")
        
        llm_settings = request.reasoning_settings.llm
        system_prompt = request.system_prompt or config.DEFAULT_SYSTEM_PROMPT
        system_prompt = system_prompt.replace('{lang}', request.reasoning_settings.language)
        chat_history = [msg.dict() for msg in request.chat_history] if request.chat_history else []
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(chat_history)
        original_question = request.question

        if not hasattr(request, 'mode') or request.mode is None:
            raise HTTPException(status_code=400, detail="Missing mode in request.")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        if request.mode == "RAG":
            try:
                retrieval_settings = request.retrieval_settings or RetrievalSettings(
                    retrieval_mode="hybrid",
                    use_MMR=True,
                    use_reranking=False,
                    use_llm_relevant_scoring=False,
                    prioritize_table=False
                )
                async for chunk in simple_pipeline.stream(
                    original_question=original_question,
                    llm_client=llm_client,
                    messages=messages,
                    chat_history=chat_history,
                    retrieval_settings=retrieval_settings,
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
                async for chunk in simple_pipeline.stream_completion(
                    model_name=llm_settings.model,
                    llm_client=llm_client,
                    messages=messages
                ):
                    if isinstance(chunk, str):
                        yield "data: " + json.dumps({
                            "type": "token",
                            "content": chunk
                        }) + "\n\n"
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


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/history/conversations")
def api_create_conversation(user_id: int = Body(...), name: str = Body(...)):
    conversation_id = create_conversation(user_id, name)
    return {"conversation_id": conversation_id}

@app.post("/chat/message", response_model=QueryResponse)
async def chat_message(request: QuestionRequest):
    try:
        conversation_id = getattr(request, "conversation_id", None)
        created_by = getattr(request, "created_by", None)
        if conversation_id and created_by:
            logger.info(f"Saving user message: conv_id={conversation_id}, user={created_by}, content={request.question}")
            add_message(conversation_id, request.question, created_by, "user")
        else:
            logger.warning(f"Missing conversation_id or created_by: conv_id={conversation_id}, user={created_by}")

        bot_answer = ""
        sources_refs = []

        async def bot_stream():
            nonlocal bot_answer, sources_refs
            try:
                async for chunk in _generate_stream(request):
                    if chunk.startswith("data: "):
                        try:
                            data = json.loads(chunk[6:])
                            if data.get("type") == "token":
                                bot_answer_chunk = data.get("content", "")
                                bot_answer += bot_answer_chunk
                            elif data.get("type") == "sources":
                                sources = data.get("data", [])
                                sources_refs = [src["metadata"].get("ref") for src in sources]

                        except json.JSONDecodeError:
                            pass
                    yield chunk
                
                if bot_answer.strip() and conversation_id:
                    # Normalize reference in bot_answer
                    def find_best_ref_match(refs, target_ref):
                        # Tìm ref gần đúng nhất với target_ref
                        best_match = None
                        best_ratio = 0.0
                        for ref in refs:
                            ratio = SequenceMatcher(None, ref, target_ref).ratio()
                            if ratio > best_ratio:
                                best_ratio = ratio
                                best_match = ref
                        return best_match if best_ratio > 0.8 else target_ref
                    def replace_references(match):
                        file_name, file_ref = match.groups()
                        best_ref = find_best_ref_match(sources_refs, file_ref)
                        return f"[{file_name}]({best_ref})"

                    refactored_bot_answer = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace_references, bot_answer)
                    logger.info(f"Response message: conv_id={conversation_id}, content={refactored_bot_answer}")
                    add_message(conversation_id, refactored_bot_answer, 0, "assistant")


            except Exception as e:
                logger.error(f"Error in bot_stream: {str(e)}")
                yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"

        return StreamingResponse(bot_stream(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in chat_message: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing chat message: {str(e)}")

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
    uvicorn.run("app:app", host="0.0.0.0", port=8096)

