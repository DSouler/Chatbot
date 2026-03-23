"""
Scraper cho op.gg/tft/meta-trends/comps
Lấy dữ liệu comp meta, parse thành structured documents để ingesti vào RAG.
"""
import re
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

# Tier dựa trên stats
def _estimate_tier(avg_place: float, top4_rate: float) -> str:
    if top4_rate >= 70 and avg_place <= 3.5:
        return "OP"
    elif top4_rate >= 65 and avg_place <= 3.8:
        return "S"
    elif top4_rate >= 55:
        return "A"
    elif top4_rate >= 45:
        return "B"
    else:
        return "C"


def _preprocess(text: str) -> str:
    """Chuẩn hóa text: tách các tokens bị dính lại."""
    text = re.sub(r'(\d+\.\d+%)(Top 4 rate)', r'\1\nTop 4 rate', text)
    text = re.sub(r'(\d+\.\d+%)(Pick rate)', r'\1\nPick rate', text)
    text = re.sub(r'(\d+\.\d+%)(Avg\.)', r'\1\n\2', text)
    text = re.sub(r'([\d.]+%)\s*(Top 4)', r'\1\nTop 4', text)
    return text


def _parse_comps(text: str) -> List[Dict]:
    """
    Parse inner_text của op.gg thành danh sách comp dicts.
    Pattern: CompName → cost → [Lv X] → [difficulty] → [tag]
             → Avg. place → float → 1st place → float% → Top 4 rate → float% → Pick rate → float%
             → [champion costs] → [champion names + placements]
    """
    text = _preprocess(text)
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    SKIP_TAGS = {
        'Hard', 'Normal', 'Easy', 'Popular', 'Honey',
        'Lv 7', 'Lv 8', 'Lv 9', 'Lv 6',
        'New game!', 'Stats', 'Teamfight Tactics', 'Desktop', 'Games',
        'Home', 'Comps & Stats', 'User Trends', 'Leaderboards',
        'Meta team comps', 'Season', 'CHONCC', 'REVIVAL', 'Global',
        'All modes', 'RANKED', 'All', 'Challenger', 'Grandmaster',
        'Master', 'Diamond', 'Emerald', 'Platinum', 'Gold', 'Silver',
        'Bronze', 'Iron', 'Version', 'ADVERTISEMENT', 'REMOVE ADS',
        'Sign in', 'Feedback', 'EN', 'NA', 'Comps', 'Champion', 'Item',
        'Synergy', 'Augments', 'Tacticians', 'Youtuber Trends',
    }
    PLACEMENT_MARKERS = {'1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'}

    comps = []
    i = 0
    while i < len(lines):
        if lines[i] == "Avg. place":
            # Tìm comp name ở trước (skip numbers, tags, difficulty labels)
            name_idx = i - 1
            while name_idx >= 0 and (
                lines[name_idx].isdigit() or
                re.match(r'^\d+$', lines[name_idx]) or
                re.match(r'^Lv \d$', lines[name_idx]) or
                lines[name_idx] in SKIP_TAGS
            ):
                name_idx -= 1

            comp_name = lines[name_idx] if name_idx >= 0 else ""

            # Bỏ qua nếu tên không hợp lệ
            if not comp_name or comp_name in SKIP_TAGS or re.match(r'^\d+', comp_name):
                i += 1
                continue

            # Parse stats sau "Avg. place"
            avg_place_str = ""
            first_rate_str = ""
            top4_rate_str = ""
            pick_rate_str = ""

            j = i + 1
            end_j = min(i + 20, len(lines))
            while j < end_j:
                if re.match(r'^\d+\.\d+$', lines[j]) and not avg_place_str:
                    avg_place_str = lines[j]
                elif lines[j] == "1st place" and j + 1 < end_j:
                    j += 1
                    m = re.match(r'^([\d.]+)%?', lines[j])
                    if m:
                        first_rate_str = m.group(1)
                elif lines[j] == "Top 4 rate" and j + 1 < end_j:
                    j += 1
                    m = re.match(r'^([\d.]+)%?', lines[j])
                    if m:
                        top4_rate_str = m.group(1)
                elif lines[j] == "Pick rate" and j + 1 < end_j:
                    j += 1
                    m = re.match(r'^([\d.]+)%?', lines[j])
                    if m:
                        pick_rate_str = m.group(1)
                    break
                j += 1

            if not top4_rate_str:
                i += 1
                continue

            # Parse champion names sau pick rate (j hiện đang ở sau pick_rate value)
            champions = []
            k = j + 1
            end_k = min(j + 40, len(lines))

            def _is_next_comp_name(idx: int) -> bool:
                """Kiểm tra dòng idx có phải là tên comp tiếp theo không (dòng kế là Avg. place)."""
                check = idx + 1
                while check < end_k:
                    if lines[check] == "Avg. place":
                        return True
                    # Bỏ qua số và tags nhỏ giữa comp name và Avg. place
                    if (re.match(r'^\d+$', lines[check]) or
                            lines[check] in SKIP_TAGS or
                            re.match(r'^Lv \d+$', lines[check])):
                        check += 1
                        continue
                    break
                return False

            while k < end_k:
                line = lines[k]
                # Dừng khi gặp "Avg. place" của comp tiếp theo
                if line == "Avg. place":
                    break
                # Bỏ qua số cost (1-9), placement markers, tags, difficulty, level
                if (re.match(r'^\d+$', line) or
                        line in PLACEMENT_MARKERS or
                        line in SKIP_TAGS or
                        re.match(r'^Lv \d+$', line) or
                        re.match(r'^\d+\.\d+', line) or
                        '%' in line):
                    k += 1
                    continue
                # Bỏ qua nếu dòng này là tên comp tiếp theo
                if _is_next_comp_name(k):
                    break
                # Champion name: bắt đầu bằng chữ hoa, không phải stat keyword
                if (re.match(r'^[A-Z]', line) and
                        line not in {'Avg', 'Top', 'Pick', '1st', '2nd', '3rd', 'Lv',
                                     'Avg.', 'place', 'rate', 'Rate'} and
                        len(line) > 1 and
                        "Tier" not in line and
                        "Meta" not in line):
                    champions.append(line)
                k += 1

            try:
                avg_place = float(avg_place_str) if avg_place_str else 0.0
                top4_rate = float(top4_rate_str) if top4_rate_str else 0.0
                first_rate = float(first_rate_str) if first_rate_str else 0.0
                pick_rate = float(pick_rate_str) if pick_rate_str else 0.0

                tier = _estimate_tier(avg_place, top4_rate)

                # Deduplicate champions
                seen = set()
                unique_champs = []
                for c in champions:
                    if c not in seen:
                        seen.add(c)
                        unique_champs.append(c)

                comps.append({
                    "name": comp_name,
                    "tier": tier,
                    "avg_place": avg_place,
                    "top4_rate": top4_rate,
                    "first_rate": first_rate,
                    "pick_rate": pick_rate,
                    "champions": unique_champs[:12]
                })
            except Exception as e:
                logger.debug(f"Skip comp '{comp_name}': {e}")

        i += 1

    # Deduplicate by name
    seen_names = set()
    unique_comps = []
    for c in comps:
        if c["name"] not in seen_names:
            seen_names.add(c["name"])
            unique_comps.append(c)

    return unique_comps


