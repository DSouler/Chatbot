"""
Live TFT meta crawler — tftacademy.com + op.gg/tft
Crawl trực tiếp, cache in-memory (TTL 30 phút), inject context cho LLM.
KHÔNG lưu Qdrant.
"""
import re
import time
import logging
import asyncio
import aiohttp
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ================================================================
# Items removed from TFT Season 16 — filter from crawled data
# ================================================================
REMOVED_ITEMS_S16 = [
    "statikk", "shiv", "dao statikk",
]


def _is_removed_item(name: str) -> bool:
    """Check if an item name matches a removed item from Season 16."""
    name_lower = name.lower().strip()
    return any(removed in name_lower for removed in REMOVED_ITEMS_S16)


# ================================================================
# Base component items (nguồn: ggmeo.com/trang-bi-dtcl)
# Maps Riot apiName → Vietnamese display name
# ================================================================
BASE_ITEMS = {
    "TFT_Item_BFSword": "Kiếm BF",
    "TFT_Item_RecurveBow": "Cung Dài",
    "TFT_Item_NeedlesslyLargeRod": "Gậy Phép Lớn",
    "TFT_Item_TearOfTheGoddess": "Nước Mắt Nữ Thần",
    "TFT_Item_ChainVest": "Áo Giáp Xích",
    "TFT_Item_NegatronCloak": "Áo Choàng Phép",
    "TFT_Item_GiantsBelt": "Đai Khổng Lồ",
    "TFT_Item_SparringGloves": "Găng Tay",
    "TFT_Item_Spatula": "Thìa Vàng",
}

# ================================================================
# Item image file names (served via /image/{name} endpoint)
# ================================================================
ITEM_IMAGE_MAP = {
    # Base items
    "Kiếm BF": "item_bf_sword",
    "Cung Dài": "item_recurve_bow",
    "Gậy Phép Lớn": "item_needlessly_large_rod",
    "Nước Mắt Nữ Thần": "item_tear_of_the_goddess",
    "Áo Giáp Xích": "item_chain_vest",
    "Áo Choàng Phép": "item_negatron_cloak",
    "Đai Khổng Lồ": "item_giants_belt",
    "Găng Tay": "item_sparring_gloves",
    "Thìa Vàng": "item_spatula",
    # Crafted items (image mapped to existing files; "" = text fallback)
    "Kiếm Tử Thần": "item_deathblade",
    "Diệt Khổng Lồ": "item_dit_khng_l",
    "Kiếm Súng Hextech": "item_hextechgunblade",
    "Ngọn Giáo Shojin": "item_spearofshojin",
    "Huyết Kiếm": "item_bloodthirster",
    "Vô Cực Kiếm": "item_infinityedge",
    "Bùa Đỏ": "item_rapidfirecannon",
    "Cuồng Đao Guinsoo": "item_guinsoosrageblade",
    "Trượng Hư Vô": "item_statikkshiv",
    "Bùa Xanh": "item_bluebuff",
    "Mũ Phù Thủy Rabadon": "item_rabadonsdeathcap",
    "Quyền Trượng Thiên Thần": "item_archangelsstaff",
    "Nỏ Sét": "item_ionicspark",
    "Quỷ Thư Morello": "item_morellonomicon",
    "Găng Bảo Thạch": "item_jeweledgauntlet",
    "Áo Choàng Gai": "item_bramblevest",
    "Vuốt Rồng": "item_dragonsclaw",
    "Giáp Máu Warmog": "item_warmogsarmor",
    "Áo Choàng Thủy Ngân": "item_quicksilver",
    "Bàn Tay Công Lý": "item_unstableconcoction",
    "Mũ Thích Nghi": "item_adaptivehelm",
    "Thú Tượng Thạch Giáp": "item_gargoylestoneplate",
    "Trái Tim Kiên Định": "item_tri_tim_kin_nh",
    "Vương Miện Chiến Thuật Gia": "item_forceofnature",
    "Lời Thề Hộ Vệ": "item_li_th_h_v",
    "Áo Choàng Lửa": "item_redbuff",
    "Găng Đạo Tặc": "item_thiefsgloves",
    "Giáp Tâm Linh": "item_redemption",
    "Cung Xanh": "item_lastwhisper",
    "Vương Miện Hoàng Gia": "item_crownguard",
    "Móng Vuốt Sterak": "item_mng_vut_sterak",
    "Giáp Vai Nguyệt Thần": "item_gip_vai_nguyt_thn",
    "Chùy Đoản Côn": "item_chy_on_cn",
    "Áo Choàng Bóng Tối": "item_guardianangel",
    "Nanh Nashor": "item_nanh_nashor",
    "Thịnh Nộ Thủy Quái": "item_runaanshurricane",
    "Quyền Năng Khổng Lồ": "item_titansresolve",
}

