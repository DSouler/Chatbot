import aiohttp
import asyncio
import json
from bs4 import BeautifulSoup
import logging
from typing import Dict

logger = logging.getLogger(__name__)

# JS-heavy sites that require Playwright
JS_SITES = [
    "op.gg", "lolchess.gg", "tftactics.gg", "metasrc.com",
    "mobalytics.gg", "tactics.tools", "liquidlegends.net",
    "tftacademy.com",
]

# Context hints cho các site mà tier labels không có trong text
SITE_CONTEXT_HINTS = {
    "op.gg/tft": (
        "[GHI CHÚ: Trang op.gg hiển thị tier badge bằng CSS, KHÔNG phải text. "
        "Các đội hình được sắp xếp theo thứ tự: OP Tier (đầu tiên, Top 4 rate >70%, Avg. place <3.5), "
        "S Tier (tiếp theo, Top 4 rate 65-70%), A Tier (Top 4 rate 55-65%), B/C Tier (thấp hơn). "
        "Hãy xác định tier dựa trên Top 4 rate và Avg. place.]\n\n"
    ),
    "tftacademy.com": (
        "[GHI CHÚ: Trang tftacademy.com dùng SvelteKit (JS-rendered). "
        "Dữ liệu tier list được phân loại theo tier: S+, S, A, B, C bởi chuyên gia.]\n\n"
    ),
}


class WebReaderTool:
    """Fetch and extract readable text content from a web URL.
    Uses Playwright for JS-rendered pages, aiohttp for static pages."""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(WebReaderTool, cls).__new__(cls)
        return cls._instance

    def __init__(self, max_length: int = 6000):
        self.max_length = max_length

    def _needs_js(self, url: str) -> bool:
        return any(site in url for site in JS_SITES)

    def _extract_text(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        body = soup.body or soup
        text = body.get_text(separator="\n", strip=True)
        lines = [l for l in text.splitlines() if l.strip()]
        return "\n".join(lines)[:self.max_length]

    def _extract_next_data(self, html: str) -> str:
        """Extract Next.js __NEXT_DATA__ structured JSON for accurate data."""
        try:
            soup = BeautifulSoup(html, "html.parser")
            el = soup.find("script", {"id": "__NEXT_DATA__"})
            if not el or not el.string:
                return ""
            data = json.loads(el.string)
            page_props = data.get("props", {}).get("pageProps", {})
            if not page_props:
                return ""
            # Find arrays that look like game comp/tier data
            useful = self._find_data_arrays(page_props)
            if useful:
                lines = []
                for item in useful:
                    lines.append(json.dumps(item, ensure_ascii=False))
                return "\n".join(lines)
            return ""
        except Exception as e:
            logger.warning(f"__NEXT_DATA__ extraction failed: {e}")
            return ""

    def _find_data_arrays(self, obj, depth=0):
        """Recursively search for arrays with game-relevant keys."""
        if depth > 8:
            return []
        interesting_keys = {
            'tier', 'win_rate', 'avg_placement', 'top_4_rate',
            'champions', 'comps', 'placement', 'pickRate', 'winRate',
            'rank', 'top4Rate', 'firstRate', 'avgPlace'
        }
        if isinstance(obj, list) and len(obj) >= 2:
            if obj and isinstance(obj[0], dict):
                if set(obj[0].keys()) & interesting_keys:
                    return obj
        if isinstance(obj, dict):
            for v in obj.values():
                result = self._find_data_arrays(v, depth + 1)
                if result:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict):
                    result = self._find_data_arrays(item, depth + 1)
                    if result:
                        return result
        return []

    async def _fetch_with_playwright(self, url: str) -> Dict:
        """Run Playwright in a dedicated thread to avoid Windows ProactorEventLoop subprocess issue."""
        return await asyncio.to_thread(self._run_playwright_sync, url)

    def _run_playwright_sync(self, url: str) -> Dict:
        """Synchronous Playwright runner — called from thread pool so it gets its own event loop."""
        import asyncio as _asyncio
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._playwright_inner(url))
        finally:
            loop.close()

    async def _playwright_inner(self, url: str) -> Dict:
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--headless=new",
                    ]
                )
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 720},
                    locale="en-US",
                    java_script_enabled=True,
                )
                page = await context.new_page()
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
                await page.goto(url, wait_until="load", timeout=30000)
                await page.wait_for_timeout(6000)

                html = await page.content()

                # 1) Thử __NEXT_DATA__ trước (Next.js sites như op.gg, lolchess.gg)
                next_data_text = self._extract_next_data(html)
                if next_data_text.strip():
                    await context.close()
                    await browser.close()
                    logger.info(f"Extracted via __NEXT_DATA__ for {url}")
                    return {"success": True, "content": next_data_text[:self.max_length]}

                # 2) Dùng inner_text() — text hiển thị thật sự trên trang
                try:
                    text = await page.inner_text("body")
                    text = "\n".join(l.strip() for l in text.splitlines() if l.strip())
                except Exception:
                    text = self._extract_text(html)

                await context.close()
                await browser.close()
                if not text.strip():
                    return {"success": False, "error": "Page rendered but no text found.", "content": ""}
                return {"success": True, "content": text[:self.max_length]}
        except Exception as e:
            logger.error(f"Playwright error for {url}: {e}")
            return {"success": False, "error": str(e), "content": ""}

    async def _fetch_with_aiohttp(self, url: str) -> Dict:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return {"success": False, "error": f"HTTP {resp.status}", "content": ""}
                    html = await resp.text()
                    text = self._extract_text(html)
                    if not text.strip():
                        return {"success": False, "error": "No content extracted.", "content": ""}
                    return {"success": True, "content": text}
        except Exception as e:
            logger.error(f"aiohttp error for {url}: {e}")
            return {"success": False, "error": str(e), "content": ""}

    async def read_url(self, url: str) -> Dict:
        clean_url = url.strip().strip('"').strip("'")
        if self._needs_js(clean_url):
            logger.info(f"Using Playwright for JS-site: {clean_url}")
            result = await self._fetch_with_playwright(clean_url)
        else:
            result = await self._fetch_with_aiohttp(clean_url)
            # Fallback to Playwright if aiohttp got no content
            if not result.get("success") or not result.get("content", "").strip():
                logger.info(f"Falling back to Playwright for: {clean_url}")
                result = await self._fetch_with_playwright(clean_url)

        # Prepend site-specific context hints so LLM can interpret the content correctly
        if result.get("success") and result.get("content"):
            for site_key, hint in SITE_CONTEXT_HINTS.items():
                if site_key in clean_url:
                    result["content"] = hint + result["content"]
                    break

        return result
