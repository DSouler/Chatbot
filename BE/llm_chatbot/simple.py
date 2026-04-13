from http.client import responses
from concurrent.futures import ThreadPoolExecutor
import asyncio
import asyncio
import logging
import json
import os
from collections import Counter
from typing import List, Dict, Any, Optional, AsyncGenerator, Callable

from llms.engine import get_client
from vectordb.engine import VectorDBEngine
from models.exceptions import StreamGenerationError, TimeoutError
from reflection.engine import ReflectionEngine
import config
from langchain_qdrant import RetrievalMode
from models.requests import RetrievalSettings, ReasoningSettings
from .base import BasePipeline
import threading
from langchain_openai import OpenAIEmbeddings
from time import sleep
from metadata_extractor.engine import MetaDataFilterEngine
from hyde.engine import HyDEEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Crafting Calculator — tính toán deterministic, không phụ thuộc LLM
# ─────────────────────────────────────────────────────────────────────────────

_ITEMS_DATA = None  # lazy-loaded once

def _load_items_data() -> dict:
    global _ITEMS_DATA
    if _ITEMS_DATA is None:
        data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'tft_items_dtcl_s17.json')
        with open(data_path, encoding='utf-8') as f:
            _ITEMS_DATA = json.load(f)
    return _ITEMS_DATA

# Tên chuẩn → các alias người dùng hay gõ (lowercase)
_COMPONENT_ALIASES = {
    "Kiếm B.F.":        ["kiếm b.f.", "kiếm bf", "kiem bf", "kiem b.f.", "b.f.", "bf"],
    "Cung Gỗ":          ["cung gỗ", "cung go", "cung dài", "cung dai"],
    "Gậy Quá Khổ":      ["gậy quá khổ", "gay qua kho", "gậy lớn", "gay lon", "gậy phep", "gay phep"],
    "Nước Mắt Nữ Thần": ["nước mắt nữ thần", "nuoc mat nu than", "nước mắt", "nuoc mat"],
    "Giáp Lưới":        ["giáp lưới", "giap luoi", "giáp lưới"],
    "Áo Choàng Bạc":    ["áo choàng bạc", "ao choang bac", "negatron", "áo choàng bac"],
    "Đai Khổng Lồ":     ["đai khổng lồ", "dai khong lo", "đai khổng", "dai khong"],
    "Găng Đấu Tập":     ["găng đấu tập", "gang dau tap", "găng tay", "gang tay"],
    "Thìa Vàng":        ["thìa vàng", "thia vang", "spatula"],
}

_CRAFTING_TRIGGER_KW = ["tôi có", "toi co", "mình có", "minh co", "tôi đang có", "đang có", "dang co"]
_CRAFTING_INTENT_KW  = ["ghép được", "ghep duoc", "có thể ghép", "co the ghep",
                        "tạo được", "tao duoc", "làm được", "lam duoc",
                        "ghép trang bị", "ghep trang bi", "lắp được"]


def _detect_crafting_query(question: str) -> bool:
    """Trả True nếu user hỏi 'tôi có X, Y, Z ghép được trang bị nào'."""
    q = question.lower()
    has_trigger    = any(k in q for k in _CRAFTING_TRIGGER_KW)
    has_intent     = any(k in q for k in _CRAFTING_INTENT_KW)
    comp_count     = sum(1 for aliases in _COMPONENT_ALIASES.values()
                        if any(a in q for a in aliases))
    return has_trigger and (has_intent or comp_count >= 2)


def _extract_components_from_query(question: str) -> list:
    """Trích xuất danh sách tên thành phần từ câu hỏi, tính số lượng."""
    q = question.lower()
    result = []
    for canonical, aliases in _COMPONENT_ALIASES.items():
        # Tìm alias khớp đầu tiên và đếm số lần xuất hiện
        for alias in sorted(aliases, key=len, reverse=True):  # dài trước để ưu tiên match dài
            count = q.count(alias)
            if count > 0:
                result.extend([canonical] * count)
                break  # tránh double-count với alias ngắn hơn
    return result


def _compute_craftable(components: list) -> list:
    """Trả về danh sách chính xác các trang bị ghép được từ bộ thành phần."""
    data = _load_items_data()
    available = Counter(components)
    craftable = []
    for item in data["combined_items"]:
        recipe  = item["recipe_vn"]           # [comp1, comp2]
        needed  = Counter(recipe)
        if all(available[c] >= needed[c] for c in needed):
            craftable.append(item)
    return craftable