# ================================================================
# Item recipes — cách ghép trang bị (nguồn: ggmeo.com/trang-bi-dtcl)
# Maps Vietnamese item name → (component1_VN, component2_VN)
# ================================================================
ITEM_RECIPES = {
    # BF Sword combos
    "Kiếm Tử Thần": ("Kiếm BF", "Kiếm BF"),
    "Diệt Khổng Lồ": ("Kiếm BF", "Cung Dài"),
    "Kiếm Súng Hextech": ("Kiếm BF", "Gậy Phép Lớn"),
    "Ngọn Giáo Shojin": ("Kiếm BF", "Nước Mắt Nữ Thần"),
    "Áo Choàng Bóng Tối": ("Kiếm BF", "Áo Giáp Xích"),
    "Huyết Kiếm": ("Kiếm BF", "Áo Choàng Phép"),
    "Móng Vuốt Sterak": ("Kiếm BF", "Đai Khổng Lồ"),
    "Vô Cực Kiếm": ("Kiếm BF", "Găng Tay"),
    # Recurve Bow combos
    "Bùa Đỏ": ("Cung Dài", "Cung Dài"),
    "Cuồng Đao Guinsoo": ("Cung Dài", "Gậy Phép Lớn"),
    "Trượng Hư Vô": ("Cung Dài", "Nước Mắt Nữ Thần"),
    "Quyền Năng Khổng Lồ": ("Cung Dài", "Áo Giáp Xích"),
    "Thịnh Nộ Thủy Quái": ("Cung Dài", "Áo Choàng Phép"),
    "Nanh Nashor": ("Cung Dài", "Đai Khổng Lồ"),
    "Cung Xanh": ("Cung Dài", "Găng Tay"),
    # Needlessly Large Rod combos
    "Mũ Phù Thủy Rabadon": ("Gậy Phép Lớn", "Gậy Phép Lớn"),
    "Quyền Trượng Thiên Thần": ("Gậy Phép Lớn", "Nước Mắt Nữ Thần"),
    "Vương Miện Hoàng Gia": ("Gậy Phép Lớn", "Áo Giáp Xích"),
    "Nỏ Sét": ("Gậy Phép Lớn", "Áo Choàng Phép"),
    "Quỷ Thư Morello": ("Gậy Phép Lớn", "Đai Khổng Lồ"),
    "Găng Bảo Thạch": ("Gậy Phép Lớn", "Găng Tay"),
    # Tear of the Goddess combos
    "Bùa Xanh": ("Nước Mắt Nữ Thần", "Nước Mắt Nữ Thần"),
    "Lời Thề Hộ Vệ": ("Nước Mắt Nữ Thần", "Áo Giáp Xích"),
    "Mũ Thích Nghi": ("Nước Mắt Nữ Thần", "Áo Choàng Phép"),
    "Giáp Tâm Linh": ("Nước Mắt Nữ Thần", "Đai Khổng Lồ"),
    "Bàn Tay Công Lý": ("Nước Mắt Nữ Thần", "Găng Tay"),
    # Chain Vest combos
    "Áo Choàng Gai": ("Áo Giáp Xích", "Áo Giáp Xích"),
    "Thú Tượng Thạch Giáp": ("Áo Giáp Xích", "Áo Choàng Phép"),
    "Áo Choàng Lửa": ("Áo Giáp Xích", "Đai Khổng Lồ"),
    "Trái Tim Kiên Định": ("Áo Giáp Xích", "Găng Tay"),
    # Negatron Cloak combos
    "Vuốt Rồng": ("Áo Choàng Phép", "Áo Choàng Phép"),
    "Giáp Vai Nguyệt Thần": ("Áo Choàng Phép", "Đai Khổng Lồ"),
    "Áo Choàng Thủy Ngân": ("Áo Choàng Phép", "Găng Tay"),
    # Giant's Belt combos
    "Giáp Máu Warmog": ("Đai Khổng Lồ", "Đai Khổng Lồ"),
    "Chùy Đoản Côn": ("Đai Khổng Lồ", "Găng Tay"),
    # Sparring Gloves combo
    "Găng Đạo Tặc": ("Găng Tay", "Găng Tay"),
    # Spatula combo
    "Vương Miện Chiến Thuật Gia": ("Thìa Vàng", "Thìa Vàng"),
}


# ================================================================
# SECTION 1: Intent Detection
# ================================================================

META_KEYWORDS = [
    # Comps / Tier lists
    "meta", "tier list", "tierlist", "đội hình mạnh", "đội hình tốt nhất",
    "comp mạnh", "comp tốt", "top comp", "best comp", "comp nào mạnh",
    "đội hình nào mạnh", "đội hình nào tốt", "chơi gì mạnh", "chơi gì tốt",
    "nên chơi gì", "bài nào mạnh", "bài nào tốt",
    "doi hinh manh", "doi hinh nao manh", "doi hinh top",
    # Items
    "trang bị mạnh", "item mạnh", "item tốt", "best item", "item meta",
    "trang bị meta", "ghép đồ", "nên ghép gì",
    "trang bị nào tốt", "item nào tốt", "item tier list",
    "trang bị nào mạnh", "item nào mạnh",
    "trang bị top tier", "trang bi top tier", "top tier item", "top tier trang bị",
    "trang bị top", "item top", "trang bi top",
    "trang bi nao manh", "trang bi nao tot", "trang bi manh",
    # Item recipes
    "cách ghép", "cach ghep", "công thức ghép", "cong thuc ghep",
    "ghép được", "ghep duoc", "ghép từ", "ghep tu",
    "ghép bằng", "ghep bang", "ghép đồ", "ghep do",
    "các thành phần", "thanh phan trang bi",
    # Augments
    "augment mạnh", "augment tốt", "best augment", "augment meta",
    "lõi mạnh", "lõi tốt", "lõi meta", "augment tier list",
    "augment nào mạnh", "lõi nào mạnh", "augment nào tốt",
    "lõi top tier", "augment top tier", "lõi top", "augment top",
    "loi manh", "loi nao manh", "loi top", "augment nao manh",
    # General meta
    "meta hiện tại", "meta mới", "current meta",
    "op.gg", "tftacademy", "tft academy",
    "xếp hạng đội hình", "ranking comp",
]

META_INTENT_PATTERNS = [
    r"meta\s+(hiện tại|mới|bây giờ|hôm nay|tuần này|patch)",
    r"(đội hình|comp|bài)\s+(nào|gì)\s+(mạnh|tốt|op|s tier|tier)",
    r"(tier\s*list|tierlist)\s*(comp|item|augment|trang bị|lõi)?",
    r"(top|best|mạnh nhất|tốt nhất)\s*(comp|đội hình|item|trang bị|augment|lõi)",
    r"(nên chơi|chơi gì|pick gì)\s*(mạnh|tốt|meta)?",
    r"(item|trang bị|augment|lõi)\s*(tier\s*list|meta|mạnh|tốt|op)",
    r"(item|trang bị|trang bi|augment|lõi|đội hình|comp)\s*(top\s*tier|top)",
    r"(những|các|danh sách)\s*(item|trang bị|trang bi|augment|lõi|đội hình|comp)\s*(top|mạnh|tốt|tier)",
    r"(item|trang bị|trang bi|augment|lõi)\s*(nào|gì)\s*(mạnh|tốt|op)",
    r"top\s*tier\s*(item|trang bị|trang bi|augment|lõi)?",
    r"(cách|cach)\s*(ghép|ghep)\s*(trang bị|item|trang bi)?",
    r"(ghép|ghep)\s*(trang bị|item|trang bi|trang bị này|trang bị nào|từ gì|như thế nào)",
    r"(công thức|cong thuc)\s*(ghép|ghep)?",
]


class MetaContentType:
    COMPS = "comps"
    ITEMS = "items"
    AUGMENTS = "augments"


CONTENT_KEYWORDS = {
    MetaContentType.ITEMS: [
        "item", "trang bị", "ghép đồ", "đồ", "cách ghép", "nên ghép",
        "equipment", "trang bi", "ghep do", "cach ghep", "nen ghep",
        "công thức", "cong thuc", "recipe", "trang bị nào", "trang bi nao",
        "ghép", "ghep",
    ],
    MetaContentType.AUGMENTS: [
        "augment", "lõi", "augments", "core", "hex",
    ],
    MetaContentType.COMPS: [
        "comp", "đội hình", "bài", "team comp", "team", "meta comp",
        "build", "lineup",
    ],
}


