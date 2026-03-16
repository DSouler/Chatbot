import logging
import json
import re
import io
import os
import base64
import uuid
import asyncio
from pathlib import Path as FilePath
from difflib import SequenceMatcher
import traceback

from fastapi import FastAPI, HTTPException, Path, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse

import config

from models.requests import (
    QuestionRequest,
    RetrievalSettings,
    ConversationCreateRequest,
    ConversationRenameRequest
)

from models.responses import QueryResponse

from llms.engine import get_client
from reflection.engine import ReflectionEngine
from vectordb.engine import VectorDBEngine
from llm_chatbot.simple import SimplePipeline

from dotenv import load_dotenv

from db.db_utils import (
    create_conversation,
    add_message,
    get_messages,
    get_conversations_by_user,
    get_conversation_by_user_and_id,
    delete_conversation_by_user_and_id,
    update_conversation_name,
    sync_user_from_auth_db,
    init_token_usage_table,
    record_token_usage,
    get_usage_stats,
    init_messages_images_column,
    update_last_bot_message,
)

from metadata_extractor.engine import MetaDataFilterEngine
from hyde.engine import HyDEEngine
from agents.google_tool import GoogleTool
from agents.web_reader_tool import WebReaderTool
from agents.opgg_scraper import scrape_opgg_meta
from agents.comp_evaluator import (
    is_comp_eval_request,
    extract_champions_from_text,
    build_known_champions,
    find_similar_comps,
    format_eval_context,
)

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from qdrant_client.models import VectorParams, Distance
from qdrant_client.http import models as qdrant_models


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# INIT COMPONENTS
# =========================

vectordb_engine = VectorDBEngine(
    qdrant_host=config.QDRANT_HOST,
    qdrant_port=config.QDRANT_PORT,
    qdrant_collection_name=config.QDRANT_COLLECTION_NAME,
    qdrant_api_key=config.QDRANT_API_KEY
)

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

google_tool = GoogleTool()
web_reader_tool = WebReaderTool(max_length=getattr(config, "WEB_READER_MAX_LENGTH", 3000))

try:
    init_token_usage_table()
    init_messages_images_column()
except Exception:
    pass  # Non-critical: table may already exist or DB may be unavailable

# =========================
# ROUTES
# =========================

@app.get("/")
async def index():
    return FileResponse("index.html")


# =========================
# STREAM GENERATOR
# =========================

def _build_user_content(question: str, images=None):
    """Build OpenAI-compatible user message content.
    Returns str for text-only, list for multimodal (vision)."""
    if not images:
        return question
    content = [{"type": "text", "text": question}]
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{img.media_type};base64,{img.data}"}
        })
    return content


