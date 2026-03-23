from http.client import responses

import aisuite as ai
import asyncio
import logging
import json
from typing import List, Dict, Any, Optional, AsyncGenerator, Callable
from langchain_openai import OpenAIEmbeddings

from llms.engine import get_client
from vectordb.engine import VectorDBEngine
from models.exceptions import StreamGenerationError, TimeoutError
from reflection.engine import ReflectionEngine
import config
from langchain_qdrant import RetrievalMode
from models.requests import RetrievalSettings, ReasoningSettings
from .base import BasePipeline
import threading
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
            default_qa_prompt: str = config.DEFAULT_QA_PROMPT,
    ):
        if not self._initialized:
            super().__init__(vectordb_engine, default_qa_prompt)

            self.__class__._initialized = True
            logger.info("Initialized RAG Chatbot")


    def _create_augmented_prompt(self, query: str, relevant_docs: List[Dict[str, Any]], qa_prompt: Optional[str] = None, lang: Optional[str] = None) -> str:
        """Create an augmented prompt with relevant context for the query"""
        if not relevant_docs:
            return query

        if lang is None:
            lang = config.DEFAULT_LANGUAGE

        # Check if qa_prompt contains all required format placeholders
        required_placeholders = ['{lang}', '{context}', '{query}']
        if qa_prompt and not all(placeholder in qa_prompt for placeholder in required_placeholders):
            logger.warning(f"qa_prompt missing required placeholders. Required: {required_placeholders}")
            qa_prompt = None

        formatted_docs = []
        for i, doc in enumerate(relevant_docs):
            page_info = f"Page {doc['metadata'].get('page', 'unknown')}"
            similarity_score = f"{doc['embedding_score']:.2f}"
            formatted_docs.append(
                f"[Document {i+1}] {page_info} (Similarity: {similarity_score})\n{doc['content']}\n"
            )

        context = "\n\n".join(formatted_docs)

        if qa_prompt:
            qa_prompt = qa_prompt.format(context=context, query=query, lang=lang)
        else:
            qa_prompt = self.default_qa_prompt.format(context=context, query=query, lang=lang)

        return qa_prompt

    async def retrieve(self, embedding: OpenAIEmbeddings, retrieval_settings: RetrievalSettings, query: str, top_k: int = config.DEFAULT_TOP_K, filter_payload: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents for a query
        """
        retrieval_mode = retrieval_settings.retrieval_mode
        use_MMR = retrieval_settings.use_MMR
        use_reranking = retrieval_settings.use_reranking
        prioritize_table = retrieval_settings.prioritize_table
        llm_relevant_scoring = retrieval_settings.llm_relevant_scoring

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
            llm_client: ai.Client,
            embedding: OpenAIEmbeddings,
            messages: List[Dict[str, str]], 
            n_last_interactions: int,
            max_context_rewrite_length: int,
            sources_files: List[str],
            tenant_id: str,
            top_k: int,
            qa_prompt: str,
            retrieval_settings: RetrievalSettings,
            reasoning_settings: ReasoningSettings
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM
        """
        yield "data: " + json.dumps({"type": "status", "message": "Processing RAG query..."}) + "\n\n"

        provider_name = reasoning_settings.llm.provider if reasoning_settings.llm.provider else config.DEFAULT_LLM_PROVIDER
        model_name = reasoning_settings.llm.model if reasoning_settings.llm.model else config.DEFAULT_MODEL_NAME
        lang = reasoning_settings.language
        use_llm_relevant_scoring = retrieval_settings.use_llm_relevant_scoring
        llm_relevant_scoring = retrieval_settings.llm_relevant_scoring
        reflection_engine = ReflectionEngine(llm_client)
        usage = {}

        # Enhance query pipeline
        enhanced_query = await reflection_engine.enhance_query(
            provider_name=provider_name,
            model_name=model_name,
            query=original_question,
            chat_history=chat_history,
            n_last_interactions=n_last_interactions or config.DEFAULT_N_LAST_INTERACTIONS,
            max_context_rewrite_length=max_context_rewrite_length or config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH
        )

        logger.info(f"Query API: Final query passed to vector DB / RAG pipeline: '{enhanced_query}'")

        messages.append({"role": "user", "content": enhanced_query["enhanced_query"]})    
        for model in enhanced_query["usage"].keys():
            key = enhanced_query["usage"][model]["type"] + "_" + model
            if key not in usage.keys():
                usage[key] = enhanced_query["usage"][model]
            else:
                if "completion_tokens" in enhanced_query["usage"][model].keys():
                    usage[key]["completion_tokens"] += enhanced_query["usage"][model]["completion_tokens"] 
                if "prompt_tokens" in enhanced_query["usage"][model].keys():
                    usage[key]["prompt_tokens"] += enhanced_query["usage"][model]["prompt_tokens"]
                usage[key]["total_tokens"] += enhanced_query["usage"][model]["total_tokens"]

        filter_payload = {
            # "collection_id": collection_id,
            "sources": sources_files or [],
            "tenant_id": tenant_id,
            # "user_group_id": user_group_id
        }

        # Get relevant documents pipeline
        res_retrive = await self.retrieve(
            embedding=embedding,
            retrieval_settings=retrieval_settings,
            query=enhanced_query["enhanced_query"],
            top_k=top_k or config.DEFAULT_TOP_K,
            filter_payload=filter_payload
        )    
        for model in res_retrive["usage"].keys():
            key = res_retrive["usage"][model]["type"] + "_" + model
            if key not in usage.keys():
                usage[key] = res_retrive["usage"][model]
            else:
                if "completion_tokens" in res_retrive["usage"][model].keys():
                    usage[key]["completion_tokens"] += res_retrive["usage"][model]["completion_tokens"] 
                if "prompt_tokens" in res_retrive["usage"][model].keys():
                    usage[key]["prompt_tokens"] += res_retrive["usage"][model]["prompt_tokens"]
                usage[key]["total_tokens"] += res_retrive["usage"][model]["total_tokens"]
        relevant_docs = res_retrive["docs"]

        if relevant_docs:
            # Send info about found documents
            yield "data: " + json.dumps({
                "type": "info",
                "message": f"Found {len(relevant_docs)} relevant documents for query: "+ enhanced_query["enhanced_query"]
            }) + "\n\n"

            # Create augmented prompt
            augmented_prompt = self._create_augmented_prompt(enhanced_query["enhanced_query"], relevant_docs, qa_prompt, lang)
            messages[-1]["content"] = augmented_prompt

        # Apply LLM relevance scoring if requested
        relevance_scores = []
        threading_relevance_scores = None
        
        if use_llm_relevant_scoring and relevant_docs:
            def generate_relevance_scores(docs, query):
                for doc in docs:
                    prompt = f"""You are a RELEVANCE grader; providing the relevance of the given CONTEXT to the given QUESTION.
                    Respond only as a number from 0 to 10 where 0 is the least relevant and 10 is the most relevant.

                    A few additional scoring guidelines:

                    - Long CONTEXTS should score equally well as short CONTEXTS.

                    - RELEVANCE score should increase as the CONTEXTS provides more RELEVANT context to the QUESTION.

                    - RELEVANCE score should increase as the CONTEXTS provides RELEVANT context to more parts of the QUESTION.

                    - CONTEXT that is RELEVANT to some of the QUESTION should score of 2, 3 or 4. Higher score indicates more RELEVANCE.

                    - CONTEXT that is RELEVANT to most of the QUESTION should get a score of 5, 6, 7 or 8. Higher score indicates more RELEVANCE.

                    - CONTEXT that is RELEVANT to the entire QUESTION should get a score of 9 or 10. Higher score indicates more RELEVANCE.

                    - CONTEXT must be relevant and helpful for answering the entire QUESTION to get a score of 10.

                    - Never elaborate.

                    QUESTION: {query}
                    CONTEXT: {doc['content']}

                    Score:"""
                    llm_client_relevant = get_client(provider=retrieval_settings.llm_relevant_scoring.provider,
                                        api_key=retrieval_settings.llm_relevant_scoring.api_key, 
                                        project_id=retrieval_settings.llm_relevant_scoring.project_id, 
                                        region=retrieval_settings.llm_relevant_scoring.region, 
                                        application_credentials=retrieval_settings.llm_relevant_scoring.application_credentials,
                                        base_url=retrieval_settings.llm_relevant_scoring.base_url,
                                        api_version=retrieval_settings.llm_relevant_scoring.api_version)
                    response = llm_client_relevant.chat.completions.create(
                        model=f"{llm_relevant_scoring.provider}:{llm_relevant_scoring.model}" if llm_relevant_scoring.provider != "google" else f"{llm_relevant_scoring.provider}/{llm_relevant_scoring.model}",
                        messages=[{"role": "user", "content": prompt}],
                        stream=False
                    )
                    if f"relevant_{response.model}" not in usage.keys():
                        usage[f"relevant_{response.model}"] = {
                            "completion_tokens": response.usage.completion_tokens,
                            "prompt_tokens": response.usage.prompt_tokens,
                            "total_tokens": response.usage.total_tokens,
                            "type": "relevant",
                            "model_setting": model_name
                        }
                    else:
                        usage[f"relevant_{response.model}"]["completion_tokens"] += response.usage.completion_tokens
                        usage[f"relevant_{response.model}"]["prompt_tokens"] += response.usage.prompt_tokens
                        usage[f"relevant_{response.model}"]["total_tokens"] += response.usage.total_tokens
                    try:
                        score = float(response.choices[0].message.content.strip()) / 10.0
                        relevance_scores.append(score)
                    except Exception as e:
                        logger.warning(f"Error in relevance scoring: {e}")
                        logger.warning(f"Invalid score format from LLM: {response.choices[0].message.content}")
                        relevance_scores.append(0.0)

            threading_relevance_scores = threading.Thread(
                target=generate_relevance_scores,
                args=(relevant_docs, enhanced_query["enhanced_query"])
            )
            threading_relevance_scores.start()

        async for chunk in self.stream_completion(provider_name,model_name,llm_client,messages):
            if type(chunk) is str:
                yield "data: " + json.dumps({
                    "type": "token",
                    "content": chunk
                }) + "\n\n"
            else:                   
                if "chat_" + chunk["model"] not in usage.keys():
                    usage["chat_" + chunk["model"]] = {
                        "completion_tokens": chunk["completion_tokens"],
                        "prompt_tokens": chunk["prompt_tokens"],
                        "total_tokens": chunk["total_tokens"],
                        "type": "chat",
                        "model_setting": model_name
                    }
                else:
                    usage["chat_" + chunk["model"]]["completion_tokens"] += chunk["completion_tokens"]
                    usage["chat_" + chunk["model"]]["prompt_tokens"] += chunk["prompt_tokens"]
                    usage["chat_" + chunk["model"]]["total_tokens"] += chunk["total_tokens"]

        # Wait for relevance scoring to complete if it was started
        if threading_relevance_scores:
            threading_relevance_scores.join()
            # Send completion usage
            yield "data: " + json.dumps({"type": "usage", "data": usage}) + "\n\n"     
        else:            
            # Send completion usage
            yield "data: " + json.dumps({"type": "usage", "data": usage}) + "\n\n"     

        # Display sources
        if relevant_docs:
            if relevance_scores:
                # Sort documents and scores based on relevance score
                sorted_pairs = sorted(zip(relevant_docs, relevance_scores), key=lambda x: x[1], reverse=True)
                relevant_docs, relevance_scores = zip(*sorted_pairs)
                # Format documents for response with relevance scores
                sources = [
                    {
                        "content": doc["content"],
                        "source": doc["metadata"].get("source", "Unknown"),
                        "embedding_score": doc["embedding_score"],
                        "relevance_score": score,
                        "metadata": doc["metadata"]
                    } for doc, score in zip(relevant_docs, relevance_scores)
                ]
            else:
                sources = [
                    {
                        "content": doc["content"],
                        "source": doc["metadata"].get("source", "Unknown"),
                        "embedding_score": doc["embedding_score"],
                        "relevance_score": None,
                        "metadata": doc["metadata"]
                    } for doc in relevant_docs
                ]

            # Send sources information
            yield "data: " + json.dumps({"type": "sources", "data": sources}) + "\n\n"
        
        # Send completion message
        yield "data: " + json.dumps({"type": "done"}) + "\n\n"     

    async def stream_completion(
            self,
            provider_name: str,
            model_name: str,
            llm_client: ai.Client,
            messages: List[Dict[str, str]],
            callback: Optional[Callable[[str], None]] = None,
    ) -> AsyncGenerator[str, None]:
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
                model=f"{provider_name}:{model_name}" if provider_name != "google" else f"{provider_name}/{model_name}",
                messages=messages,
                stream=True,
                stream_options={
                    "include_usage": True
                }
            )

            collected_message = ""
            usage = {
                "model": model_name,
                "completion_tokens": 0,
                "prompt_tokens": 0,
                "total_tokens": 0
            }

            for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    if chunk.usage:
                        usage["model"] = chunk.model
                        usage["completion_tokens"] += chunk.usage.completion_tokens
                        usage["prompt_tokens"] += chunk.usage.prompt_tokens
                        usage["total_tokens"] += chunk.usage.total_tokens
                    content = chunk.choices[0].delta.content
                    if content:
                        collected_message += content
                        if callback:
                            callback(content)
                        yield content
                        await asyncio.sleep(0.01)
                else:
                    usage["model"] = chunk.model
                    usage["completion_tokens"] = chunk.usage.completion_tokens
                    usage["prompt_tokens"] = chunk.usage.prompt_tokens
                    usage["total_tokens"] = chunk.usage.total_tokens
            
            yield usage

        except asyncio.TimeoutError:
            raise TimeoutError()
        except Exception as e:
            logger.error(f"Error in stream_completion: {str(e)}")
            raise StreamGenerationError(str(e))