def _build_crafting_prompt(question: str, components: list, craftable: list, lang: str) -> str:
    comp_str = ", ".join(components)
    if craftable:
        lines = [
            f"DỮLIỆU TÍNH TOÁN CHÍNH XÁC (đã xác minh bởi hệ thống):",
            f"Người dùng có: {comp_str}",
            f"Tổng cộng {len(craftable)} trang bị ghép được:",
        ]
        for item in craftable:
            lines.append(f"  • {item['name']} = {item['recipe_vn'][0]} + {item['recipe_vn'][1]} — {item['description']}")
    else:
        lines = [
            f"DỮLIỆU TÍNH TOÁN CHÍNH XÁC:",
            f"Người dùng có: {comp_str}",
            f"Không có trang bị nào ghép được từ các thành phần này.",
        ]
    lines += [
        "",
        "QUY TẮC BẮT BUỘC KHI TRẢ LỜI:",
        "1. CHỈ liệt kê ĐÚNG các trang bị trong danh sách trên — KHÔNG thêm bất kỳ trang bị nào khác",
        "2. KHÔNG đề cập trang bị cần thêm nguyên liệu mà người dùng không có",
        "3. KHÔNG đề xuất 'nếu có thêm X thì ghép được Y' trừ khi user hỏi",
        f"4. Trả lời bằng {lang}, format đẹp, dùng tên trang bị tiếng Việt",
        "",
        f"Câu hỏi của người dùng: {question}",
    ]
    return "\n".join(lines)

