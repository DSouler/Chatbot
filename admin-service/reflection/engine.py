import logging
import asyncio
from typing import List, Dict
import config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReflectionEngine:
    """
    Reflection module to improve user queries based on chat history context
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new ReflectionEngine instance")
            cls._instance = super(ReflectionEngine, cls).__new__(cls)
        return cls._instance

    def __init__(
            self,
            llm_client
        ):
        """
        Initialize the reflection engine with LLM client

        Args:
            llm_client: OpenAI client to use for reflection
        """
        self.llm_client = llm_client
        if not self._initialized:
            self.__class__._initialized = True
            logger.info("Initialized Reflection Engine")

    def _format_chat_history(self, chat_history: List[Dict[str, str]]) -> str:
        """
        Format chat history into a string representation

        Args:
            chat_history: List of chat message dictionaries

        Returns:
            Formatted string representation of chat history
        """
        formatted_history = []
        for message in chat_history:
            role = message.get('role', '').capitalize()
            content = message.get('content', '')
            if role and content:
                formatted_history.append(f"{role}: {content}")

        return "\n\n".join(formatted_history)
    

    async def enhance_query(self,
                            provider_name: str,
                            model_name: str,
                            query: str,
                            chat_history: List[Dict[str, str]],
                            n_last_interactions: int = config.DEFAULT_N_LAST_INTERACTIONS,
                            max_context_rewrite_length: int = config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH,
                            ) -> str:
        """
        Enhance the user query using chat history context

        Args:
            query: Original user query
            chat_history: Previous conversation messages
            n_last_interactions: Maximum number of history items to consider
            max_context_rewrite_length: Maximum message length for context rewriting

        Returns:
            Enhanced query that incorporates chat history context
        """
        # If no chat history, return the original query
        if not chat_history or len(chat_history) == 0:
            logger.info("No chat history available, using original query")
            return {
                "enhanced_query": query,
                "usage": {}
            }
        
        # Limit history to most recent items
        if len(chat_history) > n_last_interactions:
            logger.info(f"Limiting chat history to last {n_last_interactions} items")
            chat_history = chat_history[-n_last_interactions:]

        # Format the chat history
        formatted_history = self._format_chat_history(chat_history)
        current_query = f"User's latest query: {query}"

        if len(current_query) <= max_context_rewrite_length:
            # Reflection prompt without summary
            reflection_prompt = f"""
            You are a helpful AI assistant that improves search queries based on conversation context.
            Given the following conversation history and the user's latest query, your task is to:
            1. Analyze what information the user is seeking in their latest query
            2. Consider any relevant context from the conversation history
            3. Generate an improved, standalone search query that:
               - Captures the user's original intent
               - Includes important contextual information from the conversation history
               - Is specific and precise enough to retrieve relevant documents
               - Does NOT answer the question, only reformulate it to be more effective for search
            
            IMPORTANT: The improved query should be a single query that stands on its own without requiring the conversation history. Output ONLY the improved query with no additional explanation, prefixes, or formatting.
            
            --- Conversation History ---
            {formatted_history}
            
            --- Current Query ---
            {current_query}
            
            Improved query:
            """
        else:
            # Reflection prompt with summary
            reflection_prompt = f"""
            You are an expert AI assistant tasked with refining user queries for a retrieval system, based on conversation history.
            The user's current query might be too long and needs to be both summarized and optimized using context.
        
            Given the conversation history and the user's current query:
            1. Identify the core intent of the user's current query.
            2. Incorporate essential context from the conversation history to make the query standalone and clear.
            3. Summarize and rephrase the query to be concise and highly effective for information retrieval.
            4. CRITICAL: The final improved query MUST be less than {max_context_rewrite_length} characters long.
            5. Do NOT answer the question. Only output the refined query.
        
                IMPORTANT: Output ONLY the improved and summarized query. No explanations, prefixes, or formatting.
        
                --- Conversation History ---
                {formatted_history}
        
                --- Current (Potentially Long) Query ---
                User's latest query: {current_query}
        
                Improved and Summarized Query (less than {max_context_rewrite_length} characters):
            """

        logger.info(f"Generating enhanced query for: '{query}'")
        try:
            # Call LLM to get enhanced query
            response = await asyncio.to_thread(
                self.llm_client.chat.completions.create,
                model=f"{provider_name}:{model_name}" if provider_name != "google" else f"{provider_name}/{model_name}",
                messages=[{"role": "user", "content": reflection_prompt}],
                stream=False
            )

            enhanced_query = response.choices[0].message.content.strip()
            logger.info(f"Enhanced query: '{enhanced_query}'")
            
            return {
                "enhanced_query": enhanced_query,
                "usage": {
                    response.model: {
                        "completion_tokens": response.usage.completion_tokens,
                        "prompt_tokens": response.usage.prompt_tokens,
                        "total_tokens": response.usage.total_tokens,
                        "type": "reflec",
                        "model_setting": model_name
                    }
                }
            }

        except Exception as e:
            logger.error(f"Error in query enhancement: {str(e)}")
            # Return original query if enhancement fails
            return {
                "enhanced_query": query,
                "usage": {}
            }