def is_tft_meta_request(text: str) -> bool:
    """Detect if user is asking about TFT meta data (live crawl needed)."""
    text_lower = text.lower().strip()
    if any(kw in text_lower for kw in META_KEYWORDS):
        return True
    for pattern in META_INTENT_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def detect_content_type(text: str) -> str:
    """Determine what type of meta content the user is asking about."""
    text_lower = text.lower()
    scores = {}
    for content_type, keywords in CONTENT_KEYWORDS.items():
        scores[content_type] = sum(1 for kw in keywords if kw in text_lower)

    if scores.get(MetaContentType.ITEMS, 0) > scores.get(MetaContentType.COMPS, 0):
        return MetaContentType.ITEMS
    if scores.get(MetaContentType.AUGMENTS, 0) > scores.get(MetaContentType.COMPS, 0):
        return MetaContentType.AUGMENTS
    return MetaContentType.COMPS


# ================================================================
# SECTION 2: In-Memory Cache
# ================================================================

@dataclass
class CacheEntry:
    data: object
    timestamp: float
    content_type: str


class MetaCache:
    """Simple in-memory TTL cache for crawled TFT data."""

    def __init__(self, ttl_seconds: int = 1800):
        self._cache: Dict[str, CacheEntry] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[object]:
        entry = self._cache.get(key)
        if entry is None:
            return None
        if time.time() - entry.timestamp > self._ttl:
            del self._cache[key]
            return None
        return entry.data

    def set(self, key: str, data: object, content_type: str = ""):
        self._cache[key] = CacheEntry(data=data, timestamp=time.time(), content_type=content_type)

    def clear(self):
        self._cache.clear()

    def stats(self) -> Dict:
        now = time.time()
        valid = {k: v for k, v in self._cache.items() if now - v.timestamp <= self._ttl}
        return {"total_entries": len(self._cache), "valid_entries": len(valid), "ttl_seconds": self._ttl}


_meta_cache = MetaCache(ttl_seconds=1800)


# ================================================================
# SECTION 3: TFT Academy Scraper
# ================================================================

TFTACADEMY_URLS = {
    MetaContentType.COMPS: "https://tftacademy.com/tierlist/comps",
    MetaContentType.ITEMS: "https://tftacademy.com/tierlist/items",
    MetaContentType.AUGMENTS: "https://tftacademy.com/tierlist/augments",
}

# Direct JSON API endpoints (fast, no Playwright needed)
TFTACADEMY_API = {
    MetaContentType.ITEMS: {
        "tierlist": "https://tftacademy.com/api/tierlist/items?set=16",
        "assets": "https://tftacademy.com/api/assets/items?set=16",
    },
    MetaContentType.AUGMENTS: {
        "tierlist": "https://tftacademy.com/api/tierlist/augments?set=16",
        "assets": "https://tftacademy.com/api/assets/augments?set=16",
    },
}