async def _generate_stream(request: QuestionRequest):

    try:
        reasoning_settings = request.reasoning_settings

        if reasoning_settings is None:
            raise HTTPException(status_code=400, detail="Missing reasoning_settings")

        llm_settings = reasoning_settings.llm

        system_prompt = request.system_prompt or config.DEFAULT_SYSTEM_PROMPT
        system_prompt = system_prompt.replace("{lang}", reasoning_settings.language)

        chat_history = [
            msg.model_dump() for msg in request.chat_history
        ] if request.chat_history else []

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(chat_history)

        original_question = request.question
        # Khi gửi ảnh không kèm text, tự thêm prompt yêu cầu mô tả ảnh
        if request.images and not original_question.strip():
            original_question = "Hãy mô tả chi tiết nội dung của ảnh này."
        user_content = _build_user_content(original_question, request.images)

        if not request.mode:
            raise HTTPException(status_code=400, detail="Missing mode")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # =========================
    # CHITCHAT DETECTION
    # =========================
    def is_chitchat(text: str) -> bool:
        """Detect casual/greeting messages that don't need RAG retrieval."""
        t = text.strip().lower()
        # Remove punctuation for matching
        t_clean = re.sub(r'[^\w\s]', '', t)
        chitchat_patterns = [
            r'^(xin chào|chào|hello|hi|hey|helo|hêy|chao|xinchao)\b',
            r'^(chào bạn|chào bot|xin chào bot|hi bot|hello bot)\b',
            r'^(bạn là ai|bạn tên gì|mày là ai|bạn là gì|giới thiệu bản thân)',
            r'^(bạn có thể làm gì|bạn làm được gì|bạn hỗ trợ gì|bạn giúp được gì)',
            r'^(cảm ơn|cám ơn|thank|thanks|tks|ty)\b',
            r'^(ok|oke|okay|được rồi|hiểu rồi|rõ rồi|ừ|uh|uh huh)\b',
            r'^(tốt|hay|giỏi|tuyệt|awesome|great|nice)\b',
            r'^(bạn khỏe không|khỏe không|how are you)',
            r'^(tạm biệt|bye|goodbye|see you)',
        ]
        for pattern in chitchat_patterns:
            if re.search(pattern, t_clean):
                return True
        # Short messages with no TFT keywords are likely chitchat
        tft_keywords = ['tướng', 'đội hình', 'comp', 'trait', 'item', 'trang bị', 'tier',
                        'meta', 'augment', 'portal', 'patch', 'synergy', 'positioning',
                        'op.gg', 'tft', 'teamfight', 'champion', 'ranked', 'gold']
        words = t_clean.split()
        if len(words) <= 4 and not any(kw in t_clean for kw in tft_keywords):
            return True
        return False

    try:

        # =========================
        # CHITCHAT — trả lời trực tiếp, không qua RAG
        # =========================
        if is_chitchat(original_question) and request.mode == "RAG" and not request.images:
            messages.append({"role": "user", "content": user_content})
            async for chunk in simple_pipeline.stream_completion(
                model_name=llm_settings.model,
                llm_client=llm_client,
                messages=messages
            ):
                yield "data: " + json.dumps(chunk) + "\n\n"
            yield "data: " + json.dumps({"type": "done"}) + "\n\n"
            return

        # =========================
        # COMP EVAL — detect trước tất cả mode
        # =========================
        if is_comp_eval_request(original_question):
            yield "data: " + json.dumps({"type": "status", "message": "Đang phân tích đội hình..."}) + "\n\n"

            try:
                yield "data: " + json.dumps({"type": "info", "message": "Đang lấy meta comps từ op.gg..."}) + "\n\n"
                meta_comps = await scrape_opgg_meta()

                known_champs = build_known_champions(meta_comps)
                user_champions = extract_champions_from_text(original_question, known_champs)

                if not user_champions:
                    yield "data: " + json.dumps({
                        "type": "info",
                        "message": "⚠️ Không nhận ra tên tướng nào trong câu hỏi. Hãy liệt kê tên tướng cụ thể (ví dụ: Thresh, Braum, Kalista, ...)."
                    }) + "\n\n"
                    yield "data: " + json.dumps({"type": "done"}) + "\n\n"
                    return

                yield "data: " + json.dumps({
                    "type": "info",
                    "message": f"✅ Nhận ra {len(user_champions)} tướng: {', '.join(user_champions)}. Đang so sánh với meta..."
                }) + "\n\n"

                similar = find_similar_comps(user_champions, meta_comps, top_k=3)
                eval_context = format_eval_context(user_champions, similar)

                eval_prompt = config.COMP_EVAL_PROMPT.format(eval_context=eval_context)
                messages[0] = {"role": "system", "content": eval_prompt}
                messages.append({"role": "user", "content": user_content})

                async for chunk in simple_pipeline.stream_completion(
                    model_name=llm_settings.model,
                    llm_client=llm_client,
                    messages=messages
                ):
                    yield "data: " + json.dumps(chunk) + "\n\n"

                yield "data: " + json.dumps({"type": "done"}) + "\n\n"
                return

            except Exception as e:
                yield "data: " + json.dumps({
                    "type": "info",
                    "message": f"⚠️ Không thể đánh giá đội hình: {e}. Tiếp tục với mode thường..."
                }) + "\n\n"

        # =========================
        # RAG MODE
        # =========================

        if request.mode == "RAG":

            retrieval_settings = request.retrieval_settings or RetrievalSettings(
                retrieval_mode="vector",
                use_MMR=False,
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
                reasoning_settings=reasoning_settings,
                user_content=user_content
            ):
                yield chunk

        # =========================
        # LLM MODE
        # =========================

        elif request.mode == "LLM":

            yield "data: " + json.dumps({
                "type": "status",
                "message": "Processing with LLM..."
            }) + "\n\n"

            messages.append({
                "role": "user",
                "content": user_content
            })

            async for chunk in simple_pipeline.stream_completion(
                model_name=llm_settings.model,
                llm_client=llm_client,
                messages=messages
            ):

                yield "data: " + json.dumps(chunk) + "\n\n"

            yield "data: " + json.dumps({"type": "done"}) + "\n\n"

        # =========================
        # WEB SEARCH MODE
        # =========================

        elif request.mode == "WEB_SEARCH":

            lang = reasoning_settings.language if reasoning_settings else "Vietnamese"
            web_sys_prompt = config.DEFAULT_WEB_SEARCH_SYSTEM_PROMPT.replace("{lang}", lang)
            messages[0] = {"role": "system", "content": web_sys_prompt}

            yield "data: " + json.dumps({"type": "status", "message": "Đang xử lý..."}) + "\n\n"

            url_pattern = re.compile(r'https?://[^\s\]\)\"\']+')
            found_urls = url_pattern.findall(original_question)
            query_text = url_pattern.sub("", original_question).strip()
            max_results = getattr(config, "WEB_SEARCH_MAX_RESULTS", 3)

            # =====================================================================
            # FLOW A: Có URL → Scrape → Chunk → Embed vào Qdrant → RAG → LLM
            # =====================================================================
            if found_urls:
                yield "data: " + json.dumps({
                    "type": "info",
                    "message": f"Đang crawl {len(found_urls)} trang web..."
                }) + "\n\n"

                all_docs = []
                source_urls = []

                for url in found_urls:
                    # ── op.gg TFT meta comps: dùng structured scraper ──────────────
                    is_opgg_comps = "op.gg/tft" in url and "comp" in url
                    if is_opgg_comps:
                        yield "data: " + json.dumps({
                            "type": "info",
                            "message": f"Đang crawl op.gg với structured parser..."
                        }) + "\n\n"
                        try:
                            comps = await scrape_opgg_meta()
                            source_urls.append(url)
                            from agents.opgg_scraper import format_comp_as_document
                            for comp in comps:
                                doc_text = format_comp_as_document(comp)
                                all_docs.append(Document(
                                    page_content=doc_text,
                                    metadata={"source": url, "file_name": url, "comp_name": comp["name"]}
                                ))
                            yield "data: " + json.dumps({
                                "type": "info",
                                "message": f"✅ Đã parse {len(comps)} đội hình từ op.gg. Đang phân tích..."
                            }) + "\n\n"
                        except Exception as e:
                            yield "data: " + json.dumps({
                                "type": "info",
                                "message": f"⚠️ Không scrape được op.gg: {e}"
                            }) + "\n\n"
                        continue

                    # ── Các URL thông thường: raw text chunking ───────────────────
                    page_result = await web_reader_tool.read_url(url)
                    if not page_result.get("success") or not page_result.get("content", "").strip():
                        err_detail = page_result.get("error", "unknown error")
                        yield "data: " + json.dumps({
                            "type": "info",
                            "message": f"⚠️ Không đọc được: {url} — {err_detail}"
                        }) + "\n\n"
                        continue

                    raw_content = page_result["content"]
                    source_urls.append(url)

                    yield "data: " + json.dumps({
                        "type": "info",
                        "message": f"✅ Đã crawl {url} ({len(raw_content)} ký tự). Đang phân tích..."
                    }) + "\n\n"

                    # Chunk nội dung
                    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=80)
                    chunks = splitter.split_text(raw_content)

                    for chunk_text in chunks:
                        all_docs.append(Document(
                            page_content=chunk_text,
                            metadata={"source": url, "file_name": url}
                        ))

                if not all_docs:
                    yield "data: " + json.dumps({
                        "type": "error",
                        "message": "Không crawl được nội dung từ các URL. Trang có thể chặn bot."
                    }) + "\n\n"
                    yield "data: " + json.dumps({"type": "done"}) + "\n\n"
                    return

                yield "data: " + json.dumps({
                    "type": "info",
                    "message": f"Đang embedding {len(all_docs)} đoạn văn bản..."
                }) + "\n\n"

                # Xóa data cũ của các URL này trong Qdrant trước khi insert mới
                try:
                    vectordb_engine.qdrant_client.delete(
                        collection_name=config.QDRANT_COLLECTION_NAME,
                        points_selector=qdrant_models.FilterSelector(
                            filter=qdrant_models.Filter(
                                should=[
                                    qdrant_models.FieldCondition(
                                        key="metadata.source",
                                        match=qdrant_models.MatchValue(value=u)
                                    )
                                    for u in source_urls
                                ]
                            )
                        )
                    )
                except Exception:
                    pass

                # Embed và lưu vào Qdrant
                openai_embeddings = OpenAIEmbeddings(
                    openai_api_key=config.LLM_API_KEY,
                    model="text-embedding-ada-002"
                )
                _ensure_collection(vectordb_engine.qdrant_client, config.QDRANT_COLLECTION_NAME)

                vectors = await asyncio.to_thread(
                    openai_embeddings.embed_documents,
                    [d.page_content for d in all_docs]
                )

                from qdrant_client.models import PointStruct
                points = [
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector={"dense": vec},
                        payload={
                            "page_content": doc.page_content,
                            "metadata": doc.metadata
                        }
                    )
                    for doc, vec in zip(all_docs, vectors)
                ]
                vectordb_engine.qdrant_client.upsert(
                    collection_name=config.QDRANT_COLLECTION_NAME,
                    points=points
                )

                yield "data: " + json.dumps({
                    "type": "info",
                    "message": f"✅ Đã lưu {len(points)} đoạn vào knowledge base. Đang tìm kiếm câu trả lời..."
                }) + "\n\n"

                # RAG: in-memory cosine similarity trên chính vectors đã embed
                actual_query = query_text if query_text else original_question
                query_vec = await asyncio.to_thread(openai_embeddings.embed_query, actual_query)
                import numpy as np
                q = np.array(query_vec, dtype=np.float32)
                q_norm = q / (np.linalg.norm(q) + 1e-9)
                scored = []
                for doc, vec in zip(all_docs, vectors):
                    v = np.array(vec, dtype=np.float32)
                    v_norm = v / (np.linalg.norm(v) + 1e-9)
                    score = float(np.dot(q_norm, v_norm))
                    scored.append((score, doc.page_content))
                scored.sort(key=lambda x: x[0], reverse=True)
                top_chunks = [text for _, text in scored[:10]]
                context = "\n\n".join(top_chunks)

                web_search_prompt = config.DEFAULT_WEB_SEARCH_QA_PROMPT.format(
                    url=", ".join(source_urls),
                    context=context,
                    query=actual_query
                )
                messages.append({"role": "user", "content": web_search_prompt})

                yield "data: " + json.dumps({
                    "type": "sources",
                    "data": [{"title": u, "url": u} for u in source_urls]
                }) + "\n\n"

                async for chunk in simple_pipeline.stream_completion(
                    model_name=llm_settings.model,
                    llm_client=llm_client,
                    messages=messages
                ):
                    yield "data: " + json.dumps(chunk) + "\n\n"

                yield "data: " + json.dumps({"type": "done"}) + "\n\n"

            # =====================================================================
            # FLOW B: Không có URL → DuckDuckGo search → Scrape → Context → LLM
            # =====================================================================
            else:
                yield "data: " + json.dumps({"type": "info", "message": "Đang tìm kiếm DuckDuckGo..."}) + "\n\n"

                search_result = await google_tool.search(query_text or original_question, max_results=max_results)
                ddg_sources = search_result.get("sources", []) if search_result.get("success") else []

                enriched_sources = []
                if ddg_sources:
                    yield "data: " + json.dumps({
                        "type": "info",
                        "message": f"Tìm thấy {len(ddg_sources)} kết quả. Đang đọc nội dung..."
                    }) + "\n\n"
                    for source in ddg_sources:
                        src_url = source.get("url", "")
                        if src_url:
                            page_result = await web_reader_tool.read_url(src_url)
                            source["full_content"] = page_result.get("content", "") if page_result.get("success") else source.get("content", "")
                        enriched_sources.append(source)

                context_parts = []
                for i, src in enumerate(enriched_sources, 1):
                    content = src.get("full_content") or src.get("content", "")
                    if content.strip():
                        context_parts.append(f"[{i}] {src.get('title', f'Source {i}')}\nURL: {src.get('url', '')}\n{content}\n")

                if not context_parts:
                    yield "data: " + json.dumps({
                        "type": "error",
                        "message": "Không tìm thấy nội dung phù hợp. Hãy thử từ khóa khác hoặc cung cấp URL trực tiếp."
                    }) + "\n\n"
                    yield "data: " + json.dumps({"type": "done"}) + "\n\n"
                    return

                web_search_prompt = config.DEFAULT_WEB_SEARCH_QA_PROMPT.format(
                    url="DuckDuckGo search",
                    context="\n---\n".join(context_parts),
                    query=original_question
                )
                messages.append({"role": "user", "content": web_search_prompt})

                yield "data: " + json.dumps({
                    "type": "sources",
                    "data": [{"title": s.get("title", ""), "url": s.get("url", "")} for s in enriched_sources if s.get("url")]
                }) + "\n\n"

                async for chunk in simple_pipeline.stream_completion(
                    model_name=llm_settings.model,
                    llm_client=llm_client,
                    messages=messages
                ):
                    yield "data: " + json.dumps(chunk) + "\n\n"

                yield "data: " + json.dumps({"type": "done"}) + "\n\n"

        else:

            yield "data: " + json.dumps({
                "type": "error",
                "message": f"Invalid mode {request.mode}"
            }) + "\n\n"

    except Exception as e:

        yield "data: " + json.dumps({
            "type": "error",
            "message": str(e)
        }) + "\n\n"


