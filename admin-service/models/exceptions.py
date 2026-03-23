class LLMRequestError(Exception):
    """Exception raised for errors during LLM requests."""
    def __init__(self, message="Error occurred during LLM request"):
        self.message = message
        super().__init__(self.message)

class StreamGenerationError(Exception):
    """Exception raised for errors during stream generation."""
    def __init__(self, message="Error occurred during stream generation"):
        self.message = message
        super().__init__(self.message)

class TimeoutError(Exception):
    """Exception raised when a request times out."""
    def __init__(self, message="Request timed out"):
        self.message = message
        super().__init__(self.message)

class CollectionExistsError(Exception):
    """Exception raised when a collection already exists."""
    def __init__(self, message: str, collection_name: str = None):
        super().__init__(message)
        self.collection_name = collection_name