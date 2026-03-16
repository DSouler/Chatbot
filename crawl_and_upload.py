# -*- coding: utf-8 -*-
"""
Crawl TFT Patch 16.6 và upload lên Qdrant qua BE API
"""
import sys
import io
import requests
from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

URL = "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-16-6/"
BE_URL = "http://localhost:8000"
OUTPUT_FILE = "c:/Users/quan2/Downloads/chatbot/tft_patch_16_6_full.txt"

# =====================
# STEP 1: CRAWL DATA
# =====================
print("=" * 60)
print("STEP 1: Crawling data...")
print(f"URL: {URL}")
print("=" * 60)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}

response = requests.get(URL, headers=headers, timeout=30)
print(f"Status: {response.status_code}")

if response.status_code != 200:
    print(f"[FAILED] Cannot fetch URL")
    sys.exit(1)

soup = BeautifulSoup(response.text, "html.parser")

# Remove unwanted tags
for tag in soup.find_all(["script", "style", "nav", "header", "footer", "iframe", "noscript"]):
    tag.decompose()

# Extract title
title_tag = soup.find("h1")
title = title_tag.get_text(strip=True) if title_tag else "TFT Patch 16.6"

# Extract all paragraphs, headings, lists in article content
content_lines = []
content_lines.append(f"# {title}")
content_lines.append(f"Nguồn: {URL}")
content_lines.append("")

# Strategy: find main article/content area
article = (
    soup.find("article") or
    soup.find("main") or
    soup.find("div", {"class": lambda c: c and any(x in c for x in ["article", "content", "patch", "post"])}) or
    soup.find("body")
)

if article:
    current_section = []

    for el in article.find_all(["h1", "h2", "h3", "h4", "h5", "p", "li", "ul", "ol", "table", "tr", "td", "th"]):
        text = el.get_text(strip=True)
        if not text or len(text) < 2:
            continue

        tag = el.name
        if tag in ["h1", "h2"]:
            content_lines.append(f"\n## {text}")
        elif tag in ["h3", "h4", "h5"]:
            content_lines.append(f"\n### {text}")
        elif tag == "p":
            content_lines.append(text)
        elif tag == "li":
            content_lines.append(f"- {text}")
        elif tag in ["td", "th"]:
            content_lines.append(f"| {text} |")

# Write to file
full_text = "\n".join(content_lines)

# Clean up duplicate empty lines
import re
full_text = re.sub(r'\n{3,}', '\n\n', full_text)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write(full_text)

print(f"[OK] Content saved: {len(full_text)} characters")
print(f"     Lines: {len(content_lines)}")
print(f"     File: {OUTPUT_FILE}")

# =====================
# STEP 2: CHECK QDRANT
# =====================
print("")
print("=" * 60)
print("STEP 2: Checking Qdrant / BE...")
print("=" * 60)

try:
    r = requests.get(f"{BE_URL}/docs", timeout=5)
    print(f"BE status: {r.status_code}")
except Exception as e:
    print(f"[ERROR] BE not reachable: {e}")
    sys.exit(1)

# =====================
# STEP 3: UPLOAD
# =====================
print("")
print("=" * 60)
print("STEP 3: Uploading to Qdrant via BE...")
print("=" * 60)

with open(OUTPUT_FILE, "rb") as f:
    files = {"file": ("tft_patch_16_6.txt", f, "text/plain")}
    upload_resp = requests.post(f"{BE_URL}/upload", files=files, timeout=120)

if upload_resp.status_code == 200:
    result = upload_resp.json()
    print(f"[SUCCESS] Upload completed!")
    print(f"  Filename     : {result.get('filename')}")
    print(f"  Chunks indexed: {result.get('chunks_uploaded')}")
    print(f"  Status       : {result.get('status')}")
else:
    print(f"[FAILED] Upload failed: {upload_resp.status_code}")
    print(upload_resp.text)