# ================================================================
# Vietnamese item names mapping (source: ggmeo.com/trang-bi-dtcl)
# Maps Riot apiName → official Vietnamese name
# ================================================================
ITEM_APINAME_TO_VN = {
    # --- Standard Craftable Items ---
    "TFT_Item_AdaptiveHelm": "Mũ Thích Nghi",
    "TFT_Item_ArchangelsStaff": "Quyền Trượng Thiên Thần",
    "TFT_Item_Bloodthirster": "Huyết Kiếm",
    "TFT_Item_BlueBuff": "Bùa Xanh",
    "TFT_Item_BrambleVest": "Áo Choàng Gai",
    "TFT_Item_Crownguard": "Vương Miện Hoàng Gia",
    "TFT_Item_Deathblade": "Kiếm Tử Thần",
    "TFT_Item_DragonsClaw": "Vuốt Rồng",
    "TFT_Item_ForceOfNature": "Vương Miện Chiến Thuật Gia",
    "TFT_Item_FrozenHeart": "Lời Thề Hộ Vệ",
    "TFT_Item_GargoyleStoneplate": "Thú Tượng Thạch Giáp",
    "TFT_Item_GuardianAngel": "Áo Choàng Bóng Tối",
    "TFT_Item_GuinsoosRageblade": "Cuồng Đao Guinsoo",
    "TFT_Item_HextechGunblade": "Kiếm Súng Hextech",
    "TFT_Item_InfinityEdge": "Vô Cực Kiếm",
    "TFT_Item_IonicSpark": "Nỏ Sét",
    "TFT_Item_JeweledGauntlet": "Găng Bảo Thạch",
    "TFT_Item_LastWhisper": "Cung Xanh",
    "TFT_Item_Leviathan": "Nanh Nashor",
    "TFT_Item_MadredsBloodrazor": "Diệt Khổng Lồ",
    "TFT_Item_Morellonomicon": "Quỷ Thư Morello",
    "TFT_Item_NightHarvester": "Trái Tim Kiên Định",
    "TFT_Item_PowerGauntlet": "Chùy Đoản Côn",
    "TFT_Item_Quicksilver": "Áo Choàng Thủy Ngân",
    "TFT_Item_RabadonsDeathcap": "Mũ Phù Thủy Rabadon",
    "TFT_Item_RapidFireCannon": "Bùa Đỏ",
    "TFT_Item_RedBuff": "Áo Choàng Lửa",
    "TFT_Item_Redemption": "Giáp Tâm Linh",
    "TFT_Item_RunaansHurricane": "Thịnh Nộ Thủy Quái",
    "TFT_Item_SpearOfShojin": "Ngọn Giáo Shojin",
    "TFT_Item_SpectralGauntlet": "Giáp Vai Nguyệt Thần",
    "TFT_Item_StatikkShiv": "Trượng Hư Vô",
    "TFT_Item_SteraksGage": "Móng Vuốt Sterak",
    "TFT_Item_ThiefsGloves": "Găng Đạo Tặc",
    "TFT_Item_TitansResolve": "Quyền Năng Khổng Lồ",
    "TFT_Item_UnstableConcoction": "Bàn Tay Công Lý",
    "TFT_Item_WarmogsArmor": "Giáp Máu Warmog",
    # --- Radiant Items ---
    "TFT5_Item_AdaptiveHelmRadiant": "Mũ Thích Nghi Ánh Sáng",
    "TFT5_Item_ArchangelsStaffRadiant": "Quyền Trượng Thiên Thần Ánh Sáng",
    "TFT5_Item_BloodthirsterRadiant": "Huyết Kiếm Ánh Sáng",
    "TFT5_Item_BlueBuffRadiant": "Bùa Xanh Ánh Sáng",
    "TFT5_Item_BrambleVestRadiant": "Áo Choàng Gai Ánh Sáng",
    "TFT5_Item_CrownguardRadiant": "Vương Miện Hoàng Gia Ánh Sáng",
    "TFT5_Item_DeathbladeRadiant": "Kiếm Tử Thần Ánh Sáng",
    "TFT5_Item_DragonsClawRadiant": "Vuốt Rồng Ánh Sáng",
    "TFT5_Item_FrozenHeartRadiant": "Lời Thề Hộ Vệ Ánh Sáng",
    "TFT5_Item_GargoyleStoneplateRadiant": "Thú Tượng Thạch Giáp Ánh Sáng",
    "TFT5_Item_GiantSlayerRadiant": "Diệt Khổng Lồ Ánh Sáng",
    "TFT5_Item_GuardianAngelRadiant": "Áo Choàng Bóng Tối Ánh Sáng",
    "TFT5_Item_GuinsoosRagebladeRadiant": "Cuồng Đao Guinsoo Ánh Sáng",
    "TFT5_Item_HandOfJusticeRadiant": "Bàn Tay Công Lý Ánh Sáng",
    "TFT5_Item_HextechGunbladeRadiant": "Kiếm Súng Hextech Ánh Sáng",
    "TFT5_Item_InfinityEdgeRadiant": "Vô Cực Kiếm Ánh Sáng",
    "TFT5_Item_IonicSparkRadiant": "Nỏ Sét Ánh Sáng",
    "TFT5_Item_JeweledGauntletRadiant": "Găng Bảo Thạch Ánh Sáng",
    "TFT5_Item_LastWhisperRadiant": "Cung Xanh Ánh Sáng",
    "TFT5_Item_LeviathanRadiant": "Nanh Nashor Ánh Sáng",
    "TFT5_Item_MorellonomiconRadiant": "Quỷ Thư Morello Ánh Sáng",
    "TFT5_Item_NightHarvesterRadiant": "Trái Tim Kiên Định Ánh Sáng",
    "TFT5_Item_QuicksilverRadiant": "Áo Choàng Thủy Ngân Ánh Sáng",
    "TFT5_Item_RabadonsDeathcapRadiant": "Mũ Phù Thủy Rabadon Ánh Sáng",
    "TFT5_Item_RapidFirecannonRadiant": "Bùa Đỏ Ánh Sáng",
    "TFT5_Item_RedemptionRadiant": "Giáp Tâm Linh Ánh Sáng",
    "TFT5_Item_RunaansHurricaneRadiant": "Thịnh Nộ Thủy Quái Ánh Sáng",
    "TFT5_Item_SpearOfShojinRadiant": "Ngọn Giáo Shojin Ánh Sáng",
    "TFT5_Item_SpectralGauntletRadiant": "Giáp Vai Nguyệt Thần Ánh Sáng",
    "TFT5_Item_StatikkShivRadiant": "Trượng Hư Vô Ánh Sáng",
    "TFT5_Item_SteraksGageRadiant": "Móng Vuốt Sterak Ánh Sáng",
    "TFT5_Item_SunfireCapeRadiant": "Áo Choàng Lửa Ánh Sáng",
    "TFT5_Item_ThiefsGlovesRadiant": "Găng Đạo Tặc Ánh Sáng",
    "TFT5_Item_TitansResolveRadiant": "Quyền Năng Khổng Lồ Ánh Sáng",
    "TFT5_Item_TrapClawRadiant": "Chùy Đoản Côn Ánh Sáng",
    "TFT5_Item_WarmogsArmorRadiant": "Giáp Máu Warmog Ánh Sáng",
    # --- Artifact Items ---
    "TFT_Item_Artifact_AegisOfDawn": "Khiên Hừng Đông",
    "TFT_Item_Artifact_AegisOfDusk": "Khiên Hoàng Hôn",
    "TFT_Item_Artifact_BlightingJewel": "Đá Hắc Hóa",
    "TFT_Item_Artifact_CappaJuice": "Nước Cappa",
    "TFT_Item_Artifact_Dawncore": "Lõi Bình Minh",
    "TFT_Item_Artifact_EternalPact": "Khế Ước Vĩnh Hằng",
    "TFT_Item_Artifact_Fishbones": "Pháo Xương Cá",
    "TFT_Item_Artifact_HellfireHatchet": "Rìu Hỏa Ngục",
    "TFT_Item_Artifact_HorizonFocus": "Kính Nhắm Ma Pháp",
    "TFT_Item_Artifact_InnervatingLocket": "Dây Chuyền Tự Lực",
    "TFT_Item_Artifact_LichBane": "Kiếm Tai Ương",
    "TFT_Item_Artifact_LightshieldCrest": "Huy Hiệu Lightshield",
    "TFT_Item_Artifact_LudensTempest": "Bão Tố Luden",
    "TFT_Item_Artifact_Mittens": "Găng Đấu Sĩ",
    "TFT_Item_Artifact_NavoriFlickerblades": "Đao Chớp",
    "TFT_Item_Artifact_ProwlersClaw": "Móng Vuốt Ám Muội",
    "TFT_Item_Artifact_RapidFirecannon": "Đại Bác Tốc Xạ",
    "TFT_Item_Artifact_SeekersArmguard": "Giáp Tay Seeker",
    "TFT_Item_Artifact_SilvermereDawn": "Chùy Bạch Ngân",
    "TFT_Item_Artifact_StatikkShiv": "Dao Điện Statikk",
    "TFT_Item_Artifact_TalismanOfAscension": "Bùa Thăng Hoa",
    "TFT_Item_Artifact_TheIndomitable": "Bất Khuất",
    "TFT_Item_Artifact_TitanicHydra": "Rìu Đại Mãng Xà",
    "TFT_Item_Artifact_VoidGauntlet": "Găng Hư Không",
    "TFT_Item_Artifact_WitsEnd": "Đao Tím",
    # --- Ornn / Special Items ---
    "TFT4_Item_OrnnDeathsDefiance": "Vũ Khúc Tử Thần",
    "TFT4_Item_OrnnInfinityForce": "Tam Luyện Kiếm",
    "TFT4_Item_OrnnMuramana": "Thánh Kiếm Manazane",
    "TFT4_Item_OrnnTheCollector": "Đại Bác Hải Tặc",
    "TFT4_Item_OrnnZhonyasParadox": "Nghịch Lý Zhonya",
    "TFT7_Item_ShimmerscaleGamblersBlade": "Kiếm của Tay Bạc",
    "TFT7_Item_ShimmerscaleMogulsMail": "Giáp Đại Hãn",
    "TFT9_Item_OrnnDeathfireGrasp": "Bùa Đầu Lâu",
    "TFT9_Item_OrnnHorizonFocus": "Kính Nhắm Thiện Xạ",
    "TFT9_Item_OrnnHullbreaker": "Thần Búa Tiến Công",
    "TFT9_Item_OrnnPrototypeForge": "Găng Tay Thợ Rèn",
    # --- Darkin Items ---
    "TFT16_TheDarkinAegis": "Khiên Darkin",
    "TFT16_TheDarkinBow": "Cung Darkin",
    "TFT16_TheDarkinScythe": "Lưỡi Hái Darkin",
    "TFT16_TheDarkinStaff": "Trượng Darkin",
    # --- Emblem Items ---
    "TFT16_Item_BilgewaterEmblemItem": "Ấn Bilgewater",
    "TFT16_Item_BrawlerEmblemItem": "Ấn Đấu Sĩ",
    "TFT16_Item_DefenderEmblemItem": "Ấn Vệ Quân",
    "TFT16_Item_DemaciaEmblemItem": "Ấn Demacia",
    "TFT16_Item_FreljordEmblemItem": "Ấn Freljord",
    "TFT16_Item_GunslingerEmblemItem": "Ấn Xạ Thủ",
    "TFT16_Item_InvokerEmblemItem": "Ấn Thuật Sĩ",
    "TFT16_Item_IoniaEmblemItem": "Ấn Ionia",
    "TFT16_Item_IxtalEmblemItem": "Ấn Ixtal",
    "TFT16_Item_JuggernautEmblemItem": "Ấn Dũng Sĩ",
    "TFT16_Item_LongshotEmblemItem": "Ấn Viễn Kích",
    "TFT16_Item_MagusEmblemItem": "Ấn Nhiễu Loạn",
    "TFT16_Item_NoxusEmblemItem": "Ấn Noxus",
    "TFT16_Item_PiltoverEmblemItem": "Ấn Piltover",
    "TFT16_Item_RapidfireEmblemItem": "Ấn Cực Tốc",
    "TFT16_Item_SlayerEmblemItem": "Ấn Đồ Tể",
    "TFT16_Item_SorcererEmblemItem": "Ấn Pháp Sư",
    "TFT16_Item_VanquisherEmblemItem": "Ấn Chinh Phạt",
    "TFT16_Item_VoidEmblemItem": "Ấn Hư Không",
    "TFT16_Item_WardenEmblemItem": "Ấn Cảnh Vệ",
    "TFT16_Item_YordleEmblemItem": "Ấn Yordle",
    "TFT16_Item_ZaunEmblemItem": "Ấn Zaun",
}