# =========================
# QUERY API
# =========================

@app.post("/query", response_model=QueryResponse)
async def query(request: QuestionRequest):

    return StreamingResponse(
        _generate_stream(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# =========================
# HEALTH
# =========================

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# =========================
# CONVERSATION APIs
# =========================

@app.post("/conversations")
def api_create_conversation(request: ConversationCreateRequest):

    conversation_id = create_conversation(
        request.user_id,
        request.name
    )

    return {"conversation_id": conversation_id}


@app.put("/conversations/{conversation_id}")
def api_rename_conversation(conversation_id: int, request: ConversationRenameRequest):
    update_conversation_name(request.user_id, conversation_id, request.name.strip())
    return {"success": True}


@app.post("/chat/message")
async def chat_message(request: QuestionRequest):

    conversation_id = getattr(request, "conversation_id", None)
    created_by = getattr(request, "created_by", None)

    if conversation_id and created_by:
        images_data = [{"data": img.data, "media_type": img.media_type} for img in (request.images or [])]
        add_message(
            conversation_id,
            request.question,
            created_by,
            "user",
            images=images_data if images_data else None
        )

    bot_answer = ""
    usage_data = {}

    async def bot_stream():

        nonlocal bot_answer, usage_data

        async for chunk in _generate_stream(request):

            if chunk.startswith("data: "):

                try:

                    data = json.loads(chunk[6:])

                    if data.get("type") == "token":
                        bot_answer += data.get("content", "")
                    elif data.get("type") == "usage":
                        usage_data = data

                except:
                    pass

            yield chunk

        if bot_answer.strip() and conversation_id:

            add_message(
                conversation_id,
                bot_answer,
                0,
                "assistant"
            )

        if usage_data and conversation_id:
            model_name = getattr(getattr(getattr(request, "reasoning_settings", None), "llm", None), "model", config.DEFAULT_MODEL_NAME)
            try:
                record_token_usage(
                    created_by,
                    conversation_id,
                    model_name,
                    usage_data.get("prompt_tokens", 0),
                    usage_data.get("completion_tokens", 0),
                )
            except Exception:
                pass

    return StreamingResponse(
        bot_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/history/conversations/{conversation_id}")
def api_get_messages(conversation_id: int):

    messages = get_messages(conversation_id)

    return {"messages": messages}


@app.patch("/messages/{conversation_id}/last-bot")
def api_update_last_bot_message(conversation_id: int, body: dict = Body(...)):
    """Update the last bot message content and sources."""
    content = body.get("content")
    sources = body.get("sources")
    if not content:
        raise HTTPException(status_code=400, detail="Missing content")
    update_last_bot_message(conversation_id, content, sources=sources)
    return {"success": True}


@app.get("/history/{user_id}/{conversation_id}")
def get_user_conversation(user_id: int, conversation_id: int):

    conversation = get_conversation_by_user_and_id(
        user_id,
        conversation_id
    )

    return {"conversation": conversation}


@app.delete("/history/{user_id}/{conversation_id}")
def delete_user_conversation(user_id: int, conversation_id: int):

    result = delete_conversation_by_user_and_id(
        user_id,
        conversation_id
    )

    return {"success": result}


@app.get("/history/{user_id}")
def get_conversations(user_id: int):

    conversations = get_conversations_by_user(user_id)

    return {"conversations": conversations}


# =========================
# USER SYNC API
# =========================

@app.post("/sync-user")
def sync_user(user_id: int, username: str, first_name: str = None, last_name: str = None, department_id: int = None, position_id: int = 1):
    """
    Sync user from auth_db to vchatbot database
    Called after successful user registration
    """
    try:
        result = sync_user_from_auth_db(user_id, username, first_name, last_name, department_id, position_id)
        if result:
            return {"success": True, "message": "User synced successfully"}
        else:
            return {"success": True, "message": "User already exists"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# UPLOAD DOCUMENT
# =========================

def _ensure_collection(client, collection_name: str):
    """Ensure Qdrant collection exists with dense vector field (1536-dim, COSINE)."""
    try:
        info = client.get_collection(collection_name)
        vectors = info.config.params.vectors
        fields = list(vectors.keys()) if isinstance(vectors, dict) else []
        if "dense" not in fields:
            logger.info(f"Collection '{collection_name}' has wrong schema, recreating...")
            client.delete_collection(collection_name)
            client.create_collection(
                collection_name,
                vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)}
            )
            logger.info(f"Collection '{collection_name}' recreated with dense/1536 schema.")
    except Exception:
        logger.info(f"Collection '{collection_name}' not found, creating...")
        client.create_collection(
            collection_name,
            vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)}
        )
        logger.info(f"Collection '{collection_name}' created with dense/1536 schema.")


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    content = await file.read()
    text = ""

    if filename.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {e}")

    elif filename.lower().endswith(".txt"):
        text = content.decode("utf-8", errors="replace")

    elif filename.lower().endswith(".docx"):
        try:
            import docx as python_docx
            doc_obj = python_docx.Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc_obj.paragraphs if p.text.strip())
        except ImportError:
            raise HTTPException(status_code=400, detail="python-docx not installed on server")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {e}")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{filename}'. Supported formats: PDF, TXT, DOCX"
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from file")

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks generated from file content")

    # Build document objects
    docs = [
        Document(
            page_content=chunk,
            metadata={"source": filename, "file_name": filename}
        )
        for chunk in chunks
    ]

    # OpenAI embeddings (text-embedding-ada-002, 1536-dim)
    openai_embeddings = OpenAIEmbeddings(
        openai_api_key=config.LLM_API_KEY,
        model="text-embedding-ada-002"
    )

    # Ensure collection has correct schema
    _ensure_collection(vectordb_engine.qdrant_client, config.QDRANT_COLLECTION_NAME)

    # Generate embeddings for all chunks
    logger.info(f"Embedding {len(chunks)} chunks from '{filename}'...")
    vectors = await asyncio.to_thread(
        openai_embeddings.embed_documents,
        [doc.page_content for doc in docs]
    )

    # Build Qdrant points
    from qdrant_client.models import PointStruct
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector={"dense": vec},
            payload={
                "page_content": doc.page_content,
                "metadata": doc.metadata
            }
        )
        for doc, vec in zip(docs, vectors)
    ]

    # Upsert to Qdrant
    vectordb_engine.qdrant_client.upsert(
        collection_name=config.QDRANT_COLLECTION_NAME,
        points=points
    )

    logger.info(f"Uploaded {len(points)} chunks from '{filename}' to Qdrant.")
    return JSONResponse({"status": "success", "chunks_uploaded": len(points), "filename": filename})


