import logging
import config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HyDEEngine:
    """
    Reflection module to improve user queries based on chat history context
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new HyDEEngine instance")
            cls._instance = super(HyDEEngine, cls).__new__(cls)
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

    def _create_hyde_documents(self,
                                     model_name: str,
                                     question: str) -> str:
        """Create HyDE documents for the original question

        Args:
            model_name: The name of the model to use
            llm_client: The LLM client to use for document creation
            original_question: The original question from the user

        Returns:
            The created HyDE documents as a string
        """
        prompt = config.DEFAULT_HYDE_PROMPT.format(question=question + " /no_think")
        # Call LLM to get HyDE documents
        try:
            response = self.llm_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=config.DEFAULT_TEMPERATURE,
            )
            hyDE_documents = response.choices[0].message.content.strip()
            logger.info(f"HyDE documents: '{hyDE_documents}'")
            return {
                "hyDE_documents": hyDE_documents
            }
        except Exception as e:
            logger.error(f"Error in creating HyDE documents: {str(e)}")
            return {
                "hyDE_documents": question
            }
