"""
Đánh giá đội hình TFT tùy chỉnh của user bằng cách so sánh với meta comps từ op.gg.
"""
import re
import logging
from typing import List, Dict, Tuple

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
