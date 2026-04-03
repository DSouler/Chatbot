"""
Crawler cho op.gg/vi/tft/meta-trends/item
- Lấy ảnh trang bị thành phần (component items) + trang bị ghép (combined items)
- Lấy thông tin tướng dùng tốt từng trang bị (top champions)
- Lưu ảnh vào champion_images/, data vào data/opgg_items_meta.json

Chạy:  python -m agents.opgg_item_scraper
"""
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "champion_images"
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

URL = "https://op.gg/vi/tft/meta-trends/item"


async def _download_image(session: aiohttp.ClientSession, url: str, save_path: Path) -> bool:
    """Download an image from URL and save to disk."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                logger.warning(f"HTTP {resp.status} for {url}")
                return False
            data = await resp.read()
            with open(save_path, "wb") as f:
                f.write(data)
            logger.info(f"Saved: {save_path.name}")
            return True
    except Exception as e:
        logger.warning(f"Failed to download {url}: {e}")
        return False


def _safe_filename(name: str) -> str:
    """Convert Vietnamese item name to safe filename."""
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', '_', name).strip('_')
    return f"item_{name}"


async def _scrape_with_playwright() -> Dict:
    """Use Playwright to scrape op.gg item page, extract images + data."""
    from playwright.async_api import async_playwright

    items = []
    image_urls = {}  # item_name -> image_url

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="vi-VN",
        )
        page = await context.new_page()
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        print("[1/4] Navigating to op.gg item page...")
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(5000)

        # Scroll to load all items (lazy loading)
        print("[2/4] Scrolling to load all items...")
        prev_count = 0
        for _ in range(20):
            await page.evaluate("window.scrollBy(0, 1000)")
            await page.wait_for_timeout(500)
            rows = await page.query_selector_all("tr")
            if len(rows) == prev_count:
                break
            prev_count = len(rows)

        # Try extracting from table rows
        print("[3/4] Extracting item data...")

        # Each item row in the table has: rank, item image+name, avg place, top4, pick rate, games, champions
        # Select the main item rows (not the expanded champion sub-rows)
        item_rows = await page.evaluate("""() => {
            const results = [];
            // Find the main table body
            const tables = document.querySelectorAll('table');
            if (!tables.length) return results;

            const table = tables[tables.length - 1]; // Last table is usually the data table
            const rows = table.querySelectorAll('tbody > tr');

            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 4) continue;

                // Check if this is a main item row (has rank number in first cell)
                const rankText = cells[0]?.innerText?.trim();
                if (!rankText || isNaN(parseInt(rankText))) continue;

                // Item name and image
                const itemCell = cells[1];
                if (!itemCell) continue;

                const itemImg = itemCell.querySelector('img');
                const itemName = itemCell.innerText?.trim()?.split('\\n')[0]?.trim();
                const itemImgSrc = itemImg ? itemImg.src : '';

                // Also find component item images (recipe)
                const recipeImgs = [];
                const recipeContainer = itemCell.querySelectorAll('img');
                for (const img of recipeContainer) {
                    if (img.src && img.src !== itemImgSrc) {
                        recipeImgs.push(img.src);
                    }
                }

                // Stats - parse from remaining cells
                const statsText = row.innerText;

                // Champion images and names
                const champImgs = [];
                const champNames = [];
                const lastCell = cells[cells.length - 1];
                if (lastCell) {
                    const champElements = lastCell.querySelectorAll('img');
                    for (const img of champElements) {
                        champImgs.push(img.src || '');
                        champNames.push(img.alt || '');
                    }
                    // Also try text
                    if (!champNames.length) {
                        const text = lastCell.innerText?.trim();
                        if (text) {
                            champNames.push(...text.split(/[\\n,]+/).map(s => s.trim()).filter(Boolean));
                        }
                    }
                }

                results.push({
                    rank: parseInt(rankText),
                    name: itemName,
                    image: itemImgSrc,
                    recipe_images: recipeImgs,
                    stats_raw: statsText,
                    champion_names: champNames,
                    champion_images: champImgs,
                });
            }
            return results;
        }""")

        if not item_rows:
            # Fallback: try a different selector strategy
            print("   Table extraction failed, trying alternative strategy...")
            item_rows = await page.evaluate("""() => {
                const results = [];
                // Try finding item containers by common class patterns
                const allRows = document.querySelectorAll('[class*="css"]');
                // Fallback: get all text and images
                const body = document.body.innerText;
                return [{name: '__raw__', stats_raw: body, rank: 0, image: '', recipe_images: [], champion_names: [], champion_images: []}];
            }""")

        # Now also extract ALL item images from the page
        all_images = await page.evaluate("""() => {
            const imgs = [];
            document.querySelectorAll('img').forEach(img => {
                if (img.src && (img.src.includes('item') || img.src.includes('Item') ||
                    img.src.includes('tft') || img.src.includes('champion'))) {
                    imgs.push({
                        src: img.src,
                        alt: img.alt || '',
                        width: img.naturalWidth || img.width,
                        height: img.naturalHeight || img.height,
                    });
                }
            });
            return imgs;
        }""")

        print(f"   Found {len(item_rows)} item rows, {len(all_images)} images")

        await context.close()
        await browser.close()

    return {
        "item_rows": item_rows,
        "all_images": all_images,
    }


def _parse_stats(stats_raw: str) -> Dict:
    """Parse stats from raw row text."""
    result = {}
    # Avg place: #4.18
    m = re.search(r'#(\d+\.\d+)', stats_raw)
    if m:
        result["avg_place"] = float(m.group(1))

    # Percentages: first is top4, second is pick rate (or similar)
    pcts = re.findall(r'(\d+\.\d+)%', stats_raw)
    if len(pcts) >= 2:
        result["top4_rate"] = float(pcts[0])
        result["pick_rate"] = float(pcts[1])
    elif len(pcts) == 1:
        result["top4_rate"] = float(pcts[0])

    # Games played: large number with commas
    games = re.findall(r'([\d,]+\d{3})', stats_raw)
    if games:
        result["games"] = int(games[0].replace(',', ''))

    return result


async def crawl_opgg_items():
    """Main function: crawl op.gg items, download images, save data."""
    print("=" * 60)
    print("  OP.GG TFT Item Meta Crawler")
    print("=" * 60)

    raw_data = await _scrape_with_playwright()
    item_rows = raw_data["item_rows"]
    all_images = raw_data["all_images"]

    # Build image URL map from all collected images
    # op.gg item images typically: https://.../{item_id}.png
    item_image_map = {}
    champion_image_map = {}
    for img in all_images:
        src = img["src"]
        alt = img["alt"]
        if "item" in src.lower() or "Item" in src:
            if alt:
                item_image_map[alt] = src
        elif alt and ("champion" in src.lower() or img["width"] in range(20, 80)):
            champion_image_map[alt] = src

    # Process items
    items_data = []
    images_to_download = {}  # filename -> url

    for row in item_rows:
        if row.get("name") == "__raw__":
            continue

        name = row.get("name", "").strip()
        if not name:
            continue

        # Clean up item name (op.gg sometimes duplicates: "Găng Bảo Thạch Găng Bảo Thạch")
        words = name.split()
        half = len(words) // 2
        if half > 0 and words[:half] == words[half:]:
            name = " ".join(words[:half])

        stats = _parse_stats(row.get("stats_raw", ""))

        # Item image
        item_img_url = row.get("image", "")
        if item_img_url:
            fname = _safe_filename(name)
            images_to_download[fname] = item_img_url

        # Champion data
        champ_names = row.get("champion_names", [])
        champ_images = row.get("champion_images", [])
        champions = []
        for idx, cn in enumerate(champ_names):
            cn = cn.strip()
            if not cn:
                continue
            champ_entry = {"name": cn}
            if idx < len(champ_images) and champ_images[idx]:
                champ_entry["image"] = champ_images[idx]
                champ_fname = re.sub(r'[^a-z0-9]', '_', cn.lower().strip())
                images_to_download[f"champ_{champ_fname}"] = champ_images[idx]
            champions.append(champ_entry)

        # Recipe images
        recipe_imgs = row.get("recipe_images", [])
        for ridx, rimg in enumerate(recipe_imgs):
            recipe_fname = f"item_{_safe_filename(name)}_recipe_{ridx}"
            images_to_download[recipe_fname] = rimg

        items_data.append({
            "rank": row.get("rank", 0),
            "name": name,
            "image_url": item_img_url,
            "image_file": _safe_filename(name) if item_img_url else "",
            "avg_place": stats.get("avg_place"),
            "top4_rate": stats.get("top4_rate"),
            "pick_rate": stats.get("pick_rate"),
            "games": stats.get("games"),
            "top_champions": champions,
        })

    # Also add standalone item images from image map
    for alt, src in item_image_map.items():
        fname = _safe_filename(alt)
        if fname not in images_to_download:
            images_to_download[fname] = src

    print(f"\n[4/4] Downloading {len(images_to_download)} images...")
    async with aiohttp.ClientSession(
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    ) as session:
        tasks = []
        for fname, url in images_to_download.items():
            if not url or not url.startswith("http"):
                continue
            ext = "png"
            if ".webp" in url:
                ext = "webp"
            elif ".jpg" in url or ".jpeg" in url:
                ext = "jpg"
            save_path = IMAGES_DIR / f"{fname}.{ext}"
            if save_path.exists():
                logger.info(f"Skip (exists): {fname}")
                continue
            tasks.append(_download_image(session, url, save_path))

        if tasks:
            results = await asyncio.gather(*tasks)
            downloaded = sum(1 for r in results if r)
            print(f"   Downloaded {downloaded}/{len(tasks)} images")
        else:
            print("   All images already cached")

    # Save structured data
    output = {
        "source": URL,
        "season": 16,
        "total_items": len(items_data),
        "items": items_data,
    }

    out_path = DATA_DIR / "opgg_items_meta.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved {len(items_data)} items to {out_path}")
    print(f"✓ Images in {IMAGES_DIR}")

    # Print summary
    print("\n" + "=" * 60)
    print("  TOP 10 ITEMS BY RANK")
    print("=" * 60)
    for item in items_data[:10]:
        champs = ", ".join(c["name"] for c in item.get("top_champions", [])[:5])
        print(
            f"  #{item['rank']:>3}  {item['name']:<30} "
            f"Avg: {item.get('avg_place', '?'):<6} "
            f"Top4: {item.get('top4_rate', '?')}%"
        )
        if champs:
            print(f"         ↳ Tướng: {champs}")

    return output


# ================================================================
# Fallback parser — parse from fetched text content (no Playwright)
# ================================================================

def parse_item_table_text(text: str) -> List[Dict]:
    """
    Parse the text content from op.gg item page (from fetch_webpage or inner_text).
    Handles format like:
    | 1 | Găng Bảo Thạch Găng Bảo Thạch | #4.24 | 54.49% | 15.11% | 635,255 | Malzahar LeBlanc Lux Mel Ahri |
    """
    items = []
    # Pattern: | rank | name | #avg_place | top4% | pickrate% | games | champions |
    pattern = re.compile(
        r'\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*#([\d.]+)\s*\|\s*([\d.]+)%\s*\|\s*([\d.]+)%\s*\|\s*([\d,]+)\s*\|\s*(.+?)\s*\|'
    )
    for m in pattern.finditer(text):
        rank = int(m.group(1))
        raw_name = m.group(2).strip()
        avg_place = float(m.group(3))
        top4_rate = float(m.group(4))
        pick_rate = float(m.group(5))
        games = int(m.group(6).replace(',', ''))
        champ_str = m.group(7).strip()

        # De-duplicate name: "Găng Bảo Thạch Găng Bảo Thạch" → "Găng Bảo Thạch"
        words = raw_name.split()
        half = len(words) // 2
        if half > 0 and words[:half] == words[half:]:
            name = " ".join(words[:half])
        else:
            name = raw_name

        # Parse champion names (space-separated, some multi-word like "Lucian & Senna")
        champions = []
        for c in re.split(r'\s{2,}', champ_str):
            c = c.strip()
            if c and c != '-':
                champions.append({"name": c})

        items.append({
            "rank": rank,
            "name": name,
            "avg_place": avg_place,
            "top4_rate": top4_rate,
            "pick_rate": pick_rate,
            "games": games,
            "top_champions": champions,
            "image_url": "",
            "image_file": _safe_filename(name),
        })

    return items


async def crawl_opgg_items_lite():
    """
    Lightweight version — fetch page text + download images from known Riot CDN URLs.
    Does not need Playwright.
    """
    from agents.web_reader_tool import WebReaderTool

    print("=" * 60)
    print("  OP.GG TFT Item Meta Crawler (Lite)")
    print("=" * 60)

    print("[1/3] Fetching page content...")
    tool = WebReaderTool(max_length=80000)
    result = await tool.read_url(URL)

    if not result.get("success") or not result.get("content"):
        print(f"ERROR: {result.get('error', 'Unknown error')}")
        return None

    content = result["content"]
    print(f"   Got {len(content)} chars")

    print("[2/3] Parsing item data...")
    items = parse_item_table_text(content)
    print(f"   Found {len(items)} items")

    # Download item images from Riot CDN (ggmeo mirrors)
    # Load existing item data for image URLs
    existing_items_path = DATA_DIR / "tft_items_dtcl_s16.json"
    cdn_map = {}
    if existing_items_path.exists():
        with open(existing_items_path, encoding="utf-8") as f:
            existing = json.load(f)
        for item in existing.get("base_components", []) + existing.get("combined_items", []):
            cdn_map[item["name"]] = item.get("image", "")

    print(f"[3/3] Downloading images from CDN ({len(cdn_map)} known URLs)...")
    async with aiohttp.ClientSession(
        headers={"User-Agent": "Mozilla/5.0"}
    ) as session:
        tasks = []
        for name, url in cdn_map.items():
            if not url:
                continue
            fname = _safe_filename(name)
            save_path = IMAGES_DIR / f"{fname}.png"
            if save_path.exists():
                continue
            tasks.append(_download_image(session, url, save_path))

        if tasks:
            results = await asyncio.gather(*tasks)
            print(f"   Downloaded {sum(1 for r in results if r)}/{len(tasks)} new images")

    output = {
        "source": URL,
        "season": 16,
        "total_items": len(items),
        "items": items,
    }

    out_path = DATA_DIR / "opgg_items_meta.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved {len(items)} items → {out_path}")
    return output


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    if mode == "lite":
        asyncio.run(crawl_opgg_items_lite())
    else:
        asyncio.run(crawl_opgg_items())
