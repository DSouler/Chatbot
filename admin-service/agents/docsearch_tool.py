from typing import List, Dict, Any, Optional
import logging

from models.requests import ReasoningSettings, RetrievalSettings
from reflection.engine import ReflectionEngine
from vectordb.engine import VectorDBEngine
from llms.engine import get_client
from langchain_qdrant import RetrievalMode
from langchain_openai import OpenAIEmbeddings
import config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
class DocSearchTool():
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new DocSearchTool instance")
            cls._instance = super(DocSearchTool, cls).__new__(cls)
        return cls._instance

    def __init__(
            self,
            vectordb_engine: VectorDBEngine,
    ):
        if not self._initialized:
            self.vectordb = vectordb_engine
            
            self.__class__._initialized = True
            logger.info("Initialized DocSearchTool")

    async def retrieve(self, retrieval_settings: RetrievalSettings, embedding: OpenAIEmbeddings, query: str, top_k: int = config.DEFAULT_TOP_K, filter_payload: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
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
            llm_relevant_scoring,
            prioritize_table
        )
        return docs
    
    async def _run_tool(self, 
                        original_question: str, 
                        chat_history: List[Dict[str, str]], 
                        n_last_interactions: int,
                        max_context_rewrite_length: int,
                        top_k: int,
                        tenant_id: str,
                        sources: List[str],
                        embedding: OpenAIEmbeddings,
                        retrieval_settings: RetrievalSettings, 
                        reasoning_settings: ReasoningSettings
                        ) -> str:
        try:
            provider_name = reasoning_settings.llm.provider
            model_name = reasoning_settings.llm.model

            llm_client = get_client(provider=provider_name,
                                        api_key=reasoning_settings.llm.api_key, 
                                        project_id=reasoning_settings.llm.project_id, 
                                        region=reasoning_settings.llm.region, 
                                        application_credentials=reasoning_settings.llm.application_credentials,
                                        base_url=reasoning_settings.llm.base_url,
                                        api_version=reasoning_settings.llm.api_version)
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
                "sources": sources or [],
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
            return {
                "success": True,
                "content": self.prepare_evidence(relevant_docs),
                "usage": usage,
                "sources": [{
                            "type": "docsearch",
                            "metadata": s.get("metadata", ""),
                            "content": s.get("content", "No content"),
                            "embedding_score": s.get("embedding_score", "No embedding_score")} for s in relevant_docs]
            }
                   
        except Exception as e:
            logger.error(f"docsearch query error: {str(e)}")
            return {
                "success": False,
                "error": f"Error querying docsearch: {str(e)}",
                "content": f"docsearch query failed: {str(e)}"
            }

    def prepare_evidence(self, docs, trim_len: int = 4000):
        evidence = ""
        for i, doc in enumerate(docs):
            evidence += (f"Doc {i+1}:" + doc["content"] + "\n\n")
        return evidence