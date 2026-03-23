import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from langchain_community.document_loaders import TextLoader, DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_qdrant import QdrantVectorStore, RetrievalMode, FastEmbedSparse
from langchain.docstore.document import Document
from langchain_docling import DoclingLoader
from langchain_openai import OpenAIEmbeddings
from qdrant_client.http import models as qdrant_models
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointIdsList, FilterSelector, Filter, FieldCondition, MatchValue, MatchAny, PointsSelector
from qdrant_client.http.exceptions import UnexpectedResponse
from models.exceptions import CollectionExistsError
from llms.engine import get_client

import config
import tiktoken

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VectorDBEngine:
    """
    Vector database engine for document storage and retrieval
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new VectorDBEngine instance")
            cls._instance = super(VectorDBEngine, cls).__new__(cls)
        return cls._instance

    def __init__(
            self,
            qdrant_host: str = config.QDRANT_HOST,
            qdrant_port: int = config.QDRANT_PORT,
            qdrant_collection_name: str = config.QDRANT_COLLECTION_NAME,
            qdrant_api_key: Optional[str] = config.QDRANT_API_KEY,
            chunk_size: int = config.CHUNK_SIZE,
            chunk_overlap: int = config.CHUNK_OVERLAP
    ):
        if not self._initialized:
            self.sparse_embeddings = FastEmbedSparse()

            # Store configuration
            self.chunk_size = chunk_size
            self.chunk_overlap = chunk_overlap

            # Initialize Qdrant client
            self.qdrant_client = QdrantClient(
                url=qdrant_host,
                port=qdrant_port,
                api_key=qdrant_api_key,
            )

            self.qdrant_collection_name = qdrant_collection_name

            self.__class__._initialized = True
            logger.info("VectorDBEngine initialized")

    def count_tokens(self, texts: List[Any], model_name: str = config.EMBEDDING_MODEL_NAME) -> int:
        encoding = tiktoken.encoding_for_model(model_name)
        return sum([len(e) for e in encoding.encode_batch(texts)])

    async def _check_collection_exists(self, collection_name: str) -> bool:
        """
        Check if a collection exists.
        
        Args:
            collection_name: Name of the collection to check.
            
        Returns:
            Boolean indicating if the collection exists.
            
        Raises:
            Exception: If there was an error checking for the collection.
        """
        try:
            await asyncio.to_thread(self.qdrant_client.get_collection, collection_name=collection_name)
            return True
        except UnexpectedResponse as e:
            if e.status_code == 404:
                return False
            logger.error(f"Unexpected response checking collection '{collection_name}': {e}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"Error checking collection '{collection_name}': {e}", exc_info=True)
            raise Exception(f"Could not check Qdrant collection '{collection_name}': {str(e)}")

    async def create_tenant_collection(self, tenant_id: str, embedding_model: str, embedding_dimension: int) -> Dict[str, Any]:
        """
        Explicitly creates a Qdrant collection for a given tenant_id if it doesn't exist.

        Args:
            tenant_id: The ID of the tenant.

        Returns:
            Dictionary with status, message, and collection_name.
        """
        collection_name = f"tenant_{tenant_id}"
        logger.info(f"Attempting to create or verify collection: {collection_name}")
            
        try:
            # Check if collection exists first
            exists = await self._check_collection_exists(collection_name)
            if exists:
                raise CollectionExistsError(f"Collection '{collection_name}' already exists.")
            
            # Create the collection since it doesn't exist
            await asyncio.to_thread(
                self.qdrant_client.create_collection,
                collection_name=collection_name,
                vectors_config={
                    embedding_model: qdrant_models.VectorParams(
                        size=embedding_dimension,
                        distance=qdrant_models.Distance.COSINE
                    )
                },
                sparse_vectors_config={
                    "sparse": qdrant_models.SparseVectorParams(
                        index=qdrant_models.SparseIndexParams(
                            on_disk=True
                        )
                    )
                }
            )
            
            logger.info(f"Successfully created collection: {collection_name}")
            return {
                "status": "created", 
                "message": f"Successfully created collection '{collection_name}'.",
                "collection_name": collection_name
            }
        
        except CollectionExistsError as e:
            logger.info(str(e))
            return {
                "status": "exists",
                "message": str(e),
                "collection_name": collection_name
            }
        except Exception as e:
            error_message = f"Failed to create collection '{collection_name}': {str(e)}"
            logger.error(error_message, exc_info=True)
            return {
                "status": "error",
                "message": error_message,
                "collection_name": collection_name
            }

    async def ingest_documents(self, embedding: OpenAIEmbeddings, file_paths: List[str], tenant_id: str, metadata_payload: Optional[Dict[str, Any]] = None, file_loader: Optional[str] = None) -> Dict[str, Any]:
        """
        Ingest documents from file paths into the vector store for a specific tenant.
        Assumes the collection for the tenant already exists.

        Args:
            file_paths: List of paths to the files to be ingested.
            tenant_id: The ID of the tenant whose collection to use.
            metadata_payload: Optional dictionary containing custom metadata.

        Returns:
            Dictionary with status information
        """
        # Run ingestion in a thread pool to avoid blocking the event loop
        return await asyncio.to_thread(self._ingest_documents_sync, embedding, file_paths, tenant_id, metadata_payload, file_loader)

    def _ingest_documents_sync(self, embedding: OpenAIEmbeddings, file_paths: List[str], tenant_id: str, metadata_payload: Optional[Dict[str, Any]] = None, file_loader: Optional[str] = None) -> Dict[str, Any]:
        """
        Synchronous implementation of document ingestion for multiple files.

        Args:
            file_paths: A list of paths to the files to be ingested.
            metadata_payload: Optional dictionary containing custom metadata to add
                              to each document chunk.

        Returns:
            A dictionary summarizing the ingestion results, including successful
            and failed files.
        """
        successful_files: List[Dict[str, Any]] = []
        failed_files: List[Dict[str, Any]] = []
        total_chunks_ingested = 0
        total_docs_processed = 0
        total_token = 0

        if tenant_id is None:
             return {
                 "status": "error",
                 "message": "tenant_id is required for ingestion.",
                 "details": { ... } # Empty details structure
            }

        collection_name = tenant_id
        logger.info(f"Attempting to ingest into existing collection: {collection_name}")

        try:
            self.qdrant_client.get_collection(collection_name=collection_name)
            logger.info(f"Verified collection '{collection_name}' exists.")
        except UnexpectedResponse as e:
            if e.status_code == 404:
                logger.error(f"Collection '{collection_name}' not found. Ingestion aborted. Please create it first.")
                return {
                    "status": "collection_not_found",
                    "message": f"Collection '{collection_name}' for tenant_id {tenant_id} does not exist. Please create it using the /add-tenant endpoint first.",
                    "details": {
                        "total_files_processed": 0,
                        "total_chunks_ingested": 0,
                        "successful_files": [],
                        "failed_files": [{"file_path": "N/A - Collection Check Failed", "error": f"Collection '{collection_name}' not found."}]
                    }
                }
            else:
                # Handle other Qdrant errors during the check
                logger.error(f"Error verifying collection '{collection_name}': {e}", exc_info=True)
                return { "status": "error", "message": f"Error verifying collection '{collection_name}': {e}", "details": { ... }}
        except Exception as e:
            # Handle potential connection errors etc.
            logger.error(f"Error connecting to Qdrant to verify collection '{collection_name}': {e}", exc_info=True)
            return { "status": "error", "message": f"Error connecting to Qdrant to verify collection '{collection_name}': {e}", "details": { ... }}

        try:
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=collection_name,
                embedding=embedding,
                sparse_embedding=self.sparse_embeddings,
                vector_name=embedding.model,
                sparse_vector_name="sparse"
            )
        except Exception as e:
            logger.error(f"Failed to initialize VectorStore for collection '{collection_name}': {e}", exc_info=True)
            return { "status": "error", "message": f"Failed to initialize VectorStore for collection '{collection_name}': {e}", "details": { ... }}

        for file_path, s3_key in zip(file_paths, metadata_payload["s3_keys"]):
            logger.info(f"Starting ingestion process for: {file_path}")
            loaded_documents = []

            # Check if path exists and is a file
            if not os.path.isfile(file_path):
                error_message = f"Path is not a file or {file_path} does not exist"
                logger.error(f"Ingestion failed for {file_path}: {error_message}")
                failed_files.append({"file_path": file_path, "error": error_message})
                continue

            # Determine file type and load the single document
            file_extension = os.path.splitext(file_path)[1].lower()
            try:
                if file_loader == "DoclingLoader":
                    loader = DoclingLoader(file_path)
                    loaded_documents = loader.load()
                else:
                    if file_extension == '.txt':
                        loader = TextLoader(file_path, encoding='utf-8')
                        loaded_documents = loader.load()
                    elif file_extension == '.pdf':
                        loader = PyPDFLoader(file_path)
                        loaded_documents = loader.load()
                    else:
                        error_message = f"Unsupported file type: {file_extension}. Only .txt and .pdf are supported."
                        logger.error(f"Ingestion failed for {file_path}: {error_message}")
                        failed_files.append({"file_path": file_path, "error": error_message})
                        continue

                if not loaded_documents:
                    warning_message = f"No content loaded from file: {file_path}. The file might be empty or unreadable."
                    logger.warning(warning_message)
                    # Decide if an empty file is a failure or just a warning to skip
                    failed_files.append({"file_path": file_path, "error": warning_message}) 
                    continue

            except Exception as e:
                error_message = f"Error loading file {file_path}: {e}"
                logger.error(f"Ingestion failed for {file_path}: {error_message}", exc_info=True)
                failed_files.append({"file_path": file_path, "error": str(e)})
                continue

            # --- Processing for the current successfully loaded file ---
            current_file_chunks_count = 0
            try:
                # Split documents into chunks
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap
                )
                chunks = text_splitter.split_documents(loaded_documents)
                chunk_texts = []

                if not chunks:
                    warning_message = f"No text chunks generated from file: {file_path}. Check file content and chunking parameters."
                    logger.warning(warning_message)
                    # Decide how to handle files that yield no chunks
                    failed_files.append({"file_path": file_path, "error": warning_message})
                    continue 

                # ADD METADATA INTEGRATION
                processed_chunks: List[Document] = []

                base_metadata = {
                    "tenant_id": tenant_id,
                    "embedding_model": embedding.model
                }

                if metadata_payload:
                    base_metadata.update(metadata_payload) 

                for chunk in chunks:
                    combined_metadata = chunk.metadata.copy()
                    if metadata_payload:
                        combined_metadata.update(base_metadata)

                    combined_metadata['sources'] = s3_key
                    
                    # Enhanced metadata for DoclingLoader
                    if "dl_meta" in chunk.metadata:
                        dl_meta = chunk.metadata["dl_meta"]
                        
                        # Extract and flatten important DoclingLoader metadata
                        if isinstance(dl_meta, dict):
                            # Add document-level metadata
                            combined_metadata.update({
                                "docling_schema": dl_meta.get("schema_name"),
                                "docling_version": dl_meta.get("version"),
                                "docling_origin": dl_meta.get("origin", {}),
                                "docling_headings": dl_meta.get("headings", [])
                            })
                            
                            # Extract document items information
                            doc_items = dl_meta.get("doc_items", [])
                            if doc_items:
                                combined_metadata["docling_item_types"] = list(set(
                                    item.get("label", "unknown") for item in doc_items
                                ))
                                
                                # Extract page information from first item's provenance
                                if doc_items and "prov" in doc_items[0]:
                                    prov = doc_items[0]["prov"]
                                    if prov and isinstance(prov, list) and len(prov) > 0:
                                        combined_metadata["page_label"] = str(prov[0].get("page_no"))
                                        if "bbox" in prov[0]:
                                            bbox = prov[0]["bbox"]
                                            combined_metadata["bbox"] = {
                                                "left": bbox.get("l"),
                                                "top": bbox.get("t"), 
                                                "right": bbox.get("r"),
                                                "bottom": bbox.get("b"),
                                                "coord_origin": bbox.get("coord_origin")
                                            }
                    
                    processed_chunks.append(
                        Document(page_content=chunk.page_content, metadata=combined_metadata)
                    )
                    chunk_texts.append(chunk.page_content)
                total_token += self.count_tokens(chunk_texts, embedding.model)

                if not processed_chunks:
                    error_message = f"Failed to generate processed document chunks from {file_path}"
                    logger.error(error_message)
                    failed_files.append({"file_path": file_path, "error": error_message})
                    continue

                # Add processed chunks with combined metadata to vector store
                vector_store.add_documents(processed_chunks)

                current_file_chunks_count = len(processed_chunks)
                total_chunks_ingested += current_file_chunks_count
                total_docs_processed += len(loaded_documents)

                logger.info(f"Successfully ingested {current_file_chunks_count} chunks from {file_path}")
                successful_files.append({
                    "file_path": file_path,
                    "documents_loaded": len(loaded_documents),
                    "chunks_added": current_file_chunks_count
                })

            except Exception as e:
                error_message = f"Failed during processing or adding chunks for {file_path} to collection '{collection_name}':{e}"
                logger.error(error_message, exc_info=True)
                failed_files.append({"file_path": file_path, "error": str(e)})

        # --- Construct final summary ---
        final_status = "success"
        if failed_files and successful_files:
            final_status = "partial_success"
        elif failed_files and not successful_files:
            final_status = "error"
        elif not failed_files and not successful_files and file_paths:
            final_status = "no_files_processed"
        elif not file_paths:
            final_status = "no_files_provided"


        message = f"Ingestion process completed. Successful: {len(successful_files)}, Failed: {len(failed_files)}, Total Chunks Added: {total_chunks_ingested}, Total token embedding: {total_token}"

        return {
            "status": final_status,
            "message": message,
            "details": {
                "total_files_processed": len(successful_files) + len(failed_files),
                "total_chunks_ingested": total_chunks_ingested,
                "successful_files": successful_files,
                "failed_files": failed_files,
                "total_embedding_tokens": total_token
            }
        }


    async def retrieve_relevant_documents(
            self, 
            query: str,
            embedding: OpenAIEmbeddings,
            retrieval_mode: RetrievalMode = RetrievalMode.DENSE,
            top_k: int = config.DEFAULT_TOP_K, 
            filter_payload: Optional[Dict[str, Any]] = None, 
            use_MMR: bool = False, 
            use_reranking: bool = False,
            prioritize_table: Optional[bool] = False
            ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents for a query

        Args:
            query: User query to retrieve documents for
            top_k: Number of documents to retrieve

        Returns:
            List of relevant documents with content and metadata
        """

        if not filter_payload or "tenant_id" not in filter_payload:
            raise ValueError("tenant_id is required in filter_payload for retrieval.")

        tenant_id = filter_payload["tenant_id"]
        collection_name = tenant_id

        vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            collection_name=collection_name,
            embedding=embedding,
            sparse_embedding=self.sparse_embeddings if 
            (retrieval_mode == RetrievalMode.HYBRID or retrieval_mode == RetrievalMode.SPARSE) 
            else None,
            retrieval_mode=retrieval_mode,
            sparse_vector_name="sparse",
            vector_name=embedding.model
        )


        sources = filter_payload["sources"]
        qdrant_filter = None
        
        if filter_payload:
            qdrant_filter = qdrant_models.Filter(
                should=[
                    qdrant_models.FieldCondition(
                        key="metadata.sources",
                        match=qdrant_models.MatchValue(value=source)
                    ) for source in sources
                ],
                must_not=[],
                must=[]
            )
            logger.info(f"Applying filter to retrieval: {filter_payload}")

        # if filter_payload:
        #     qdrant_filter = qdrant_models.Filter(
        #         must=[
        #             qdrant_models.FieldCondition(
        #                 key=f"metadata.{key}", # Qdrant filters on metadata fields like this
        #                 match=qdrant_models.MatchValue(value=value)
        #             ) for key, value in filter_payload.items()
        #         ]
        #     )
        #     logger.info(f"Applying filter to retrieval: {filter_payload}")

        if use_MMR:
            # Get embedding vector for the query
            query_embedding = await asyncio.to_thread(
                embedding.embed_query,
                query
            )

            docs = await asyncio.to_thread(
                vector_store.max_marginal_relevance_search_with_score_by_vector,
                query_embedding,
                k=top_k,
                fetch_k=top_k + 5,
                filter=qdrant_filter
            )
        else:
            docs = await asyncio.to_thread(
                vector_store.similarity_search_with_score,
                query,
                k=top_k,
                filter=qdrant_filter
            )

        results = []
        usage = {
            embedding.model: {
                "total_tokens": self.count_tokens(query, embedding.model),
                "type": "embedding",
                "model_setting": embedding.model
            }
        }

        if use_reranking:
            # Implement reranking with the provided LLMSettings
            if llm_reranking is None:
                logger.warning("Reranking requested but no LLM settings provided. Skipping reranking.")
            else:
                try:
                    # Create reranking prompts for each document
                    reranking_prompts = []
                    for doc, _ in docs:
                        prompt = f"""Given the following question and context,
                        return YES if the context is relevant to the question and NO if it isn't.

                        > Question: {query}
                        > Context:
                        >>>
                        {doc.page_content}
                        >>>
                        > Relevant (YES / NO):"""
                        reranking_prompts.append(prompt)

                    # Get relevance responses from LLM
                    relevance_responses = []
                    for prompt in reranking_prompts:
                        llm_client = get_client(provider=llm_reranking.provider,
                                        api_key=llm_reranking.api_key, 
                                        project_id=llm_reranking.project_id, 
                                        region=llm_reranking.region, 
                                        application_credentials=llm_reranking.application_credentials,
                                        base_url=llm_reranking.base_url,
                                        api_version=llm_reranking.api_version)
                        response = await asyncio.to_thread(
                            llm_client.chat.completions.create,
                            model=f"{llm_reranking.provider}:{llm_reranking.model}" if llm_reranking.provider != "google" else f"{llm_reranking.provider}/{llm_reranking.model}",
                            messages=[{"role": "user", "content": prompt}],
                            stream=False
                        )
                        relevance_responses.append(response.choices[0].message.content.strip().upper())
                        if response.model not in usage.keys():
                            usage[response.model] = {
                                "completion_tokens": response.usage.completion_tokens,
                                "prompt_tokens": response.usage.prompt_tokens,
                                "total_tokens": response.usage.total_tokens,
                                "type": "rerank",
                                "model_setting": llm_reranking.model
                            }
                        else:
                            usage[response.model]["completion_tokens"] += response.usage.completion_tokens
                            usage[response.model]["prompt_tokens"] += response.usage.prompt_tokens
                            usage[response.model]["total_tokens"] += response.usage.total_tokens

                    # Prepare documents for external scoring
                    scored_docs = list(zip(docs, relevance_responses))
                    # Filter out documents with NO responses and sort remaining by YES responses
                    scored_docs = [(doc, response) for doc, response in scored_docs if response == "YES"]
                    docs = [doc for doc, _ in scored_docs]

                except Exception as e:
                    logger.error(f"Error during reranking: {str(e)}")
                    logger.warning("Falling back to original document order")
        for doc_infor in docs:
            results.append({
                "content": doc_infor[0].page_content,
                "metadata": doc_infor[0].metadata,
                "embedding_score": doc_infor[1]
            })

        if prioritize_table:
            list_condition = []
            list_sources = []
            list_page_label = []
            list_page_label_str = []
            for doc_infor in docs:
                if "page_label" not in doc_infor[0].metadata.keys():
                    continue
                if not doc_infor[0].metadata["sources"] in list_sources:
                    list_sources.append(doc_infor[0].metadata["sources"])
                if doc_infor[0].metadata["page_label"] not in list_page_label:
                    list_page_label_str.append(str(doc_infor[0].metadata["page_label"]))
                    list_page_label.append(int(doc_infor[0].metadata["page_label"]))
            list_condition.append(qdrant_models.FieldCondition(
                    key="metadata.sources",
                    match=qdrant_models.MatchAny(any=list_sources)
                ))
            list_condition.append(qdrant_models.FieldCondition(
                    key="metadata.page_label",
                    match=qdrant_models.MatchAny(any=list_page_label)
                ))
            list_condition.append(qdrant_models.FieldCondition(
                    key="metadata.page_label",
                    match=qdrant_models.MatchAny(any=list_page_label_str)
                ))
            list_condition.append(qdrant_models.FieldCondition(
                    key="metadata.docling_item_types",
                    match=qdrant_models.MatchAny(any=["table"])
                ))
            qdrant_table_pages_filter = qdrant_models.Filter(
                should=[],
                must_not=[],
                must=list_condition
            )
            if use_MMR:
                # Get embedding vector for the query
                query_embedding = await asyncio.to_thread(
                    embedding.embed_query,
                    ""
                )

                docs_table = await asyncio.to_thread(
                    vector_store.max_marginal_relevance_search_with_score_by_vector,
                    query_embedding,
                    k=50,
                    fetch_k=55,
                    filter=qdrant_table_pages_filter
                )
            else:
                docs_table = await asyncio.to_thread(
                    vector_store.similarity_search_with_score,
                    "",
                    k=50,
                    filter=qdrant_table_pages_filter
                )
            for doc in docs_table:
                results.append({
                    "content": doc[0].page_content,
                    "metadata": doc[0].metadata,
                    "embedding_score": 0
                })

        return {
                "docs": results,
                "usage": usage
            }


    async def retrieve_documents_by_s3_key(self, tenant_id: str, object_key: str, embeddings: OpenAIEmbeddings) -> List[Dict[str, Any]]:
        collection_name = tenant_id

        vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            collection_name=collection_name,
            embedding=embeddings,
            sparse_embedding=self.sparse_embeddings,
            vector_name=embeddings.model,
            sparse_vector_name="sparse"
        )

        try:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key="metadata.sources",
                        match=MatchAny(any=[object_key])  # ✅ Wrap in list
                    )
                ]
            )
            
            docs = await asyncio.to_thread(
                vector_store.similarity_search,
                query="",  # Required dummy query
                k=10000,
                filter=qdrant_filter
            )
            
            results = []
            for doc in docs:
                results.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata
                })

            return results
        except Exception as e:
            error_message = f"Failed to get documents for S3 keys : {e}"
            logger.error(error_message, exc_info=True)
            return {
                "status": "error",
                "message": error_message
            }

    async def delete_documents(self, object_keys: List[str], tenant_id: str) -> Dict[str, Any]:
        """
        Deletes all vector points where metadata.s3_keys matches ANY of the provided S3 object keys.

        Args:
            object_keys: A list of exact S3 object keys stored in the 'metadata.s3_keys' field.
                         (Requires ingestion process to store 's3_keys' in metadata).
            tenant_id: The ID of the tenant whose documents should be deleted.

        Returns:
            A dictionary indicating the status of the overall delete operation.
        """
        
        if not object_keys:
            return {"status": "error", "message": "No S3 object keys provided for deletion."}

        if tenant_id is None:
            return {"status": "error", "message": "tenant_id is required for deletion."}
        
        
        metadata_field_to_filter = "sources" # The field storing the object key
        collection_name = tenant_id # Construct collection name
        
        logger.info(f"Attempting to delete documents from collection '{collection_name}' where metadata.{metadata_field_to_filter} is in: {object_keys}")

        try:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key=f"metadata.{metadata_field_to_filter}",
                        match=MatchAny(any=object_keys) 
                    )
                ]
            )

            delete_result = await asyncio.to_thread(
                self.qdrant_client.delete,
                collection_name=collection_name,
                points_selector=FilterSelector(filter=qdrant_filter) # Use FilterSelector
            )

            logger.info(f"Qdrant delete operation result for S3 keys '{object_keys}' in collection '{collection_name}': {delete_result}")

            # Check the overall operation status (same logic as before)
            if delete_result and (delete_result.status == qdrant_models.UpdateStatus.ACKNOWLEDGED or delete_result.status == qdrant_models.UpdateStatus.COMPLETED):
                message = f"Successfully submitted delete request for vectors matching S3 keys in metadata field '{metadata_field_to_filter}': {', '.join(object_keys)}. Deletion happens asynchronously."
                status = "success"
                logger.info(message)
            else:
                op_status = delete_result.status if delete_result else 'N/A'
                message = f"Delete request for vectors matching S3 keys '{', '.join(object_keys)}' acknowledged, but status was unexpected: {op_status}. Check Qdrant logs."
                status = "warning" 
                logger.warning(message)

            return {
                "status": status,
                "message": message,
                "keys_processed": object_keys # Indicate which keys were processed
            }

        except Exception as e:
            error_message = f"Failed to delete vectors for S3 keys '{', '.join(object_keys)}' from collection '{self.qdrant_collection_name}': {e}"
            logger.error(error_message, exc_info=True)
            return {
                "status": "error",
                "message": error_message,
                "keys_processed": object_keys
            }


    async def delete_documents_by_object_key(self, object_keys: List[str], tenant_id: str) -> Dict[str, Any]:
        """
        Deletes all vector points where metadata.s3_keys matches ANY of the provided S3 object keys.

        Args:
            object_keys: A list of exact S3 object keys stored in the 'metadata.s3_keys' field.
                         (Requires ingestion process to store 's3_keys' in metadata).
            tenant_id: The ID of the tenant whose documents should be deleted.

        Returns:
            A dictionary indicating the status of the overall delete operation.
        """

        if not object_keys:
            return {"status": "error", "message": "No S3 object keys provided for deletion."}

        if tenant_id is None:
            return {"status": "error", "message": "tenant_id is required for deletion."}
        
        metadata_field_to_filter = "s3_keys" # The field storing the object key
        collection_name = tenant_id # Construct collection name

        logger.info(f"Attempting to delete documents from collection '{collection_name}' where metadata.{metadata_field_to_filter} is in: {object_keys}")

        try:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key=f"metadata.{metadata_field_to_filter}",
                        match=MatchAny(any=object_keys) 
                    )
                ]
            )

            delete_result = await asyncio.to_thread(
                self.qdrant_client.delete,
                collection_name=collection_name,
                points_selector=FilterSelector(filter=qdrant_filter) # Use FilterSelector
            )

            logger.info(f"Qdrant delete operation result for S3 keys '{object_keys}' in collection '{collection_name}': {delete_result}")

            # Check the overall operation status (same logic as before)
            if delete_result and (delete_result.status == qdrant_models.UpdateStatus.ACKNOWLEDGED or delete_result.status == qdrant_models.UpdateStatus.COMPLETED):
                message = f"Successfully submitted delete request for vectors matching S3 keys in metadata field '{metadata_field_to_filter}': {', '.join(object_keys)}. Deletion happens asynchronously."
                status = "success"
                logger.info(message)
            else:
                op_status = delete_result.status if delete_result else 'N/A'
                message = f"Delete request for vectors matching S3 keys '{', '.join(object_keys)}' acknowledged, but status was unexpected: {op_status}. Check Qdrant logs."
                status = "warning" 
                logger.warning(message)

            return {
                "status": status,
                "message": message,
                "keys_processed": object_keys # Indicate which keys were processed
            }

        except Exception as e:
            error_message = f"Failed to delete vectors for S3 keys '{', '.join(object_keys)}' from collection '{self.qdrant_collection_name}': {e}"
            logger.error(error_message, exc_info=True)
            return {
                "status": "error",
                "message": error_message,
                "keys_processed": object_keys
            }