class SimplePipeline(BasePipeline):
    """
    RAG-enabled simple pipeline for handling LLM interactions
    Using aisuite for unified LLM provider interface
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new RAGChatbot instance")
            cls._instance = super(SimplePipeline, cls).__new__(cls)
        return cls._instance

    def __init__(
            self,
            vectordb_engine: VectorDBEngine,
            filter_pipeline: MetaDataFilterEngine,
            reflection_engine: ReflectionEngine,
            hyde_engine: HyDEEngine,
            default_qa_prompt: str = config.DEFAULT_QA_PROMPT,
            embedding: Any = None,
    ):
        if not self._initialized:
            super().__init__(vectordb_engine, default_qa_prompt)
            self.filter_pipeline = filter_pipeline
            self.reflection_engine = reflection_engine
            self.hyde_engine = hyde_engine
            self.embedding = OpenAIEmbeddings(
                openai_api_key=config.LLM_API_KEY,
                model="text-embedding-ada-002"
            )
            self.__class__._initialized = True
            logger.info("Initialized RAG Chatbot")


    def _create_augmented_prompt(self, query: str, relevant_docs: List[Dict[str, Any]], lang: Optional[str] = None) -> str:
        """Create an augmented prompt with relevant context for the query"""
        if not relevant_docs:
            return query

        if lang is None:
            lang = config.DEFAULT_LANGUAGE

        # Remove duplicate documents based on content and filter out empty documents
        seen_contents = set()
        unique_docs = []
        
        for doc in relevant_docs:
            content = doc.get('content', '').strip()
            if content and content not in seen_contents:
                seen_contents.add(content)
                unique_docs.append(doc)

        # Ưu tiên feedback-boosted docs lên đầu
        boosted = [d for d in unique_docs if d.get('metadata', {}).get('is_feedback_boosted')]
        normal  = [d for d in unique_docs if not d.get('metadata', {}).get('is_feedback_boosted')]
        unique_docs = boosted + normal

        formatted_docs = []
        for doc in unique_docs:
            metadata = doc.get('metadata', {})
            if metadata.get('is_feedback_boosted'):
                score = metadata.get('feedback_score', 1)
                formatted_docs.append(
                    f"[⭐ ĐƯỢC CỘNG ĐỒNG ĐÁNH GIÁ TỐT (👍 {score} lượt) — ƯU TIÊN SỬ DỤNG NẾU PHÙ HỢP]\n{doc['content']}\n"
                )
            else:
                file_name = metadata.get('file_name', 'Unknown file')
                ref = metadata.get('ref', "https://vms.vti.com.vn/myvti")
                similarity_score = f"{doc.get('embedding_score', 0.0):.2f}"
                formatted_docs.append(
                    f"[{file_name}]({ref}) (Similarity: {similarity_score})\n{doc['content']}\n"
                )

        context = "\n\n".join(formatted_docs)

        return self.default_qa_prompt.format(context=context, query=query, lang=lang)

    async def retrieve(self, embedding: Any, retrieval_settings: RetrievalSettings, query: str, top_k: int = config.DEFAULT_TOP_K, filter_payload: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents for a query
        """
        retrieval_mode = retrieval_settings.retrieval_mode
        use_MMR = retrieval_settings.use_MMR
        use_reranking = retrieval_settings.use_reranking
        prioritize_table = retrieval_settings.prioritize_table

        mapping_retrieval_mode = {
            "vector": RetrievalMode.DENSE,
            "hybrid": RetrievalMode.HYBRID,
            "text": RetrievalMode.SPARSE
        }

        docs = await self.vectordb.retrieve_relevant_documents(
            query,
            embedding,
            mapping_retrieval_mode[retrieval_mode],
            top_k,
            filter_payload,
            use_MMR,
            use_reranking,
            prioritize_table
        )
        
        return docs

    @staticmethod
    def _build_content_with_images(text: str, user_content) -> object:
        """Giữ lại ảnh khi ghi đè text content trong RAG pipeline."""
        if not isinstance(user_content, list):
            return text
        images = [item for item in user_content if item.get("type") == "image_url"]
        if not images:
            return text
        return [{"type": "text", "text": text}] + images

    async def stream(
            self, original_question: str,
            chat_history: List[Dict[str, str]],
            llm_client: Any,
            messages: List[Dict[str, str]],
            retrieval_settings: RetrievalSettings,
            reasoning_settings: ReasoningSettings,
            user_content=None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM
        """
        yield "data: " + json.dumps({"type": "status", "message": "Processing RAG query..."}) + "\n\n"

        model_name = reasoning_settings.llm.model if reasoning_settings.llm.model else config.DEFAULT_MODEL_NAME
        lang = reasoning_settings.language

        # Run query enhancement and metadata filter in parallel (non-blocking)
        enhanced_query_result, filter_metadata_result = await asyncio.gather(
            asyncio.to_thread(
                self.reflection_engine.enhance_query,
                model_name,
                original_question,
                chat_history,
                config.DEFAULT_N_LAST_INTERACTIONS,
                config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH
            ),
            asyncio.to_thread(
                self.filter_pipeline,
                original_question
            )
        )

        logger.info("Filtered Metadata:", filter_metadata_result)

        # Extract the enhanced query text
        enhanced_query_text = enhanced_query_result.get("enhanced_query", original_question)

        # Run HyDE document creation (also in thread to avoid blocking event loop)
        hyDE_document = await asyncio.to_thread(
            self.hyde_engine._create_hyde_documents,
            model_name=model_name,
            question=enhanced_query_text
        )

        hyDE_document_text = hyDE_document.get("hyDE_documents", enhanced_query_text)

        messages.append({"role": "user", "content": user_content if user_content is not None else original_question})

        # ── Crafting Calculator: xử lý riêng câu hỏi "tôi có X, Y, Z ghép được gì" ──
        if _detect_crafting_query(original_question):
            components = _extract_components_from_query(original_question)
            if len(components) >= 2:
                craftable = _compute_craftable(components)
                logger.info(f"[CraftingCalc] components={components}, craftable={[i['name'] for i in craftable]}")
                yield "data: " + json.dumps({"type": "info", "message": f"Crafting calculator: {len(components)} thành phần, {len(craftable)} trang bị ghép được"}) + "\n\n"
                crafting_prompt = _build_crafting_prompt(original_question, components, craftable, lang)
                messages[-1]["content"] = self._build_content_with_images(crafting_prompt, user_content)
                async for chunk in self.stream_completion(model_name, llm_client, messages):
                    yield "data: " + json.dumps(chunk) + "\n\n"
                yield "data: " + json.dumps({"type": "done"}) + "\n\n"
                return

        # Get relevant documents pipeline
        try:
            res_retrive = await self.retrieve(
                embedding=self.embedding,
                retrieval_settings=retrieval_settings,
                query=hyDE_document_text,
                top_k= config.DEFAULT_TOP_K,
                filter_payload=None
            )    
            relevant_docs = res_retrive["docs"]
        except Exception as e:
            logger.warning(f"Retrieval failed (no vector store context): {e}")
            relevant_docs = []

        # Fallback: nếu hyDE query không tìm được docs, thử lại với original question
        if not relevant_docs and hyDE_document_text != original_question:
            logger.info(f"HyDE query returned no docs, retrying with original question: {original_question}")
            try:
                res_retrive_fallback = await self.retrieve(
                    embedding=self.embedding,
                    retrieval_settings=retrieval_settings,
                    query=original_question,
                    top_k=config.DEFAULT_TOP_K,
                    filter_payload=None
                )
                relevant_docs = res_retrive_fallback["docs"]
            except Exception as e:
                logger.warning(f"Fallback retrieval also failed: {e}")
                relevant_docs = []

        if relevant_docs:
            # Remove duplicate documents for consistent numbering
            seen_contents = set()
            unique_docs = []
            
            for doc in relevant_docs:
                content = doc.get('content', '').strip()
                if content and content not in seen_contents:
                    seen_contents.add(content)
                    unique_docs.append(doc)
            
            # Send info about found documents
            yield "data: " + json.dumps({
                "type": "info",
                "message": f"Found {len(unique_docs)} unique relevant documents for query: "+ enhanced_query_text
            }) + "\n\n"

            # Create augmented prompt with unique documents
            augmented_prompt = self._create_augmented_prompt(original_question, unique_docs, lang)
            logger.info(f"Augmented prompt: {augmented_prompt}")
            messages[-1]["content"] = self._build_content_with_images(augmented_prompt, user_content)

            async for chunk in self.stream_completion(model_name, llm_client, messages):
                yield "data: " + json.dumps(chunk) + "\n\n"
        else:
            # No documents found — fall back but still try to answer
            yield "data: " + json.dumps({
                "type": "info",
                "message": "Không tìm thấy tài liệu liên quan trong database. Đang trả lời bằng kiến thức có sẵn..."
            }) + "\n\n"

            fallback_text = (
                f"Hãy trả lời câu hỏi sau về TFT Set 16 bằng {lang}.\n\n"
                f"QUY TẮC:\n"
                f"- Câu hỏi này về TFT Set 16 - Truyền Thuyết & Huyền Thoại. Hãy TRẢ LỜI dựa trên kiến thức của bạn về TFT Set 16.\n"
                f"- KHÔNG được từ chối trả lời. Nếu không có thông tin chính xác, hãy cung cấp thông tin chung và gợi ý người dùng hỏi cụ thể hơn.\n"
                f"- KHÔNG sử dụng kiến thức về Set cũ (Set 14, Set 15, patch 14.x, patch 15.x)\n"
                f"- BẮT BUỘC dùng tên trang bị tiếng Việt\n\n"
                f"Câu hỏi: {original_question}\nTrả lời:"
            )
            messages[-1]["content"] = self._build_content_with_images(fallback_text, user_content)

            async for chunk in self.stream_completion(model_name, llm_client, messages):
                yield "data: " + json.dumps(chunk) + "\n\n"

        # Display sources
        if relevant_docs:
            # Remove duplicate documents for sources display (same logic as in _create_augmented_prompt)
            seen_contents = set()
            unique_docs = []
            
            for doc in relevant_docs:
                content = doc.get('content', '').strip()
                if content and content not in seen_contents:
                    seen_contents.add(content)
                    unique_docs.append(doc)
            
                sources = [
                    {
                        "content": doc["content"],
                        "source": doc["metadata"].get("source", "Unknown"),
                        "embedding_score": doc.get("embedding_score", 0.0),
                        "relevance_score": None,
                        "metadata": doc["metadata"]
                    } for doc in unique_docs
                ]

            # Send sources information
            yield "data: " + json.dumps({"type": "sources", "data": sources}) + "\n\n"
        
        # Send completion message
        yield "data: " + json.dumps({"type": "done"}) + "\n\n"     

    async def stream_completion(
            self,
            model_name: str,
            llm_client: Any,
            messages: List[Dict[str, str]],
            callback: Optional[Callable[[str], None]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream a response from the LLM using a background thread so the
        event loop is never blocked, allowing uvicorn to flush each token
        to the client in real time.
        """
        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def _sync_stream():
            try:
                stream = llm_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    stream_options={"include_usage": True},
                    temperature=config.DEFAULT_TEMPERATURE,
                )
                for chunk in stream:
                    # Final chunk carries usage stats (empty choices list)
                    if hasattr(chunk, "usage") and chunk.usage is not None:
                        asyncio.run_coroutine_threadsafe(
                            queue.put({
                                "type": "usage",
                                "prompt_tokens": chunk.usage.prompt_tokens,
                                "completion_tokens": chunk.usage.completion_tokens,
                                "total_tokens": chunk.usage.total_tokens,
                            }), loop
                        )
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    reasoning_content = getattr(delta, "reasoning_content", None)
                    content = getattr(delta, "content", None)
                    if reasoning_content:
                        asyncio.run_coroutine_threadsafe(
                            queue.put({"type": "thinking", "content": reasoning_content}), loop
                        )
                    if content is not None:
                        asyncio.run_coroutine_threadsafe(
                            queue.put({"type": "token", "content": content}), loop
                        )
            except Exception as e:
                asyncio.run_coroutine_threadsafe(
                    queue.put({"type": "_error", "content": str(e)}), loop
                )
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(None), loop)

        thread = threading.Thread(target=_sync_stream, daemon=True)
        thread.start()

        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                if item.get("type") == "_error":
                    raise StreamGenerationError(item["content"])
                if callback and item.get("content"):
                    callback(item["content"])
                yield item
        except asyncio.TimeoutError:
            raise TimeoutError()
        except StreamGenerationError:
            raise
        except Exception as e:
            logger.error(f"Error in stream_completion: {str(e)}")
            raise StreamGenerationError(str(e))


# simple_pipeline_instance = None 
# sdwadadwwd