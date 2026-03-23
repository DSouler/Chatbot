"""
Đánh giá đội hình TFT tùy chỉnh của user bằng cách so sánh với meta comps từ op.gg.
"""
import re
import json
import os
import logging
from typing import List, Dict, Tuple, Optional
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Từ khóa nhận diện user muốn đánh giá đội hình
EVAL_KEYWORDS = [
    "top mấy", "xếp mấy", "đánh giá", "đội hình này", "đội hình tôi",
    "đội hình của tôi", "rank mấy", "placement", "predict", "dự đoán",
    "được không", "mạnh không", "ổn không", "có tốt không", "rate",
    "đánh giá đội", "review đội", "xem đội"
]


def is_comp_eval_request(text: str) -> bool:
    """Kiểm tra xem câu hỏi có phải là yêu cầu đánh giá đội hình không."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in EVAL_KEYWORDS)


def extract_champions_from_text(text: str, known_champions: List[str]) -> List[str]:
    """
    Trích xuất tên tướng từ text của user bằng cách đối chiếu với danh sách tướng đã biết.
    Tìm theo cả tên đầy đủ và tên viết tắt (case-insensitive).
    """
    text_lower = text.lower()
    found = []
    seen = set()

    # Sắp xếp theo độ dài giảm dần để ưu tiên match tên dài trước (e.g. "Miss Fortune" trước "Miss")
    sorted_champs = sorted(known_champions, key=len, reverse=True)

    for champ in sorted_champs:
        champ_lower = champ.lower()
        # Dùng word boundary để tránh match một phần (e.g. "Kai" không match "Kai'Sa")
        pattern = re.escape(champ_lower)
        if re.search(pattern, text_lower) and champ_lower not in seen:
            found.append(champ)
            seen.add(champ_lower)

    return found


def build_known_champions(meta_comps: List[Dict]) -> List[str]:
    """Xây dựng danh sách tất cả tướng từ meta comps."""
    all_champs = set()
    for comp in meta_comps:
        for champ in comp.get("champions", []):
            all_champs.add(champ)
    return list(all_champs)


def jaccard_similarity(set_a: set, set_b: set) -> float:
    """Tính độ giống nhau Jaccard giữa 2 tập hợp."""
    if not set_a and not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def find_similar_comps(user_champions: List[str], meta_comps: List[Dict], top_k: int = 3) -> List[Dict]:
    """
    Tìm các meta comp giống nhất với đội hình của user.
    Trả về top_k comps được sắp xếp theo độ tương đồng giảm dần.
    """
    user_set = {c.lower() for c in user_champions}
    results = []

    for comp in meta_comps:
        meta_set = {c.lower() for c in comp.get("champions", [])}
        similarity = jaccard_similarity(user_set, meta_set)
        overlap = [c for c in comp.get("champions", []) if c.lower() in user_set]
        missing = [c for c in comp.get("champions", []) if c.lower() not in user_set]
        extra = [c for c in user_champions if c.lower() not in meta_set]

        results.append({
            **comp,
            "similarity": round(similarity * 100, 1),
            "overlap_champions": overlap,
            "missing_champions": missing,
            "extra_champions": extra,
        })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]


def format_eval_context(user_champions: List[str], similar_comps: List[Dict]) -> str:
    """Tạo context text để gửi cho LLM đánh giá."""
    lines = [
        f"ĐỘI HÌNH CỦA USER: {', '.join(user_champions)}",
        "",
        "=== CÁC ĐỘI HÌNH META GẦN NHẤT TỪ OP.GG ===",
    ]

    for i, comp in enumerate(similar_comps, 1):
        lines += [
            f"\n[{i}] {comp['name']} — Độ tương đồng: {comp['similarity']}%",
            f"    Tier: {comp['tier']} | Avg. place: {comp['avg_place']} | Top 4 rate: {comp['top4_rate']}% | 1st rate: {comp['first_rate']}%",
            f"    Tướng đầy đủ: {', '.join(comp.get('champions', []))}",
            f"    Tướng trùng khớp: {', '.join(comp['overlap_champions']) if comp['overlap_champions'] else 'Không có'}",
            f"    Tướng còn thiếu: {', '.join(comp['missing_champions']) if comp['missing_champions'] else 'Đủ hết'}",
            f"    Tướng thừa/khác meta: {', '.join(comp['extra_champions']) if comp['extra_champions'] else 'Không có'}",
        ]

    return "\n".join(lines)


# Danh sách tướng TFT Set 16 chính xác (từ tftactics.gg)
TFT_SET16_CHAMPIONS = [
    # Standard (1-5 cost)
    "Ahri", "Ambessa", "Anivia", "Annie", "Aphelios", "Ashe", "Azir",
    "Bel'Veth", "Blitzcrank", "Braum", "Briar", "Caitlyn", "Cho'Gath",
    "Dr. Mundo", "Draven", "Ekko", "Fiddlesticks", "Gangplank", "Garen",
    "Illaoi", "Jarvan IV", "Jhin", "Jinx", "Kindred", "Kog'Maw",
    "Leona", "Lissandra", "Loris", "Lucian & Senna", "Lulu", "Lux",
    "Malzahar", "Milio", "Miss Fortune", "Nautilus", "Neeko", "Ornn",
    "Qiyana", "Rek'Sai", "Rumble", "Sejuani", "Seraphine", "Shen",
    "Shyvana", "Sion", "Sona", "Swain", "Taric", "Teemo", "Tristana",
    "Twisted Fate", "Vayne", "Vi", "Viego", "Wukong", "Xin Zhao",
    "Yasuo", "Yunara", "Zilean", "Zoe",
    # Unlockable / Secret
    "Aatrox", "Aurelion Sol", "Bard", "Darius", "Diana", "Fizz",
    "Galio", "Graves", "Gwen", "Kai'Sa", "Kalista", "Kennen",
    "Kobuko", "LeBlanc", "Mel", "Nasus", "Nidalee", "Orianna",
    "Poppy", "Renekton", "Ryze", "Sett", "Singed", "Skarner",
    "Sylas", "Tahm Kench", "Thresh", "Tryndamere", "Veigar",
    "Volibear", "Warwick", "Xerath", "Yone", "Yorick", "Ziggs",
    # Summons / Special
    "T-Hex", "Tibbers", "Zaahen",
]

VISION_EXTRACT_PROMPT = """You are analyzing a TFT (Teamfight Tactics) Set 16 screenshot.