# =========================
# INGEST META FROM OP.GG
# =========================

@app.post("/ingest-meta")
async def ingest_meta():
    """
    Scrape op.gg TFT meta comps và ingest vào Qdrant.
    Gọi endpoint này để cập nhật dữ liệu meta mới nhất.
    """
    try:
        comps = await scrape_opgg_meta()
        if not comps:
            return JSONResponse({"status": "error", "message": "Không parse được comp nào từ op.gg"}, status_code=500)

        openai_embeddings = OpenAIEmbeddings(
            openai_api_key=config.LLM_API_KEY,
            model="text-embedding-ada-002"
        )
        _ensure_collection(vectordb_engine.qdrant_client, config.QDRANT_COLLECTION_NAME)

        texts = [c["document_text"] for c in comps]
        logger.info(f"Embedding {len(texts)} comp documents...")
        vectors = await asyncio.to_thread(openai_embeddings.embed_documents, texts)

        from qdrant_client.models import PointStruct
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector={"dense": vec},
                payload={
                    "page_content": text,
                    "metadata": {
                        "source": "op.gg/tft/meta-trends/comps",
                        "file_name": "op.gg TFT Meta",
                        "comp_name": comp["name"],
                        "tier": comp["tier"],
                        "top4_rate": comp["top4_rate"],
                        "avg_place": comp["avg_place"]
                    }
                }
            )
            for text, vec, comp in zip(texts, vectors, comps)
        ]

        vectordb_engine.qdrant_client.upsert(
            collection_name=config.QDRANT_COLLECTION_NAME,
            points=points
        )

        tier_summary = {}
        for c in comps:
            tier_summary[c["tier"]] = tier_summary.get(c["tier"], 0) + 1

        logger.info(f"Ingested {len(points)} comp documents. Tiers: {tier_summary}")
        return JSONResponse({
            "status": "success",
            "comps_ingested": len(points),
            "tiers": tier_summary,
            "preview": [{"name": c["name"], "tier": c["tier"], "top4_rate": c["top4_rate"]} for c in comps[:5]]
        })

    except Exception as e:
        logger.error(f"ingest-meta error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@app.get("/upload/stats")
def upload_stats():
    """Return collection statistics."""
    try:
        info = vectordb_engine.qdrant_client.get_collection(config.QDRANT_COLLECTION_NAME)
        return {
            "collection": config.QDRANT_COLLECTION_NAME,
            "points_count": info.points_count,
            "status": str(info.status)
        }
    except Exception as e:
        return {"collection": config.QDRANT_COLLECTION_NAME, "points_count": 0, "error": str(e)}



# =========================
# CHAMPION IMAGES
# =========================

CHAMPION_IMAGES_DIR = FilePath("champion_images")
CHAMPION_IMAGES_DIR.mkdir(exist_ok=True)

@app.post("/save-image")
async def save_image(name: str, body: dict = Body(...)):
    """Lưu ảnh base64 vào thư mục champion_images với tên cho trước."""
    try:
        img_data = base64.b64decode(body["base64"])
        media_type = body.get("media_type", "image/png")
        ext = media_type.split("/")[-1].split(";")[0]  # png, jpeg, webp, gif
        if ext == "jpeg":
            ext = "jpg"
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip().lower())
        file_path = CHAMPION_IMAGES_DIR / f"{safe_name}.{ext}"
        with open(file_path, "wb") as f:
            f.write(img_data)
        return {"success": True, "message": f"Đã lưu ảnh '{name}'", "name": safe_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/image/{name}")
async def get_image(name: str):
    """Trả về file ảnh đã lưu theo tên."""
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip().lower())
    for ext in ["png", "jpg", "jpeg", "webp", "gif"]:
        file_path = CHAMPION_IMAGES_DIR / f"{safe_name}.{ext}"
        if file_path.exists():
            return FileResponse(str(file_path), media_type=f"image/{ext}")
    raise HTTPException(status_code=404, detail=f"Không tìm thấy ảnh '{name}'")


@app.get("/saved-images")
async def get_saved_images():
    """Trả về danh sách tên tướng đã có ảnh lưu trong hệ thống."""
    if not CHAMPION_IMAGES_DIR.exists():
        return {"names": []}
    names = [
        f.stem for f in CHAMPION_IMAGES_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    ]
    return {"names": names}


@app.get("/report/usage")
def api_usage_stats(user_id: int = None, days: int = 30):
    try:
        stats = get_usage_stats(user_id=user_id, days=days)
        return stats
    except Exception as e:
        return {"summary": {}, "daily": [], "error": str(e)}


# =========================
# RUN SERVER
# =========================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8096,
        reload=True
    )