# ================================================================
# Item descriptions — correct effects for key items
# Maps Vietnamese display name → short effect description
# Used to prevent LLM from hallucinating wrong item effects
# ================================================================
ITEM_DESCRIPTIONS = {
    # Craftables
    "Găng Bảo Thạch": "Kỹ năng của tướng có thể gây sát thương chí mạng phép",
    "Vô Cực Kiếm": "Tăng tỉ lệ chí mạng và sát thương chí mạng vật lý",
    "Ngọn Giáo Shojin": "Mỗi đòn đánh hồi năng lượng cho tướng, giúp tung kỹ năng liên tục",
    "Nanh Nashor": "Tăng tốc độ đánh và tung kỹ năng sau mỗi đòn đánh",
    "Trượng Hư Vô": "Giảm kháng phép của kẻ địch, tăng sát thương phép",
    "Quỷ Thư Morello": "Gây hiệu ứng thiêu đốt và giảm hồi máu của kẻ địch",
    "Bùa Đỏ": "Gây hiệu ứng thiêu đốt lên kẻ địch, giảm hồi máu",
    "Bùa Xanh": "Hồi toàn bộ năng lượng sau khi tung kỹ năng lần đầu",
    "Mũ Thích Nghi": "Mỗi giây tự thích nghi giảm thêm sát thương nhận vào",
    "Mũ Phù Thủy Rabadon": "Tăng mạnh sức mạnh phép thuật (AP)",
    "Quyền Trượng Thiên Thần": "Tăng AP liên tục khi tung kỹ năng, hồi mana",
    "Cuồng Đao Guinsoo": "Tăng tốc độ đánh theo thời gian chiến đấu",
    "Giáp Tâm Linh": "Hồi máu theo phần trăm sức mạnh phép cho tướng",
    "Giáp Vai Nguyệt Thần": "Né tránh đòn đánh cơ bản, giảm sát thương nhận vào",
    "Móng Vuốt Sterak": "Tạo khiên khi máu xuống thấp, tăng sức mạnh tấn công",
    "Lời Thề Hộ Vệ": "Tăng giáp và hồi một phần máu khi bị đánh",
    "Áo Choàng Thủy Ngân": "Miễn dịch hiệu ứng kiểm soát đám đông và loại bỏ debuff",
    "Kiếm Tử Thần": "Tăng sát thương vật lý, mỗi lần hạ gục kẻ địch hồi máu",
    "Huyết Kiếm": "Hút máu dựa theo sát thương gây ra (vật lý)",
    "Thịnh Nộ Thủy Quái": "Bắn đạn lightning xuyên qua nhiều kẻ địch mỗi đòn đánh",
    "Cung Xanh": "Giảm giáp kẻ địch mỗi đòn đánh (kháng giáp)",
    "Thú Tượng Thạch Giáp": "Chuyển đỡ phần lớn sát thương nhận vào, tăng giáp và kháng phép",
    "Áo Choàng Gai": "Phản lại sát thương vật lý cho kẻ tấn công",
    "Áo Choàng Lửa": "Gây sát thương lửa lan rộng quanh tướng mỗi giây",
    "Áo Choàng Bóng Tối": "Hồi sinh một lần khi máu về 0 với lượng máu nhất định",
    "Kiếm Súng Hextech": "Mỗi kỹ năng hút máu, kết hợp sát thương vật lý và phép",
    "Diệt Khổng Lồ": "Tỉ lệ sát thương tăng theo lượng máu tối đa của kẻ địch",
    "Nỏ Sét": "Tung tia sét qua các kẻ địch, giảm kháng phép của chúng",
    "Chùy Đoản Côn": "Làm chậm kẻ địch khi tấn công, tăng giáp đồng thời",
    "Giáp Máu Warmog": "Tăng tối đa máu và hồi phục máu nhanh khi ra khỏi chiến đấu",
    "Vương Miện Hoàng Gia": "Tăng giáp, kháng phép và sức mạnh tấn công",
    "Vuốt Rồng": "Tăng kháng phép và hồi máu khi nhận sát thương phép",
    "Trái Tim Kiên Định": "Hồi máu xung quanh đồng đội theo phần trăm",
    "Găng Đạo Tặc": "Nhân ngẫu nhiên các chỉ số của trang bị khác",
    "Bàn Tay Công Lý": "Ngẫu nhiên hồi máu hoặc tăng sát thương mỗi đòn đánh",
    "Quyền Năng Khổng Lồ": "Tăng sức tấn công và kháng giáp/kháng phép",
    "Vương Miện Chiến Thuật Gia": "Tăng thêm 1 ô tướng cho đội hình",
    # Radiants
    "Găng Bảo Thạch Ánh Sáng": "Kỹ năng của tướng có thể gây sát thương chí mạng phép (phiên bản Ánh Sáng, hiệu quả mạnh hơn)",
    "Vô Cực Kiếm Ánh Sáng": "Tăng tỉ lệ và sát thương chí mạng vật lý (phiên bản Ánh Sáng)",
    "Ngọn Giáo Shojin Ánh Sáng": "Hồi năng lượng liên tục từ đòn đánh (phiên bản Ánh Sáng)",
    "Nanh Nashor Ánh Sáng": "Tăng tốc độ đánh và liên tục tung kỹ năng (phiên bản Ánh Sáng)",
    "Trượng Hư Vô Ánh Sáng": "Giảm kháng phép sâu hơn, tăng sát thương phép (phiên bản Ánh Sáng)",
    "Quỷ Thư Morello Ánh Sáng": "Thiêu đốt và giảm hồi máu mạnh hơn (phiên bản Ánh Sáng)",
    "Bùa Đỏ Ánh Sáng": "Thiêu đốt mạnh hơn, giảm hồi máu kẻ địch (phiên bản Ánh Sáng)",
    "Kiếm Súng Hextech Ánh Sáng": "Hút máu hồi phép và vật lý mạnh hơn (phiên bản Ánh Sáng)",
    "Nanh Nashor Ánh Sáng": "Tốc độ đánh và năng lượng hồi nhanh hơn (phiên bản Ánh Sáng)",
}


