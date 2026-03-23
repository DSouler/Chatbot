import openai
import config 

def get_client():
    """Initialize AI client for OpenAI or compatible providers (like local)"""
    
    api_key = config.LLM_API_KEY
    base_url = config.LLM_BASE_URL

    if not api_key:
        raise ValueError("Missing required API key for OpenAI client")

    return openai.OpenAI(api_key=api_key, base_url=base_url)
