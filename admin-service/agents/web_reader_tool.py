import aiohttp
from bs4 import BeautifulSoup
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class WebReaderTool:
    """Tool to fetch and extract readable content from a given web URL."""
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new WebReaderTool instance")
            cls._instance = super(WebReaderTool, cls).__new__(cls)
        return cls._instance

    def __init__(self, max_length: int = 3000):
        self.max_length = max_length

    async def read_url(self, url: str) -> Dict[str, str]:
        try:
            clean_url = url.strip().strip('"').strip("'")

            async with aiohttp.ClientSession() as session:
                async with session.get(clean_url, timeout=10) as resp:
                    if resp.status != 200:
                        return {
                            "success": False,
                            "error": f"Failed to fetch page. Status code: {resp.status}",
                            "content": ""
                        }

                    html = await resp.text()
                    soup = BeautifulSoup(html, "html.parser")

                    body = soup.body
                    if not body:
                        return {
                            "success": False,
                            "error": "No <body> tag found in HTML.",
                            "content": ""
                        }

                    text = body.get_text(separator="\n", strip=True)
                    return {
                        "success": True,
                        "content": text[:self.max_length],
                        "sources": [{
                            "type": "webreader",
                            "url": url,
                            "content": text}]
                    }

        except Exception as e:
            logger.error(f'Web reading error for URL "{url}": {str(e)}')
            return {
                "success": False,
                "error": f"Error fetching URL content: {str(e)}",
                "content": ""
            }