async def _fetch_tftacademy_api(content_type: str) -> Optional[List[Dict]]:
    """Fetch tier list directly from tftacademy.com JSON API (no Playwright).
    Returns parsed list of dicts or None if API unavailable."""
    api_config = TFTACADEMY_API.get(content_type)
    if not api_config:
        return None

    try:
        timeout = aiohttp.ClientTimeout(total=15)
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Fetch tierlist + assets in parallel
            async with session.get(api_config["tierlist"], headers=headers) as tier_resp, \
                        session.get(api_config["assets"], headers=headers) as asset_resp:
                if tier_resp.status != 200 or asset_resp.status != 200:
                    logger.warning(f"tftacademy API returned {tier_resp.status}/{asset_resp.status}")
                    return None
                tier_data = await tier_resp.json()
                asset_data = await asset_resp.json()

        # Build apiName → display name mapping
        if content_type == MetaContentType.ITEMS:
            assets = asset_data.get("items", [])
            tierlists = tier_data.get("items_tierlists", [])
        elif content_type == MetaContentType.AUGMENTS:
            assets = asset_data.get("augments", [])
            tierlists = tier_data.get("augments_tierlists", [])
        else:
            return None

        name_map = {a["apiName"]: a.get("name", a["apiName"]) for a in assets if "apiName" in a}

        result = []
        tier_order = ["S", "A", "B", "C", "D"]
        for tl_entry in tierlists:
            tiers = tl_entry.get("tier", {})
            item_type = tl_entry.get("type", "craftables")
            for tier in tier_order:
                for api_name in tiers.get(tier, []):
                    en_name = name_map.get(api_name, api_name)
                    # Use Vietnamese name from ggmeo if available
                    display_name = ITEM_APINAME_TO_VN.get(api_name, en_name) if content_type == MetaContentType.ITEMS else en_name
                    result.append({
                        "name": display_name,
                        "tier": tier,
                        "item_type": item_type,
                        "source": "tftacademy.com",
                    })

        logger.info(f"tftacademy API: fetched {len(result)} {content_type} across {len(tierlists)} categories")
        return result if result else None
    except Exception as e:
        logger.warning(f"tftacademy API fetch failed for {content_type}: {e}")
        return None


def _parse_tftacademy_comps(text: str) -> List[Dict]:
    """Parse tftacademy.com comps tier list text."""
    comps = []
    current_tier = "Unknown"
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    tier_pattern = re.compile(r'^(S\+?|A\+?|B\+?|C|D|OP)\s*[Tt]ier', re.IGNORECASE)

    i = 0
    while i < len(lines):
        tier_match = tier_pattern.match(lines[i])
        if tier_match:
            current_tier = tier_match.group(1).upper()
            i += 1
            continue

        if len(lines[i]) > 3 and not lines[i].isdigit() and not re.match(r'^[\d.%]+$', lines[i]):
            comp_name = lines[i]
            champions = []
            j = i + 1
            while j < len(lines):
                if tier_pattern.match(lines[j]):
                    break
                if lines[j].isdigit() or re.match(r'^[\d.%]+$', lines[j]):
                    j += 1
                    continue
                if re.match(r'^[A-Z]', lines[j]) and len(lines[j]) > 1:
                    champions.append(lines[j])
                j += 1
                if len(champions) >= 10:
                    break

            if champions:
                comps.append({
                    "name": comp_name,
                    "tier": current_tier,
                    "champions": champions,
                    "source": "tftacademy.com",
                })
                i = j
                continue
        i += 1
    return comps


def _parse_tftacademy_items(text: str) -> List[Dict]:
    """Parse tftacademy.com items tier list."""
    items = []
    current_tier = "Unknown"
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    tier_pattern = re.compile(r'^(S\+?|A\+?|B\+?|C|D|OP)\s*[Tt]ier', re.IGNORECASE)

    for line in lines:
        tier_match = tier_pattern.match(line)
        if tier_match:
            current_tier = tier_match.group(1).upper()
            continue
        if len(line) > 2 and not line.isdigit() and re.match(r'^[A-Z]', line):
            if not _is_removed_item(line):
                items.append({"name": line, "tier": current_tier, "source": "tftacademy.com"})
    return items


def _parse_tftacademy_augments(text: str) -> List[Dict]:
    """Parse tftacademy.com augments tier list."""
    augments = []
    current_tier = "Unknown"
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    tier_pattern = re.compile(r'^(S\+?|A\+?|B\+?|C|D|OP)\s*[Tt]ier', re.IGNORECASE)

    for line in lines:
        tier_match = tier_pattern.match(line)
        if tier_match:
            current_tier = tier_match.group(1).upper()
            continue
        if len(line) > 2 and not line.isdigit() and not re.match(r'^[\d.%]+$', line):
            augments.append({"name": line, "tier": current_tier, "source": "tftacademy.com"})
    return augments