def format_comp_as_document(comp: Dict) -> str:
    """Chuyển comp dict thành text document để embed vào RAG."""
    champs = ", ".join(comp["champions"]) if comp["champions"] else "Không rõ"
    return (
        f"Tên đội hình: {comp['name']}\n"
        f"Tier: {comp['tier']}\n"
        f"Tỉ lệ top 4: {comp['top4_rate']}%\n"
        f"Xếp hạng trung bình: {comp['avg_place']}\n"
        f"Tỉ lệ top 1: {comp['first_rate']}%\n"
        f"Pick rate: {comp['pick_rate']}%\n"
        f"Tướng: {champs}\n"
        f"Nguồn: op.gg/tft/meta-trends/comps (cập nhật tự động)\n"
    )


async def scrape_opgg_meta() -> List[Dict]:
    """
    Scrape op.gg TFT meta comps.
    Trả về list dicts với keys: name, tier, avg_place, top4_rate, first_rate, pick_rate, champions, document_text
    """
    from agents.web_reader_tool import WebReaderTool

    tool = WebReaderTool(max_length=30000)
    result = await tool.read_url("https://op.gg/tft/meta-trends/comps")

    if not result.get("success") or not result.get("content", "").strip():
        raise RuntimeError(f"Không thể scrape op.gg: {result.get('error', 'unknown error')}")

    # Strip the context hint prefix we added
    content = result["content"]
    if content.startswith("[GHI CHÚ:"):
        end = content.find("]\n\n")
        if end >= 0:
            content = content[end + 3:]

    comps = _parse_comps(content)
    logger.info(f"Scraped {len(comps)} comps from op.gg")

    for comp in comps:
        comp["document_text"] = format_comp_as_document(comp)

    return comps
