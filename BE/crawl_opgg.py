from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

url = "https://op.gg/tft/meta-trends/comps"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=[
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
        ]
    )
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 720},
        locale="en-US",
    )
    page = context.new_page()
    page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(5000)
    html = page.content()
    browser.close()

soup = BeautifulSoup(html, "html.parser")
text = soup.get_text(separator=" ", strip=True)
print(text[:5000])
