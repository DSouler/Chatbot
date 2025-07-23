import logging
from typing import Dict, Any
from aisuite import Client

logger = logging.getLogger(__name__)


class LLMTool:
    """LLM query tool using aisuite"""
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new LLMTool instance")
            cls._instance = super(LLMTool, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        self.name = "llm"
        self.description = "A pretrained LLM like yourself. Useful when you need to act with general world knowledge and common sense. Prioritize it when you are confident in solving the problem yourself. Input can be any instruction."
    
    def query(self, question: str, provider: str, model: str, client: Client) -> Dict[str, Any]:
        """Query another LLM for analysis or reasoning"""
        try:         
            messages = [
                {
                    "role": "system", 
                    "content": "You are a helpful and knowledgeable assistant. Provide accurate, detailed, and well-reasoned responses. If you're unsure about something, acknowledge the uncertainty."
                },
                {
                    "role": "user",
                    "content": question
                }
            ]
            
            response = client.chat.completions.create(
                model=f"{provider}:{model}" if provider != "google" else f"{provider}/{model}",
                messages=messages,
                max_tokens=800,
                temperature=0.7,
                stream=False
            )
            content = response.choices[0].message.content
            
            return {
                "success": True,
                "content": content,
                "usage": {
                    "llmtool_" + response.model: {
                        "completion_tokens": response.usage.completion_tokens,
                        "prompt_tokens": response.usage.prompt_tokens,
                        "total_tokens": response.usage.total_tokens,
                        "type": "llmtool",
                        "model_setting": model
                    }
                }
            }
                   
        except Exception as e:
            logger.error(f"LLM query error: {str(e)}")
            return {
                "success": False,
                "error": f"Error querying LLM: {str(e)}",
                "content": f"LLM query failed: {str(e)}"
            }