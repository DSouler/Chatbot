# config.py
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# LLM Base URL Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://10.1.12.104:8001/v1")

# Qdrant Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "10.1.12.165")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "tài liệu TFT")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)

# Backend Base URL (used for serving item images in chat responses)
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8096")

# Application Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "AITeamVN/Vietnamese_Embedding_v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1024"))

# Prompts
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")


def _load_prompt(filename: str) -> str:
    prompt_path = os.path.join(PROMPTS_DIR, filename)
    with open(prompt_path, "r", encoding="utf-8") as prompt_file:
        return prompt_file.read().strip()


def compose_system_prompt(parent_prompt: str, branch_prompt: str = "") -> str:
    """Always put full parent system prompt first, then branch-specific rules."""
    if not branch_prompt:
        return parent_prompt.strip()
    return f"{parent_prompt.strip()}\n\n[RẼ NHÁNH]\n{branch_prompt.strip()}"


SYS_PROMPT = _load_prompt("artifact")
WEB_SEARCH_SYS_PROMPT_BRANCH = _load_prompt("web_search_sys_prompt.txt")
WEB_SEARCH_QA_PROMPT = _load_prompt("web_search_qa_prompt.txt")
QA_PROMPT = _load_prompt("qa_prompt.txt")
HYDE_PROMPT = _load_prompt("hyde_prompt.txt")

LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")
DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL_NAME", "Qwen/Qwen3-14B-AWQ")

# Web Search Configuration (DuckDuckGo - free, no API key required)
WEB_SEARCH_MAX_RESULTS = int(os.getenv("WEB_SEARCH_MAX_RESULTS", "3"))
WEB_READER_MAX_LENGTH = int(os.getenv("WEB_READER_MAX_LENGTH", "20000"))
DEFAULT_SYSTEM_PROMPT = os.getenv("DEFAULT_SYSTEM_PROMPT", SYS_PROMPT)
DEFAULT_WEB_SEARCH_SYSTEM_PROMPT = compose_system_prompt(
    DEFAULT_SYSTEM_PROMPT,
    os.getenv("DEFAULT_WEB_SEARCH_SYSTEM_PROMPT", WEB_SEARCH_SYS_PROMPT_BRANCH)
)
DEFAULT_WEB_SEARCH_QA_PROMPT = os.getenv("DEFAULT_WEB_SEARCH_QA_PROMPT", WEB_SEARCH_QA_PROMPT)
DEFAULT_QA_PROMPT = os.getenv("DEFAULT_QA_PROMPT", QA_PROMPT)
DEFAULT_TEMPERATURE = float(os.getenv("DEFAULT_TEMPERATURE", "0.2"))
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", "35"))
DEFAULT_REQUEST_TIMEOUT = int(os.getenv("DEFAULT_REQUEST_TIMEOUT", "120"))
DEFAULT_N_LAST_INTERACTIONS = int(os.getenv("DEFAULT_N_LAST_INTERACTIONS", "5"))
DEFAULT_MAX_CONTENT_REWRITE_LENGTH = int(os.getenv("DEFAULT_MAX_CONTENT_REWRITE_LENGTH", "150"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "Vietnamese")
DEFAULT_HYDE_PROMPT = os.getenv("DEFAULT_HYDE_PROMPT", HYDE_PROMPT)

COMP_EVAL_PROMPT_BRANCH = _load_prompt("comp_eval_prompt.txt")
COMP_EVAL_WITH_IMAGE_PROMPT_BRANCH = _load_prompt("comp_eval_with_image_prompt.txt")
COMP_EVAL_IMAGE_ONLY_PROMPT_BRANCH = _load_prompt("comp_eval_image_only_prompt.txt")

COMP_EVAL_PROMPT = compose_system_prompt(DEFAULT_SYSTEM_PROMPT, COMP_EVAL_PROMPT_BRANCH)
COMP_EVAL_WITH_IMAGE_PROMPT = compose_system_prompt(DEFAULT_SYSTEM_PROMPT, COMP_EVAL_WITH_IMAGE_PROMPT_BRANCH)
COMP_EVAL_IMAGE_ONLY_PROMPT = compose_system_prompt(DEFAULT_SYSTEM_PROMPT, COMP_EVAL_IMAGE_ONLY_PROMPT_BRANCH)

# ====== TFT Meta Crawl Config ======
TFT_META_CACHE_TTL = int(os.getenv("TFT_META_CACHE_TTL", "1800"))  # 30 minutes

TFT_META_SYS_PROMPT_BRANCH = _load_prompt("tft_meta_sys_prompt.txt")
TFT_META_QA_PROMPT = _load_prompt("tft_meta_qa_prompt.txt")
TFT_META_SYS_PROMPT = compose_system_prompt(DEFAULT_SYSTEM_PROMPT, TFT_META_SYS_PROMPT_BRANCH)