async def scrape_tftacademy(content_type: str) -> Dict:
    """Scrape tftacademy.com for given content type. Returns structured result dict."""
    cache_key = f"tftacademy_{content_type}"
    cached = _meta_cache.get(cache_key)
    if cached is not None:
        logger.info(f"Cache hit for {cache_key}")
        return {"success": True, "data": cached, "error": None, "from_cache": True}

    # Try direct JSON API first (fast, no Playwright) for items/augments
    if content_type in (MetaContentType.ITEMS, MetaContentType.AUGMENTS):
        api_data = await _fetch_tftacademy_api(content_type)
        if api_data:
            _meta_cache.set(cache_key, api_data, content_type)
            return {"success": True, "data": api_data, "error": None, "from_cache": False}
        logger.info(f"API failed for {content_type}, falling back to Playwright")

    url = TFTACADEMY_URLS.get(content_type, TFTACADEMY_URLS[MetaContentType.COMPS])
    try:
        from agents.web_reader_tool import WebReaderTool
        tool = WebReaderTool(max_length=30000)
        result = await tool.read_url(url)

        if not result.get("success") or not result.get("content", "").strip():
            return {"success": False, "data": [], "error": f"Failed to fetch {url}: {result.get('error', 'empty')}", "from_cache": False}

        raw_text = result["content"]
        parser_map = {
            MetaContentType.COMPS: _parse_tftacademy_comps,
            MetaContentType.ITEMS: _parse_tftacademy_items,
            MetaContentType.AUGMENTS: _parse_tftacademy_augments,
        }
        parsed_data = parser_map.get(content_type, _parse_tftacademy_comps)(raw_text)

        if parsed_data:
            _meta_cache.set(cache_key, parsed_data, content_type)

        return {"success": True, "data": parsed_data, "error": None, "raw_length": len(raw_text), "from_cache": False}
    except Exception as e:
        logger.error(f"tftacademy scrape error for {content_type}: {e}")
        return {"success": False, "data": [], "error": str(e), "from_cache": False}


# ================================================================
# SECTION 4: OP.GG Wrapper (reuse existing scraper + cache)
# ================================================================

async def scrape_opgg_comps() -> Dict:
    """Scrape op.gg TFT meta comps with caching."""
    cache_key = "opgg_comps"
    cached = _meta_cache.get(cache_key)
    if cached is not None:
        logger.info("Cache hit for opgg_comps")
        return {"success": True, "data": cached, "error": None, "from_cache": True}

    try:
        from agents.opgg_scraper import scrape_opgg_meta
        comps = await scrape_opgg_meta()
        if comps:
            _meta_cache.set(cache_key, comps, MetaContentType.COMPS)
        return {"success": True, "data": comps, "error": None, "from_cache": False}
    except Exception as e:
        logger.error(f"op.gg scrape error: {e}")
        return {"success": False, "data": [], "error": str(e), "from_cache": False}


# ================================================================
# SECTION 5: Combined Crawler (parallel)
# ================================================================

async def crawl_tft_meta(content_type: str) -> Tuple[Dict, Dict]:
    """Crawl both tftacademy.com and op.gg in parallel. Returns (tftacademy_result, opgg_result)."""
    if content_type == MetaContentType.COMPS:
        return await asyncio.gather(scrape_tftacademy(content_type), scrape_opgg_comps())
    else:
        tftacademy_result = await scrape_tftacademy(content_type)
        opgg_result = {"success": False, "data": [], "error": "N/A for this content type", "from_cache": False}
        return tftacademy_result, opgg_result


# ================================================================
# SECTION 6: Context Formatting for LLM
# ================================================================

def format_meta_context(content_type: str, tftacademy_data: List[Dict], opgg_data: List[Dict], user_question: str) -> str:
    """Combine data from both sources into a single context string for the LLM."""
    parts = []

    if content_type == MetaContentType.COMPS:
        parts.append("=== DỮ LIỆU META ĐỘI HÌNH TFT (CẬP NHẬT TRỰC TIẾP) ===\n")

        if opgg_data:
            parts.append("--- Nguồn: op.gg/tft/meta-trends/comps (thống kê từ hàng triệu trận) ---")
            for comp in opgg_data:
                champs = ", ".join(comp.get("champions", []))
                parts.append(
                    f"[{comp.get('tier', '?')}] {comp['name']} | "
                    f"Avg. place: {comp.get('avg_place', '?')} | "
                    f"Top 4: {comp.get('top4_rate', '?')}% | "
                    f"1st: {comp.get('first_rate', '?')}% | "
                    f"Pick: {comp.get('pick_rate', '?')}% | "
                    f"Tướng: {champs}"
                )
            parts.append("")

        if tftacademy_data:
            parts.append("--- Nguồn: tftacademy.com/tierlist/comps (xếp hạng chuyên gia) ---")
            for comp in tftacademy_data:
                champs = ", ".join(comp.get("champions", []))
                parts.append(f"[{comp.get('tier', '?')}] {comp['name']} | Tướng: {champs}")
            parts.append("")

    elif content_type == MetaContentType.ITEMS:
        parts.append("=== DỮ LIỆU TIER LIST TRANG BỊ TFT (CẬP NHẬT TRỰC TIẾP) ===\n")
        show_recipes = _is_recipe_query(user_question)
        # Only include recipe table when user asks about recipes
        if show_recipes:
            parts.append(format_recipe_table())
            parts.append("")
        if tftacademy_data:
            parts.append("--- Nguồn: tftacademy.com/tierlist/items ---")
            # Group by item_type if available (API data has it)
            type_labels = {
                "craftables": "Trang bị ghép (Craftables)",
                "radiants": "Trang bị Ánh sáng (Radiants)",
                "artifacts": "Hiện vật (Artifacts)",
                "ornns": "Hiện vật (Artifacts)",
                "emblems": "Huy hiệu (Emblems)",
            }
            has_types = any(item.get("item_type") for item in tftacademy_data)
            # Determine which item types to show based on user question
            want_radiant = _is_radiant_query(user_question)
            want_artifact = _is_artifact_query(user_question)
            allowed_types = set()
            allowed_types.add("craftables")  # always show craftables
            if want_radiant:
                allowed_types.add("radiants")
            if want_artifact:
                allowed_types.add("artifacts")
                allowed_types.add("ornns")
            if has_types:
                current_type = None
                current_tier = None
                for item in tftacademy_data:
                    if _is_removed_item(item.get("name", "")):
                        continue
                    itype = item.get("item_type", "craftables")
                    if itype not in allowed_types:
                        continue
                    if itype != current_type:
                        current_type = itype
                        current_tier = None
                        if len(allowed_types) > 1:
                            parts.append(f"\n=== {type_labels.get(itype, itype)} ===")
                    tier = item.get("tier", "?")
                    if tier != current_tier:
                        current_tier = tier
                        parts.append(f"\n** {tier} Tier **")
                    name = item['name']
                    desc = ITEM_DESCRIPTIONS.get(name)
                    recipe = ITEM_RECIPES.get(name) if show_recipes else None
                    recipe_str = f" [Ghép: {recipe[0]} + {recipe[1]}]" if recipe else ""
                    if desc:
                        parts.append(f"  - {name}{recipe_str}: {desc}")
                    else:
                        parts.append(f"  - {name}{recipe_str}")
            else:
                current_tier = None
                for item in tftacademy_data:
                    if _is_removed_item(item.get("name", "")):
                        continue
                    # Filter radiant items from non-typed data by name
                    item_name = item.get("name", "")
                    is_radiant = "Ánh Sáng" in item_name or "Radiant" in item_name
                    if is_radiant and not want_radiant:
                        continue
                    tier = item.get("tier", "?")
                    if tier != current_tier:
                        current_tier = tier
                        parts.append(f"\n** {tier} Tier **")
                    name = item['name']
                    desc = ITEM_DESCRIPTIONS.get(name)
                    recipe = ITEM_RECIPES.get(name) if show_recipes else None
                    recipe_str = f" [Ghép: {recipe[0]} + {recipe[1]}]" if recipe else ""
                    if desc:
                        parts.append(f"  - {name}{recipe_str}: {desc}")
                    else:
                        parts.append(f"  - {name}{recipe_str}")
            parts.append("")

    elif content_type == MetaContentType.AUGMENTS:
        parts.append("=== DỮ LIỆU TIER LIST LÕI TFT (CẬP NHẬT TRỰC TIẾP) ===\n")
        if tftacademy_data:
            parts.append("--- Nguồn: tftacademy.com/tierlist/augments ---")
            current_tier = None
            for aug in tftacademy_data:
                tier = aug.get("tier", "?")
                if tier != current_tier:
                    current_tier = tier
                    parts.append(f"\n** {tier} Tier **")
                parts.append(f"  - {aug['name']}")
            parts.append("")

    if not tftacademy_data and not opgg_data:
        return ""
    return "\n".join(parts)


