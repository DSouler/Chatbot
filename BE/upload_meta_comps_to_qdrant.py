"""
Upload TFT Season 17 meta comps data (from op.gg) directly into Qdrant.

Dữ liệu được lấy từ https://op.gg/vi/tft/meta-trends/comps (phiên bản 17.1)
Cập nhật: 20/04/2026

Usage:
    cd BE
    python upload_meta_comps_to_qdrant.py
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

import config

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

VECTOR_NAME = "dense"

# ============================================================
# Dữ liệu meta comps DTCL Mùa 17 — lấy từ op.gg ngày 20/04/2026
# ============================================================
META_COMPS = [
    # ---- OP TIER ----
    {
        "name": "Du Mục Viktor",
        "tier": "OP",
        "level": 7,
        "difficulty": "Normal",
        "popularity": "Popular",
        "plays": 60,
        "main_carry": "Viktor",
        "carry_items": ["Kết Nối Drone", "Quyền Trượng Thiên Thần", "Găng Bảo Thạch"],
        "secondary_carry": "Nami",
        "secondary_items": ["Quỷ Thư Morello", "Ngọn Giáo Shojin", "Trượng Hư Vô"],
        "tank": "Illaoi",
        "tank_items": ["Vương Miện Hoàng Gia", "Lời Thề Hộ Vệ", "Giáp Máu Warmog"],
        "champions": ["Lissandra", "Meepsie", "Mordekaiser", "Pyke", "Viktor", "Nami", "Illaoi"],
        "traits": {
            "Chuộc Tội": 1, "Hành Tinh": 1, "Viễn Chinh": 2,
            "Hắc Tinh": 2, "Nhân Bản": 2, "Dẫn Truyền": 2,
            "Siêu Linh": 2, "Du Mục": 2
        },
        "key_trait": "Du Mục",
        "notes": "Viktor là core, cần Kết Nối Drone để tối đa hóa sức mạnh. Nami hỗ trợ buff nhóm."
    },
    {
        "name": "Tinh Linh Chuông Kai'Sa",
        "tier": "OP",
        "level": 7,
        "difficulty": "Normal",
        "popularity": "Popular",
        "plays": 78,
        "main_carry": "Kai'Sa",
        "carry_items": ["Bùa Xanh", "Vô Cực Kiếm", "Chùy Đoản Côn"],
        "secondary_carry": "Fizz",
        "secondary_items": ["Găng Bảo Thạch", "Nanh Nashor", "Bàn Tay Công Lý"],
        "tank": "Ornn",
        "tank_items": ["Áo Choàng Lửa", "Giáp Tâm Linh", "Giáp Vai Nguyệt Thần"],
        "champions": ["Meepsie", "Rhaast", "Fizz", "Kai'Sa", "Ornn", "Nami"],
        "traits": {
            "Chuộc Tội": 1, "Vô Pháp": 1, "Hành Tinh": 3,
            "Viễn Chinh": 1, "Hắc Tinh": 2, "Can Trường": 2,
            "Tinh Linh Chuông": 2
        },
        "key_trait": "Tinh Linh Chuông",
        "notes": "Kai'Sa là AD carry, cần Bùa Xanh để spam chiêu. Ornn đi tank chính."
    },
    {
        "name": "Tinh Linh Chuông Xayah",
        "tier": "OP",
        "level": 7,
        "difficulty": "Normal",
        "plays": 93,
        "main_carry": "Xayah",
        "carry_items": ["Cuồng Đao Guinsoo", "Bùa Đỏ", "Thịnh Nộ Thủy Quái"],
        "secondary_carry": "Jhin",
        "secondary_items": ["Kiếm Tử Thần", "Kiếm Súng Hextech", "Vô Cực Kiếm"],
        "tank": "Rhaast",
        "tank_items": ["Nỏ Sét", "Áo Choàng Lửa", "Giáp Máu Warmog"],
        "champions": ["Xayah", "Jhin", "Rhaast", "Karma", "Rammus", "Riven"],
        "traits": {
            "Hủy Diệt": 1, "Chuộc Tội": 1, "Bắn Tỉa": 1,
            "Dẫn Truyền": 3, "Can Trường": 2, "Hắc Tinh": 2,
            "Tiên Phong": 2, "Tinh Linh Chuông": 2, "Chiêm Tinh": 3
        },
        "key_trait": "Tinh Linh Chuông",
        "notes": "Xayah AD carry mạnh, kết hợp Jhin thứ 2. Rhaast tank chính diện."
    },
    # ---- S TIER ----
    {
        "name": "Định Mệnh Twisted Fate",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 48,
        "main_carry": "Twisted Fate",
        "carry_items": ["Nanh Nashor", "Nanh Nashor", "Mũ Phù Thủy Rabadon"],
        "secondary_carry": "Jax",
        "secondary_items": ["Vương Miện Hoàng Gia", "Lời Thề Hộ Vệ", "Thú Tượng Thạch Giáp"],
        "tank": "Caitlyn",
        "tank_items": ["Kiếm Tử Thần", "Cuồng Đao Guinsoo", "Diệt Khổng Lồ"],
        "champions": ["Aatrox", "Talon", "Twisted Fate", "Jax", "Caitlyn", "Milio", "Corki", "Riven"],
        "traits": {
            "Định Mệnh": 1, "N.O.V.A.": 4, "Can Trường": 2,
            "Thời Không": 2, "Vô Pháp": 2, "Chiêm Tinh": 2
        },
        "key_trait": "Định Mệnh",
        "notes": "Twisted Fate cần Nanh Nashor để spam bài. N.O.V.A. 4 là điểm mạnh chính."
    },
    {
        "name": "N.O.V.A. Vex",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 111,
        "main_carry": "Vex",
        "carry_items": ["Cuồng Đao Guinsoo", "Kiếm Súng Hextech", "Diệt Khổng Lồ"],
        "secondary_carry": "Nami",
        "secondary_items": ["Quỷ Thư Morello", "Ngọn Giáo Shojin", "Trượng Hư Vô"],
        "tank": "Nunu & Willump",
        "tank_items": ["Lời Thề Hộ Vệ", "Áo Choàng Lửa", "Giáp Máu Warmog"],
        "champions": ["Aatrox", "Akali", "Nunu & Willump", "Vex", "Nami", "Blitzcrank", "Fiora"],
        "traits": {
            "Tiệc Tùng": 1, "Song Đấu": 1, "Tối Tân": 1,
            "Ác Nữ": 1, "Chiến Lũy": 1, "U Sầu": 1,
            "Hành Tinh": 1, "N.O.V.A.": 1, "Can Trường": 2,
            "Toán Cướp": 2, "Tiên Phong": 2
        },
        "key_trait": "N.O.V.A.",
        "notes": "Vex carry, N.O.V.A. mang lại buff công kích bổ sung. Nunu tank chắc chắn."
    },
    {
        "name": "Hành Tinh Nami",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 90,
        "main_carry": "Nami",
        "carry_items": ["Găng Bảo Thạch", "Nanh Nashor", "Ngọn Giáo Shojin"],
        "secondary_carry": "Riven",
        "secondary_items": ["Ấn Hành Tinh", "Huyết Kiếm", "Quyền Năng Khổng Lồ"],
        "tank": "Tahm Kench",
        "tank_items": ["Lời Thề Hộ Vệ", "Áo Choàng Lửa", "Giáp Máu Warmog"],
        "champions": ["Nasus", "Gwen", "Pantheon", "Ornn", "Nami", "Riven", "Tahm Kench", "Blitzcrank"],
        "traits": {
            "Tiệc Tùng": 1, "Chiến Lũy": 1, "Tiên Tri": 1,
            "Tiên Phong": 6, "Vô Pháp": 2, "Nhân Bản": 2,
            "Can Trường": 2, "Thời Không": 2, "Đấu Sĩ": 2,
            "Hành Tinh": 1
        },
        "key_trait": "Hành Tinh",
        "notes": "Nami là carry phép, Tiên Phong 6 giúp đội hình cực kỳ bền. Tahm Kench tank."
    },
    {
        "name": "Tinh Linh Chuông Vex",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 105,
        "main_carry": "Vex",
        "carry_items": ["Cuồng Đao Guinsoo", "Diệt Khổng Lồ", "Trượng Hư Vô"],
        "secondary_carry": "Blitzcrank",
        "secondary_items": ["Găng Bảo Thạch", "Mũ Phù Thủy Rabadon", "Bàn Tay Công Lý"],
        "tank": "Bard",
        "tank_items": ["Quỷ Thư Morello", "Ngọn Giáo Shojin", "Trượng Hư Vô"],
        "champions": ["Meepsie", "Mordekaiser", "Rhaast", "Karma", "Rammus", "Vex", "Blitzcrank", "Bard"],
        "traits": {
            "Tiệc Tùng": 1, "Chuộc Tội": 1, "Chiến Lũy": 1,
            "U Sầu": 1, "Hành Tinh": 1, "Dẫn Truyền": 1,
            "Tiên Phong": 2, "Viễn Chinh": 2, "Hắc Tinh": 2,
            "Can Trường": 2, "Tinh Linh Chuông": 2
        },
        "key_trait": "Tinh Linh Chuông",
        "notes": "Vex carry, Blitzcrank hỗ trợ kéo địch. Tinh Linh Chuông buff nhóm."
    },
    {
        "name": "N.O.V.A. Kindred",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 90,
        "main_carry": "Kindred",
        "carry_items": ["Cuồng Đao Guinsoo", "Chùy Đoản Côn", "Thịnh Nộ Thủy Quái"],
        "secondary_carry": "Master Yi",
        "secondary_items": ["Ấn N.O.V.A.", "Áo Choàng Bóng Tối", "Diệt Khổng Lồ"],
        "tank": "Tahm Kench",
        "tank_items": ["Trái Tim Kiên Định", "Áo Choàng Lửa", "Giáp Tâm Linh"],
        "champions": ["Aatrox", "Akali", "Bel'Veth", "Maokai", "Fiora", "Kindred", "Master Yi", "Tahm Kench", "Shen"],
        "traits": {
            "Song Đấu": 1, "Chiến Lũy": 1, "Tiên Tri": 1,
            "N.O.V.A.": 1, "Toán Cướp": 5, "Can Trường": 4,
            "Thách Đấu": 2, "Đấu Sĩ": 2
        },
        "key_trait": "N.O.V.A.",
        "notes": "Kindred carry tốc đánh, Toán Cướp 5 rất mạnh. Master Yi thứ 2 với Ấn N.O.V.A."
    },
    {
        "name": "N.O.V.A. Bel'Veth",
        "tier": "S",
        "level": 7,
        "difficulty": "Normal",
        "plays": 45,
        "main_carry": "Bel'Veth",
        "carry_items": ["Diệt Khổng Lồ", "Áo Choàng Thủy Ngân", "Thịnh Nộ Thủy Quái"],
        "secondary_carry": "Akali",
        "secondary_items": ["Áo Choàng Bóng Tối", "Chùy Đoản Côn", "Bàn Tay Công Lý"],
        "tank": "Rek'Sai",
        "tank_items": ["Lời Thề Hộ Vệ", "Áo Choàng Lửa", "Giáp Tâm Linh"],
        "champions": ["Aatrox", "Briar", "Caitlyn", "Maokai", "Kindred", "Bel'Veth", "Akali", "Rek'Sai"],
        "traits": {
            "Tộc Thượng Cổ": 1, "N.O.V.A.": 3, "Toán Cướp": 5,
            "Thách Đấu": 2, "Đấu Sĩ": 2
        },
        "key_trait": "N.O.V.A.",
        "notes": "Bel'Veth carry, Tộc Thượng Cổ + N.O.V.A. 3. Toán Cướp 5 sức mạnh cốt lõi."
    },
    # ---- A TIER ----
    {
        "name": "Máy Móc Robot",
        "tier": "A",
        "level": 8,
        "difficulty": "Hard",
        "plays": 102,
        "main_carry": "Robot (Galio)",
        "carry_items": ["Thú Tượng Thạch Giáp", "Móng Vuốt Sterak", "Quyền Năng Khổng Lồ"],
        "secondary_carry": "Aurelion Sol",
        "secondary_items": ["Găng Bảo Thạch", "Mũ Phù Thủy Rabadon", "Trượng Hư Vô"],
        "tank": "Fiora",
        "tank_items": ["Huyết Kiếm", "Áo Choàng Bóng Tối", "Móng Vuốt Sterak"],
        "champions": ["Urgot", "Karma", "Tahm Kench", "Bard", "Morgana", "Robot", "Aurelion Sol", "Fiora"],
        "traits": {
            "Song Đấu": 1, "Ác Nữ": 1, "Tiên Tri": 1,
            "Dẫn Truyền": 1, "Toán Cướp": 2, "Viễn Chinh": 2,
            "Đấu Sĩ": 2, "Máy Móc": 2
        },
        "key_trait": "Máy Móc",
        "notes": "Cần level 8, khó chơi. Robot (Galio) tank carry, Aurelion Sol hỗ trợ phép. Máy Móc 2 là key."
    },
    {
        "name": "Tiên Phong Vex",
        "tier": "A",
        "level": 9,
        "difficulty": "Hard",
        "plays": 105,
        "main_carry": "Vex",
        "carry_items": ["Cuồng Đao Guinsoo", "Găng Bảo Thạch", "Diệt Khổng Lồ"],
        "secondary_carry": "Nunu & Willump",
        "secondary_items": ["Thú Tượng Thạch Giáp", "Áo Choàng Lửa", "Giáp Tâm Linh"],
        "tank": "Bard",
        "tank_items": ["Găng Bảo Thạch", "Ngọn Giáo Shojin", "Trượng Hư Vô"],
        "champions": ["Meepsie", "Mordekaiser", "Illaoi", "Karma", "Sona", "Blitzcrank", "Vex", "Nunu & Willump", "Bard"],
        "traits": {
            "Tiệc Tùng": 1, "Chỉ Huy": 1, "U Sầu": 1,
            "Tiên Phong": 4, "Hành Tinh": 4, "Dẫn Truyền": 1,
            "Viễn Chinh": 2, "Hắc Tinh": 2, "Du Mục": 2
        },
        "key_trait": "Tiên Phong",
        "notes": "Level 9 khó lên, nhưng Tiên Phong 4 + Hành Tinh 4 rất bền. Vex carry. Cần kinh tế mạnh."
    },
    {
        "name": "Tinh Linh Chuông Corki",
        "tier": "A",
        "level": 7,
        "difficulty": "Normal",
        "plays": 81,
        "main_carry": "Corki",
        "carry_items": ["Bùa Xanh", "Kiếm Tử Thần", "Cung Xanh"],
        "secondary_carry": "Rammus",
        "secondary_items": ["Vương Miện Hoàng Gia", "Thú Tượng Thạch Giáp", "Áo Choàng Lửa"],
        "tank": "Riven",
        "tank_items": ["Huyết Kiếm", "Móng Vuốt Sterak", "Quyền Năng Khổng Lồ"],
        "champions": ["Poppy", "Gnar", "Meepsie", "Milio", "Fizz", "Corki", "Rammus", "Riven", "Bard"],
        "traits": {
            "Tinh Linh Chuông": 7, "Định Mệnh": 2, "Vô Pháp": 2,
            "Thời Không": 2, "Can Trường": 2
        },
        "key_trait": "Tinh Linh Chuông",
        "notes": "Tinh Linh Chuông 7 kích hoạt buff mạnh nhất. Corki carry cự ly xa, cần Bùa Xanh."
    },
    # ---- B TIER ----
    {
        "name": "Tiên Phong Leona",
        "tier": "B",
        "level": 8,
        "difficulty": "Normal",
        "plays": 45,
        "main_carry": "Leona",
        "carry_items": ["Thú Tượng Thạch Giáp", "Thú Tượng Thạch Giáp", "Giáp Máu Warmog"],
        "secondary_carry": "Teemo",
        "secondary_items": ["Cuồng Đao Guinsoo", "Kiếm Súng Hextech", "Diệt Khổng Lồ"],
        "tank": "Nasus",
        "tank_items": ["Huyết Kiếm", "Móng Vuốt Sterak", "Quyền Năng Khổng Lồ"],
        "champions": ["Leona", "Lissandra", "Teemo", "Nasus", "Zoe", "Illaoi", "Nami", "Mordekaiser"],
        "traits": {
            "Hành Tinh": 3, "Tiên Phong": 3, "Thần Phán": 4,
            "Hắc Tinh": 2, "Nhân Bản": 2, "Dẫn Truyền": 2, "Du Mục": 2
        },
        "key_trait": "Tiên Phong",
        "notes": "Leona tank carry. Thần Phán 4 + Tiên Phong 3 tạo độ bền cao. Teemo carry phụ."
    },
    {
        "name": "Tinh Linh Chuông Veigar",
        "tier": "B",
        "level": 7,
        "difficulty": "Normal",
        "plays": 54,
        "main_carry": "Veigar",
        "carry_items": ["Găng Bảo Thạch", "Nanh Nashor", "Ngọn Giáo Shojin"],
        "secondary_carry": "Lissandra",
        "secondary_items": ["Găng Bảo Thạch", "Nanh Nashor", "Nanh Nashor"],
        "tank": "Poppy",
        "tank_items": ["Vuốt Rồng", "Nỏ Sét", "Áo Choàng Lửa"],
        "champions": ["Veigar", "Lissandra", "Poppy", "Gnar", "Meepsie", "Mordekaiser", "Illaoi", "Corki", "Rammus"],
        "traits": {
            "Tinh Linh Chuông": 5, "Tiên Phong": 2, "Hắc Tinh": 2,
            "Nhân Bản": 2, "Can Trường": 2, "Du Mục": 2
        },
        "key_trait": "Tinh Linh Chuông",
        "notes": "Veigar carry phép mạnh. Tinh Linh Chuông 5 kích hoạt mốc mạnh. Lissandra hỗ trợ."
    },
    # ---- D TIER ----
    {
        "name": "Tiên Phong LeBlanc",
        "tier": "D",
        "level": 8,
        "difficulty": "Hard",
        "plays": 66,
        "main_carry": "LeBlanc",
        "carry_items": ["Cuồng Đao Guinsoo", "Găng Bảo Thạch", "Diệt Khổng Lồ"],
        "secondary_carry": "Nunu & Willump",
        "secondary_items": ["Nỏ Sét", "Áo Choàng Lửa", "Giáp Tâm Linh"],
        "tank": "Karma",
        "tank_items": ["Quỷ Thư Morello", "Ngọn Giáo Shojin", "Trượng Hư Vô"],
        "champions": ["Leona", "Meepsie", "Mordekaiser", "Zoe", "Illaoi", "LeBlanc", "Nunu & Willump", "Karma"],
        "traits": {
            "Thần Phán": 3, "Tiên Phong": 3, "Viễn Chinh": 4,
            "Hắc Tinh": 2, "Dẫn Truyền": 2, "Du Mục": 2
        },
        "key_trait": "Tiên Phong",
        "notes": "LeBlanc carry, nhưng tier D — không khuyến khích. Khó lên level và không ổn định."
    },
]

TIER_ORDER = {"OP": 0, "S": 1, "A": 2, "B": 3, "D": 4}
SOURCE = "op.gg/vi/tft/meta-trends/comps — Phiên bản 17.1 — Cập nhật 20/04/2026"
SEASON = 17
SEASON_NAME = "DTCL Mùa 17"


def build_documents() -> list[Document]:
    docs: list[Document] = []

    # --- 1. Per-comp documents ---
    for comp in META_COMPS:
        champs_str = ", ".join(comp["champions"])
        traits_str = ", ".join(
            f"{t} ({v})" for t, v in sorted(comp["traits"].items(), key=lambda x: -x[1])
        )
        carry_items_str = ", ".join(comp["carry_items"])
        secondary_items_str = ", ".join(comp["secondary_items"])
        tank_items_str = ", ".join(comp["tank_items"])

        content = (
            f"Đội hình meta DTCL Mùa {SEASON} ({SEASON_NAME}): {comp['name']}\n"
            f"Hạng: {comp['tier']} (Đây là đội hình hạng {comp['tier']} — {'rất mạnh' if comp['tier'] in ('OP','S') else 'mạnh' if comp['tier'] == 'A' else 'trung bình' if comp['tier'] == 'B' else 'yếu'})\n"
            f"Độ khó: {comp['difficulty']} | Level lên: {comp['level']} | Lượt chơi ghi nhận: {comp.get('plays', 'N/A')}\n"
            f"Carry chính: {comp['main_carry']} — Trang bị: {carry_items_str}\n"
            f"Carry phụ: {comp['secondary_carry']} — Trang bị: {secondary_items_str}\n"
            f"Tank/Hỗ trợ: {comp['tank']} — Trang bị: {tank_items_str}\n"
            f"Danh sách tướng: {champs_str}\n"
            f"Tộc/Hệ kích hoạt: {traits_str}\n"
            f"Tộc/Hệ chủ lực: {comp['key_trait']}\n"
            f"Ghi chú chiến thuật: {comp['notes']}\n"
            f"Nguồn: {SOURCE}"
        )

        docs.append(Document(
            page_content=content,
            metadata={
                "source": SOURCE,
                "doc_type": "tft_meta_comp",
                "comp_name": comp["name"],
                "tier": comp["tier"],
                "tier_order": TIER_ORDER.get(comp["tier"], 9),
                "main_carry": comp["main_carry"],
                "key_trait": comp["key_trait"],
                "level": comp["level"],
                "difficulty": comp["difficulty"],
                "plays": comp.get("plays", 0),
                "season": SEASON,
                "champions": ", ".join(comp["champions"]),
            }
        ))

    # --- 2. Tier summary document (for "đội hình mạnh nhất" queries) ---
    tier_lines = [
        f"Tổng hợp đội hình meta DTCL Mùa {SEASON} ({SEASON_NAME}) theo thứ hạng sức mạnh:\n",
        f"Nguồn: {SOURCE}\n",
    ]
    for tier in ["OP", "S", "A", "B", "D"]:
        tier_comps = [c for c in META_COMPS if c["tier"] == tier]
        if not tier_comps:
            continue
        tier_label = {
            "OP": "OP (Cực mạnh)",
            "S": "S (Rất mạnh)",
            "A": "A (Mạnh)",
            "B": "B (Trung bình)",
            "D": "D (Yếu)"
        }[tier]
        tier_lines.append(f"\n--- Hạng {tier_label} ---")
        for comp in tier_comps:
            tier_lines.append(
                f"  • {comp['name']}: carry {comp['main_carry']} | "
                f"level {comp['level']} | {comp['difficulty']} | {comp.get('plays','?')} plays"
            )

    docs.append(Document(
        page_content="\n".join(tier_lines),
        metadata={
            "source": SOURCE,
            "doc_type": "tft_meta_comp",
            "comp_name": "summary_all_comps",
            "tier": "ALL",
            "season": SEASON,
        }
    ))

    # --- 3. OP/S tier only summary (for "đội hình OP nhất / mạnh nhất" quick queries) ---
    op_s_lines = [
        f"Các đội hình mạnh nhất (OP + S tier) DTCL Mùa {SEASON} ({SEASON_NAME}):\n",
        f"Nguồn: {SOURCE}\n",
    ]
    for comp in [c for c in META_COMPS if c["tier"] in ("OP", "S")]:
        op_s_lines.append(
            f"[{comp['tier']}] {comp['name']}: "
            f"carry {comp['main_carry']} ({', '.join(comp['carry_items'][:2])}...), "
            f"tộc chủ lực: {comp['key_trait']}, level {comp['level']}, {comp.get('plays','?')} plays. "
            f"{comp['notes']}"
        )

    docs.append(Document(
        page_content="\n".join(op_s_lines),
        metadata={
            "source": SOURCE,
            "doc_type": "tft_meta_comp",
            "comp_name": "summary_op_s_tier",
            "tier": "OP+S",
            "season": SEASON,
        }
    ))

    # --- 4. Per-carry document (for "tướng X carry nên đồ gì / đội hình nào") ---
    carry_index: dict[str, list] = {}
    for comp in META_COMPS:
        for carry in [comp["main_carry"], comp["secondary_carry"]]:
            carry_index.setdefault(carry, []).append(comp)

    for carry_name, comps_for_carry in carry_index.items():
        lines = [
            f"Tướng {carry_name} trong meta DTCL Mùa {SEASON} ({SEASON_NAME}):\n"
        ]
        for comp in comps_for_carry:
            if comp["main_carry"] == carry_name:
                role = "CARRY CHÍNH"
                items = comp["carry_items"]
            else:
                role = "carry phụ"
                items = comp["secondary_items"]
            lines.append(
                f"  Đội hình: {comp['name']} [{comp['tier']} tier] — vai trò: {role} — "
                f"trang bị: {', '.join(items)}"
            )
        lines.append(f"Nguồn: {SOURCE}")

        docs.append(Document(
            page_content="\n".join(lines),
            metadata={
                "source": SOURCE,
                "doc_type": "tft_meta_comp_carry",
                "champion_name": carry_name,
                "season": SEASON,
            }
        ))

    return docs


def delete_old_meta_comp_docs(client: QdrantClient, collection_name: str):
    """Xóa các document meta comp cũ trước khi upload mới."""
    logger.info("Xóa document meta comp cũ trong collection '%s'...", collection_name)
    try:
        result = client.delete(
            collection_name=collection_name,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="metadata.doc_type",
                            match=qdrant_models.MatchAny(any=["tft_meta_comp", "tft_meta_comp_carry"]),
                        )
                    ]
                )
            ),
        )
        logger.info("Đã xóa document cũ: %s", result)
    except Exception as e:
        logger.warning("Không thể xóa document cũ (có thể chưa có): %s", e)


def main():
    logger.info("Đang xây dựng documents từ dữ liệu meta comps op.gg...")
    docs = build_documents()
    logger.info("Tổng cộng %d documents.", len(docs))

    collection_name = config.QDRANT_COLLECTION_NAME
    logger.info("Kết nối Qdrant tại %s:%s, collection='%s'",
                config.QDRANT_HOST, config.QDRANT_PORT, collection_name)

    client = QdrantClient(
        host=config.QDRANT_HOST,
        port=config.QDRANT_PORT,
        api_key=config.QDRANT_API_KEY if config.QDRANT_API_KEY else None,
    )

    # Đảm bảo collection tồn tại
    try:
        client.get_collection(collection_name)
        logger.info("Collection '%s' đã tồn tại.", collection_name)
    except Exception:
        logger.info("Collection '%s' chưa có, đang tạo...", collection_name)
        client.create_collection(
            collection_name=collection_name,
            vectors_config={
                VECTOR_NAME: qdrant_models.VectorParams(
                    size=1536,
                    distance=qdrant_models.Distance.COSINE
                )
            },
            sparse_vectors_config={
                "sparse": qdrant_models.SparseVectorParams(
                    index=qdrant_models.SparseIndexParams(on_disk=True)
                )
            }
        )
        logger.info("Đã tạo collection '%s'.", collection_name)

    # Xóa dữ liệu meta comp cũ
    delete_old_meta_comp_docs(client, collection_name)

    # Setup embeddings + vector store
    embedding = OpenAIEmbeddings(
        openai_api_key=config.LLM_API_KEY,
        model="text-embedding-ada-002",
    )
    sparse_embeddings = FastEmbedSparse()

    vector_store = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
        embedding=embedding,
        sparse_embedding=sparse_embeddings,
        vector_name=VECTOR_NAME,
        sparse_vector_name="sparse",
    )

    logger.info("Đang upload %d documents lên Qdrant...", len(docs))
    ids = vector_store.add_documents(docs)
    logger.info("Upload thành công %d documents.", len(ids))

    info = client.get_collection(collection_name)
    logger.info("Collection '%s' hiện có %d points.", collection_name, info.points_count)

    print(f"\nHoàn tất! {len(ids)} documents đã được upload vào Qdrant collection '{collection_name}'.")
    print(f"Dữ liệu: {len(META_COMPS)} đội hình meta mùa 17 (OP/S/A/B/D tier)")
    print(f"Nguồn: {SOURCE}")


if __name__ == "__main__":
    main()
