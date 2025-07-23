import logging
import asyncio
from typing import List, Dict
import config
import json
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReWriteEngine:
    """
    Reflection module to improve user queries based on chat history context
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new ReWriteEngine instance")
            cls._instance = super(ReWriteEngine, cls).__new__(cls)
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

    async def _create_subqueries(self,
                            provider_name: str,
                            model_name: str,
                            query: str,
                            max_context_rewrite_length: int = config.DEFAULT_MAX_CONTENT_REWRITE_LENGTH,
                            decompose_prompt: str = config.DEFAULT_DECOMPOSE_PROMPT
                            ) -> List[str]:
        """Decompose user complex question into multiple sub-questions

        Args:
        llm: the language model to rewrite question
        lang: the language of the answer. Currently support English and Japanese
    """
        required_placeholders = ['{max_context_rewrite_length}', '{query}']
        if decompose_prompt and not all(placeholder in decompose_prompt for placeholder in required_placeholders):
            logger.warning(f"decompose_prompt missing required placeholders. Required: {required_placeholders}")
            decompose_prompt = None
        

        if decompose_prompt:
            decompose_prompt = decompose_prompt.format(
                query=query,
                max_context_rewrite_length=max_context_rewrite_length
            )
        else:
            decompose_prompt = config.DEFAULT_DECOMPOSE_PROMPT.format(
                query=query,
                max_context_rewrite_length=max_context_rewrite_length
            )

        logger.info(f"Generating subqueries for: '{query}'")
        try:
            # Call LLM to get enhanced query
            response = await asyncio.to_thread(
                self.llm_client.chat.completions.create,
                model=f"{provider_name}:{model_name}" if provider_name != "google" else f"{provider_name}/{model_name}",
                messages=[{"role": "user", "content": decompose_prompt}],
                stream=False
            )

            sub_queries = response.choices[0].message.content.strip()
            sub_queries_list = json.loads(sub_queries)
            logger.info(f"Sub-queries: '{sub_queries}'")
            return {
                "sub_queries_list": sub_queries_list,
                "usage": {
                    response.model: {
                        "completion_tokens": response.usage.completion_tokens,
                        "prompt_tokens": response.usage.prompt_tokens,
                        "total_tokens": response.usage.total_tokens,
                        "type": "rewrite",
                        "model_setting": model_name
                    }
                }
            }

        except Exception as e:
            logger.error(f"Error in creating sub-queries: {str(e)}")
            # Return original query if enhancement fails
            return {
                "sub_queries_list": [],
                "usage": {}
            }