def format_recipe_table() -> str:
    """Generate a full item recipe reference table in Vietnamese."""
    parts = ["=== BẢNG CÔNG THỨC GHÉP TRANG BỊ DTCL MÙA 16 (nguồn: ggmeo.com) ===\n"]
    parts.append("--- Trang bị cơ bản (thành phần) ---")
    for api_name, vn_name in BASE_ITEMS.items():
        parts.append(f"  • {vn_name}")
    parts.append("")
    parts.append("--- Công thức ghép ---")
    for item_name, (comp1, comp2) in ITEM_RECIPES.items():
        desc = ITEM_DESCRIPTIONS.get(item_name, "")
        desc_str = f" — {desc}" if desc else ""
        parts.append(f"  • {item_name} = {comp1} + {comp2}{desc_str}")
    return "\n".join(parts)


def format_recipe_card(query: str, backend_base_url: str) -> Optional[str]:
    """Generate a visual recipe card with item images for a specific item query.
    Returns markdown string with inline images, or None if no item matched."""
    query_lower = query.lower()
    matched_item = None
    for item_name in ITEM_RECIPES:
        if item_name.lower() in query_lower:
            matched_item = item_name
            break
    if not matched_item:
        # Try fuzzy: strip diacritics for matching
        import unicodedata
        def _strip(s):
            s = s.lower().replace('đ', 'd').replace('Đ', 'D')
            return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()
        q_stripped = _strip(query)
        for item_name in ITEM_RECIPES:
            if _strip(item_name) in q_stripped:
                matched_item = item_name
                break
    if not matched_item:
        return None

    comp1, comp2 = ITEM_RECIPES[matched_item]
    desc = ITEM_DESCRIPTIONS.get(matched_item, "")
    base_url = backend_base_url.rstrip("/")

    def _img(name: str, size: str = "") -> str:
        img_file = ITEM_IMAGE_MAP.get(name, "")
        if img_file:
            return f"![{name}]({base_url}/image/{img_file})"
        return f"**{name}**"

    result_img = _img(matched_item)
    comp1_img = _img(comp1)
    comp2_img = _img(comp2)

    parts = [
        f"## 🔧 Cách ghép {matched_item}\n",
        f"Để ghép được **{matched_item}**, bạn cần các thành phần sau:\n",
        f"> {comp1_img} **{comp1}** + {comp2_img} **{comp2}**\n",
        f"### 📐 Công thức ghép:\n",
        f"> {result_img} **{matched_item}** = {comp1_img} {comp1} + {comp2_img} {comp2}\n",
    ]
    if desc:
        parts.append(f"### ⚡ Hiệu ứng của {matched_item}:\n")
        parts.append(f"- {desc}\n")

    return "\n".join(parts)


def _is_recipe_query(text: str) -> bool:
    """Check if user is specifically asking about item recipes/combinations."""
    text_lower = text.lower()
    recipe_patterns = [
        "ghép", "ghep", "công thức", "cong thuc", "recipe",
        "cách ghép", "cach ghep", "ghép đồ", "ghep do",
        "cần gì để", "can gi de", "làm từ", "lam tu",
        "thành phần", "thanh phan", "component",
        "ghép từ", "ghep tu", "ghép bằng", "ghep bang",
        "cách làm", "cach lam", "tạo từ", "tao tu",
    ]
    return any(p in text_lower for p in recipe_patterns)


def _is_radiant_query(text: str) -> bool:
    """Check if user is specifically asking about radiant items."""
    text_lower = text.lower()
    radiant_patterns = [
        "ánh sáng", "anh sang", "radiant",
    ]
    return any(p in text_lower for p in radiant_patterns)


def _is_artifact_query(text: str) -> bool:
    """Check if user is specifically asking about artifact/ornn items."""
    text_lower = text.lower()
    artifact_patterns = [
        "tạo tác", "tao tac", "artifact", "ornn",
        "hiện vật", "hien vat", "cổ vật", "co vat",
    ]
    return any(p in text_lower for p in artifact_patterns)


def get_cache() -> MetaCache:
    """Expose the module-level cache for external use."""
    return _meta_cache
