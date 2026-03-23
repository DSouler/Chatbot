import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class GoogleTool:
    """Free web search tool using DuckDuckGo (no API key required)"""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(GoogleTool, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        self.name = "web_search"
        self.description = "Search the web using DuckDuckGo. Input should be a search query."

    async def search(self, query: str, max_results: int = 3) -> Dict[str, Any]:
        """Search the web for information using DuckDuckGo (free, no API key)"""
        try:
            from duckduckgo_search import DDGS

            def _sync_search():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=max_results))

            results = await asyncio.to_thread(_sync_search)

            if not results:
                return {
                    "success": True,
                    "content": f"No results found for: '{query}'",
                    "sources": []
                }

            content_parts = []
            sources = []
            for i, result in enumerate(results, 1):
                title = result.get("title", "No title")
                link = result.get("href", "")
                snippet = result.get("body", "No snippet")

                content_parts.append(
                    f"Result {i}:\nTitle: {title}\nURL: {link}\nSnippet: {snippet}\n"
                )
                sources.append({
                    "type": "web_search",
                    "url": link,
                    "content": snippet,
                    "title": title
                })

            return {
                "success": True,
                "content": "\n".join(content_parts),
                "sources": sources
            }

        except Exception as e:
            logger.error(f"Web search error: {str(e)}")
            return {
                "success": False,
                "error": f"Error during web search: {str(e)}",
                "content": ""
            }
