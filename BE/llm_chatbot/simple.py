from http.client import responses
from concurrent.futures import ThreadPoolExecutor
import asyncio
import logging
import json
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
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from time import sleep
from metadata_extractor.engine import MetaDataFilterEngine
from hyde.engine import HyDEEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            self.embedding = HuggingFaceBgeEmbeddings(
            model_name=config.EMBEDDING_MODEL_NAME,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
            query_instruction=""
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

        formatted_docs = []
        for doc in unique_docs:
            metadata = doc.get('metadata', {})
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

    async def stream(
            self, original_question: str,
            chat_history: List[Dict[str, str]], 
            llm_client: Any,
            messages: List[Dict[str, str]], 
            retrieval_settings: RetrievalSettings,
            reasoning_settings: ReasoningSettings
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM
        """
        yield "data: " + json.dumps({"type": "status", "message": "Processing RAG query..."}) + "\n\n"

        model_name = reasoning_settings.llm.model if reasoning_settings.llm.model else config.DEFAULT_MODEL_NAME
        lang = reasoning_settings.language

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_enhanced_query = executor.submit(
                self.reflection_engine.enhance_query,
                model_name,
                original_question,
                chat_history,
                config.DEFAULT_N_LAST_INTERACTIONS,
                config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH
            )
            future_filter_metadata = executor.submit(
                self.filter_pipeline,
                original_question
            )

            enhanced_query_result = future_enhanced_query.result()
            filter_metadata_result = future_filter_metadata.result()

        logger.info("Filtered Metadata:", filter_metadata_result)

        # Extract the enhanced query text
        enhanced_query_text = enhanced_query_result.get("enhanced_query", original_question)

        hyDE_document= self.hyde_engine._create_hyde_documents(model_name=model_name,question=enhanced_query_text)

        hyDE_document_text = hyDE_document.get("hyDE_documents", enhanced_query_text)

        messages.append({"role": "user", "content": original_question})    

        # Get relevant documents pipeline
        res_retrive = await self.retrieve(
            embedding=self.embedding,
            retrieval_settings=retrieval_settings,
            query=hyDE_document_text,
            top_k= config.DEFAULT_TOP_K,
            filter_payload=filter_metadata_result
        )    
        relevant_docs = res_retrive["docs"]

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
            messages[-1]["content"] = augmented_prompt

        
        async for chunk in self.stream_completion(model_name,llm_client,messages):
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
        Stream a response from the LLM

        Args:
            messages: List of message dictionaries with role and content
            callback: Optional callback function to be called for each chunk

        Yields:
            Response chunks from the LLM
            :param messages:
            :param callback:
            :param relevant_docs:
            :param use_rag:
        """
        try:

            # Create a streaming request to OpenAI
            stream = await asyncio.to_thread(
                llm_client.chat.completions.create,
                model=f"{model_name}",
                messages=messages,
                stream=True,
                temperature=config.DEFAULT_TEMPERATURE,
            )
            collected_thinking = ""
            collected_message = ""
            for chunk in stream:
                reasoning_content = None
                content = None
                if hasattr(chunk.choices[0].delta, "reasoning_content"):
                    reasoning_content = chunk.choices[0].delta.reasoning_content
                if hasattr(chunk.choices[0].delta, "content"):
                    content = chunk.choices[0].delta.content
                    
                if reasoning_content:
                  collected_thinking += reasoning_content
                  if callback:
                    callback(reasoning_content)
                  yield {"type": "thinking", "content": reasoning_content}
                  await asyncio.sleep(0.01)
                  
                if content is not None:
                  collected_message += content
                  if callback:
                    callback(content)
                  yield {"type": "token", "content": content}
                  await asyncio.sleep(0.01)

        except asyncio.TimeoutError:
            raise TimeoutError()
        except Exception as e:
            logger.error(f"Error in stream_completion: {str(e)}")
            raise StreamGenerationError(str(e))