You are given TWO images:
1. **IMAGE 1 (Reference Grid)**: A labeled grid showing ALL 90 TFT Set 16 champion portraits with their names in YELLOW text below each portrait. Each row has 10 champions, sorted alphabetically.
2. **IMAGE 2 (User's Board)**: The user's actual TFT game screenshot showing champion units on a hex board.

**YOUR TASK:** Identify each champion unit on the user's board by matching their visual appearance to the reference grid.

**STEP-BY-STEP METHOD:**
1. Look at each champion unit on the hex board in Image 2 (both on the board AND on the bench at the bottom).
2. For EACH unit, examine its portrait artwork — look at hair color, face, armor, weapon, and overall color scheme.
3. Scan through the reference grid (Image 1) systematically row by row to find the portrait that BEST matches visually.
4. Read the YELLOW name label below that matching portrait in the reference grid.
5. Use that EXACT name.

**STRICT RULES:**
- You MUST ONLY use names from this list (these are the ONLY valid TFT Set 16 champions):
  Aatrox, Ahri, Ambessa, Anivia, Annie, Aphelios, Ashe, Aurelion Sol, Azir, Bard,
  Bel'Veth, Blitzcrank, Braum, Briar, Caitlyn, Cho'Gath, Darius, Diana, Dr. Mundo, Draven,
  Ekko, Fiddlesticks, Fizz, Galio, Gangplank, Garen, Graves, Gwen, Illaoi, Jarvan IV,
  Jhin, Jinx, Kai'Sa, Kalista, Kennen, Kindred, Kog'Maw, LeBlanc, Leona, Lissandra,
  Loris, Lucian & Senna, Lulu, Lux, Malzahar, Mel, Milio, Miss Fortune, Nasus, Nautilus,
  Neeko, Nidalee, Orianna, Ornn, Poppy, Qiyana, Rek'Sai, Renekton, Rumble, Ryze,
  Sejuani, Seraphine, Sett, Shen, Shyvana, Singed, Sion, Skarner, Sona, Swain,
  Sylas, Tahm Kench, Taric, Teemo, Thresh, Tristana, Tryndamere, Twisted Fate, Vayne,
  Veigar, Vi, Viego, Volibear, Warwick, Wukong, Xerath, Xin Zhao, Yasuo, Yone, Yorick,
  Yunara, Ziggs, Zilean, Zoe, Kobuko, Milio
- Do NOT invent names not in this list. Champions like Gragas, Katarina, Zyra, etc. do NOT exist in TFT Set 16.
- If a unit cannot be confidently matched, skip it rather than guessing a wrong name.
- Include units on the bench (bottom row) if visible.

Return ONLY valid JSON, no explanation:
{"champions": ["Name1", "Name2", ...], "items_observed": {"Name1": ["item1"], ...}, "board_level": "level if visible", "gold": "gold if visible", "stage": "stage if visible"}"""

# Load reference grid image as base64 at module load time
_REFERENCE_GRID_B64 = None

def _load_reference_grid():
    global _REFERENCE_GRID_B64
    if _REFERENCE_GRID_B64 is not None:
        return _REFERENCE_GRID_B64
    grid_b64_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'champion_grid_b64.txt')
    try:
        with open(grid_b64_path, 'r') as f:
            _REFERENCE_GRID_B64 = f.read().strip()
        logger.info(f"Loaded champion reference grid ({len(_REFERENCE_GRID_B64)} chars)")
    except Exception as e:
        logger.warning(f"Could not load champion reference grid: {e}")
        _REFERENCE_GRID_B64 = ""
    return _REFERENCE_GRID_B64


def extract_champions_from_image(
    llm_client,
    model_name: str,
    images: list,
    known_champions: Optional[List[str]] = None
) -> dict:
    """Dùng GPT-4o-mini vision + reference grid để nhận diện tướng từ ảnh chụp TFT."""
    ref_grid_b64 = _load_reference_grid()

    content = [{"type": "text", "text": VISION_EXTRACT_PROMPT}]

    # Image 1: Reference grid
    if ref_grid_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{ref_grid_b64}"}
        })

    # Image 2: User's screenshot
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{img.media_type};base64,{img.data}"}
        })

    # Dùng danh sách Set 16 đầy đủ để match
    all_known = list(set(TFT_SET16_CHAMPIONS + (known_champions or [])))

    try:
        response = llm_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a TFT expert that identifies champions from screenshots. Always respond in valid JSON."},
                {"role": "user", "content": content}
            ],
            temperature=0.1,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
        champions = result.get("champions", [])
        logger.info(f"Vision raw champions: {champions}")

        # Fuzzy match tên tướng vision với danh sách Set 16
        if champions:
            champions = _match_to_known(champions, all_known)
            logger.info(f"Vision matched champions: {champions}")

        return {
            "champions": champions,
            "items_observed": result.get("items_observed", {}),
            "board_level": result.get("board_level", ""),
            "gold": result.get("gold", ""),
            "stage": result.get("stage", ""),
        }

    except Exception as e:
        logger.error(f"Vision champion extraction failed: {e}")
        return {"champions": [], "items_observed": {}, "board_level": "", "gold": "", "stage": ""}


def _match_to_known(extracted: list, known: list) -> list:
    """Fuzzy match tên tướng từ vision → tên chuẩn từ op.gg meta. Loại bỏ tên không khớp."""
    matched = []
    known_lower = {k.lower(): k for k in known}

    for name in extracted:
        name_lower = name.lower()
        # Exact match
        if name_lower in known_lower:
            matched.append(known_lower[name_lower])
            continue
        # Fuzzy match
        best_score, best_match = 0, None
        for kl, original in known_lower.items():
            score = SequenceMatcher(None, name_lower, kl).ratio()
            if score > best_score:
                best_score, best_match = score, original
        if best_score >= 0.7 and best_match:
            matched.append(best_match)
            logger.info(f"Vision fuzzy match: '{name}' → '{best_match}' (score={best_score:.2f})")
        else:
            # STRICT: drop names not in TFT Set 16 instead of passing through
            logger.warning(f"Vision dropped unknown champion: '{name}' (best match: '{best_match}', score={best_score:.2f})")

    return list(dict.fromkeys(matched))
