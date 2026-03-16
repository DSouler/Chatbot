import requests
from bs4 import BeautifulSoup
import json
import re

url = "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-16-6/"

print(f"Crawling data from: {url}")
print("-" * 80)

try:
    # Fetch the page
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    print(f"Status: {response.status_code}")
    print(f"Content length: {len(response.text)} bytes")
    print("-" * 80)

    # Parse HTML
    soup = BeautifulSoup(response.text, 'html.parser')

    # Extract title
    title = soup.find('h1')
    title_text = title.get_text(strip=True) if title else 'TFT Patch 16.6'

    # Extract all headings and content
    content = []

    # Find main content area
    article = soup.find('article') or soup.find('div', class_=re.compile('content|article|main'))

    if article:
        # Extract all text content
        for elem in article.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'strong']):
            text = elem.get_text(strip=True)
            if text and len(text) > 3:  # Skip very short text
                tag = elem.name
                if tag.startswith('h'):
                    content.append({
                        'type': 'heading',
                        'level': int(tag[1]),
                        'text': text
                    })
                elif tag == 'li':
                    content.append({
                        'type': 'list_item',
                        'text': text
                    })
                elif tag == 'p' or tag == 'strong':
                    content.append({
                        'type': 'paragraph',
                        'text': text
                    })
    else:
        text_content = soup.get_text(separator='\n', strip=True)
        content.append({
            'type': 'full_text',
            'text': text_content
        })

    # Save to JSON file
    output_json = "c:/Users/quan2/Downloads/chatbot/tft_patch_16_6.json"
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump({
            'url': url,
            'title': title_text,
            'content': content
        }, f, ensure_ascii=False, indent=2)

    # Save to TXT file (readable format)
    output_txt = "c:/Users/quan2/Downloads/chatbot/tft_patch_16_6.txt"
    with open(output_txt, 'w', encoding='utf-8') as f:
        f.write(f"TFT PATCH 16.6 - CRAWLED DATA\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Title: {title_text}\n")
        f.write(f"URL: {url}\n")
        f.write("=" * 80 + "\n\n")

        for item in content:
            if item['type'] == 'heading':
                f.write("\n" + "#" * item['level'] + " " + item['text'] + "\n\n")
            elif item['type'] == 'list_item':
                f.write("  - " + item['text'] + "\n")
            elif item['type'] == 'paragraph':
                f.write(item['text'] + "\n\n")

    print(f"\n[SUCCESS] Data saved to:")
    print(f"  - JSON: {output_json}")
    print(f"  - TXT: {output_txt}")
    print(f"Total items extracted: {len(content)}")

except requests.exceptions.RequestException as e:
    print(f"\n[ERROR] Request failed: {e}")
except Exception as e:
    print(f"\n[ERROR] {e}")
    import traceback
    traceback.print_exc()
