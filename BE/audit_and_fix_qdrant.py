"""
audit_and_fix_qdrant.py
=======================
Script tối ưu toàn diện Qdrant:
1. Kiểm tra tổng số points theo doc_type
2. Xóa SẠCH tất cả chunk traits cũ (tft_trait, tft_champion_trait)
3. Re-upload toàn bộ từ file JSON đã cập nhật
4. Kiểm tra lại sau upload — tìm champion sai tộc/hệ
5. Report tổng kết

Usage:
    cd BE
    python audit_and_fix_qdrant.py
"""
import json
import logging
import os
import sys

from dotenv import load_dotenv
load_dotenv()

import config
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("audit_qdrant.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)

VECTOR_NAME = "dense"
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "tft_traits_dtcl_s17.json")


# ─────────────────────────────────────────────────────────────
# STEP 1: Audit — đếm points theo doc_type
# ─────────────────────────────────────────────────────────────
def audit_collection(client: QdrantClient, collection_name: str):
    logger.info("=" * 60)
    logger.info("AUDIT: Kiểm tra collection '%s'", collection_name)
    
    info = client.get_collection(collection_name)
    total = info.points_count
    logger.info("Tổng số points: %d", total)

    # Đếm theo doc_type
    doc_types = [
        "tft_trait", "tft_champion_trait",
        "tft_meta_comp", "tft_meta_comp_carry",
        "tft_item", "tft_champion_items", "tft_opgg_item",
    ]
    counts = {}
    for dt in doc_types:
        try:
            result = client.count(
                collection_name=collection_name,
                count_filter=qdrant_models.Filter(
                    must=[qdrant_models.FieldCondition(
                        key="metadata.doc_type",
                        match=qdrant_models.MatchValue(value=dt)
                    )]
                ),
                exact=True,
            )
            counts[dt] = result.count
        except Exception as e:
            counts[dt] = f"ERROR: {e}"

    logger.info("Phân bố theo doc_type:")
    for dt, cnt in counts.items():
        logger.info("  %-30s : %s", dt, cnt)

    # Tìm điểm không có metadata.doc_type (orphan)
    try:
        orphan = client.count(
            collection_name=collection_name,
            count_filter=qdrant_models.Filter(
                must_not=[
                    qdrant_models.HasIdCondition(has_id=[])  # trick để lấy tất cả
                ] if False else [],
                should=[
                    qdrant_models.IsNullCondition(is_null=qdrant_models.PayloadField(key="metadata.doc_type"))
                ]
            ),
            exact=True,
        )
        logger.info("  %-30s : %d", "ORPHAN (no doc_type)", orphan.count)
    except Exception as e:
        logger.warning("Không thể đếm orphan: %s", e)

    return counts


# ─────────────────────────────────────────────────────────────
# STEP 2: Xóa sạch chunk traits cũ
# ─────────────────────────────────────────────────────────────
def delete_trait_docs(client: QdrantClient, collection_name: str):
    logger.info("=" * 60)
    logger.info("DELETE: Xóa toàn bộ chunk tft_trait và tft_champion_trait...")
    
    for doc_type in ["tft_trait", "tft_champion_trait"]:
        try:
            result = client.delete(
                collection_name=collection_name,
                points_selector=qdrant_models.FilterSelector(
                    filter=qdrant_models.Filter(
                        must=[qdrant_models.FieldCondition(
                            key="metadata.doc_type",
                            match=qdrant_models.MatchValue(value=doc_type)
                        )]
                    )
                ),
                wait=True,
            )
            logger.info("Đã xóa doc_type='%s': %s", doc_type, result)
        except Exception as e:
            logger.error("Lỗi khi xóa doc_type='%s': %s", doc_type, e)


# ─────────────────────────────────────────────────────────────
# STEP 3: Build documents từ JSON (giống upload_traits_s17_to_qdrant.py)
# ─────────────────────────────────────────────────────────────
def build_documents(data: dict) -> list[Document]:
    docs: list[Document] = []
    season = data["season"]
    season_name = data["season_name"]
    source = data["source"]

    # Per-trait documents
    for trait in data["traits"]:
        champ_list = ", ".join(
            f"{c['name']} ({c['cost']} vàng)" for c in trait["champions"]
        )
        champ_names_only = ", ".join(c["name"] for c in trait["champions"])
        tier_lines = "\n".join(
            f"  ({t['count']}): {t['effect']}" for t in trait["bonus"]["tiers"]
        )
        bonus = trait["bonus"]
        extra_lines = []
        for key in ("team_passive", "trait_passive", "special", "on_kill"):
            if key in bonus:
                extra_lines.append(bonus[key])
        extra_text = "\n".join(extra_lines)

        content = (
            f"Tộc/Hệ DTCL mùa {season} ({season_name}): {trait['name']} ({trait['name_en']})\n"
            f"Loại: {trait['type']}\n"
            f"Mô tả: {trait['description']}\n"
            f"Tướng: {champ_list}\n"
            f"Danh sách tướng: {champ_names_only}\n"
        )
        if extra_text:
            content += f"Hiệu ứng bổ sung: {extra_text}\n"
        content += f"Mốc kích hoạt:\n{tier_lines}"

        docs.append(Document(
            page_content=content,
            metadata={
                "source": source,
                "doc_type": "tft_trait",
                "trait_name": trait["name"],
                "trait_name_en": trait["name_en"],
                "trait_type": trait["type"],
                "season": season,
                "champion_count": len(trait["champions"]),
                "champions": champ_names_only,
            }
        ))

    # Unique traits
    for st in data.get("unique_traits", data.get("special_5cost_traits", [])):
        cost = st.get("cost", 5)
        content = (
            f"Tộc/Hệ duy nhất DTCL mùa {season} ({season_name}): "
            f"{st['name']} ({st['name_en']})\n"
            f"Tướng: {st['champion']} ({cost} vàng)\n"
            f"Hiệu ứng: {st['effect']}"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "source": source,
                "doc_type": "tft_trait",
                "trait_name": st["name"],
                "trait_name_en": st["name_en"],
                "trait_type": "Tộc/Hệ duy nhất",
                "season": season,
                "champion_count": 1,
                "champions": st["champion"],
            }
        ))

    # Full summary
    trait_summary_lines = [f"Danh sách tất cả tộc/hệ DTCL mùa {season} ({season_name}):\n"]
    for trait in data["traits"]:
        champ_names = ", ".join(c["name"] for c in trait["champions"])
        trait_summary_lines.append(
            f"- {trait['name']} ({trait['name_en']}) [{trait['type']}]: {champ_names}"
        )
    trait_summary_lines.append("\nTộc/Hệ duy nhất (gắn liền với 1 tướng):")
    for st in data.get("unique_traits", data.get("special_5cost_traits", [])):
        cost = st.get("cost", 5)
        trait_summary_lines.append(
            f"- {st['name']} ({st['name_en']}): {st['champion']} ({cost} vàng)"
        )
    docs.append(Document(
        page_content="\n".join(trait_summary_lines),
        metadata={
            "source": source,
            "doc_type": "tft_trait",
            "trait_type": "summary",
            "season": season,
        }
    ))

    # Per-cost summaries
    all_champs: dict[str, dict] = {}
    for trait in data["traits"]:
        for c in trait["champions"]:
            name = c["name"]
            if name not in all_champs:
                all_champs[name] = {
                    "cost": c["cost"],
                    "traits": [],
                    "skill": c.get("chieu_thuc", {}).get("ten_chieu", ""),
                }
            all_champs[name]["traits"].append(trait["name"])
            if not all_champs[name]["skill"] and c.get("chieu_thuc"):
                all_champs[name]["skill"] = c["chieu_thuc"]["ten_chieu"]
    for st in data.get("unique_traits", data.get("special_5cost_traits", [])):
        name = st["champion"]
        if name not in all_champs:
            all_champs[name] = {
                "cost": st.get("cost", 5),
                "traits": [],
                "skill": st.get("chieu_thuc", {}).get("ten_chieu", ""),
            }
        all_champs[name]["traits"].append(st["name"])

    for cost in [1, 2, 3, 4, 5]:
        champs_at_cost = {n: v for n, v in all_champs.items() if v["cost"] == cost}
        lines = [f"Danh sách tất cả tướng {cost} vàng DTCL mùa {season} ({season_name}) — tổng cộng {len(champs_at_cost)} tướng:\n"]
        for name, info in sorted(champs_at_cost.items()):
            traits_str = ", ".join(info["traits"])
            skill_str = f" — Chiêu: {info['skill']}" if info["skill"] else ""
            lines.append(f"- {name} ({cost} vàng): {traits_str}{skill_str}")
        docs.append(Document(
            page_content="\n".join(lines),
            metadata={
                "source": source,
                "doc_type": "tft_trait",
                "trait_type": f"cost_{cost}_summary",
                "season": season,
                "cost": cost,
                "champion_count": len(champs_at_cost),
            }
        ))

    full_lines = [f"Tổng hợp toàn bộ tướng DTCL mùa {season} ({season_name}) theo giá vàng — tổng cộng {len(all_champs)} tướng:\n"]
    for cost in [1, 2, 3, 4, 5]:
        champs_at_cost = sorted([n for n, v in all_champs.items() if v["cost"] == cost])
        full_lines.append(f"Tướng {cost} vàng ({len(champs_at_cost)} tướng): {', '.join(champs_at_cost)}")
    docs.append(Document(
        page_content="\n".join(full_lines),
        metadata={
            "source": source,
            "doc_type": "tft_trait",
            "trait_type": "all_cost_summary",
            "season": season,
            "champion_count": len(all_champs),
        }
    ))

    # Per-champion documents
    champion_info: dict[str, dict] = {}
    for trait in data["traits"]:
        for champ in trait["champions"]:
            name = champ["name"]
            if name not in champion_info:
                champion_info[name] = {"cost": champ["cost"], "traits": [], "skill": champ.get("chieu_thuc")}
            # Chỉ thêm nếu chưa có tộc này (tránh duplicate do tướng xuất hiện nhiều lần)
            trait_label = f"{trait['name']} ({trait['name_en']})"
            if trait_label not in champion_info[name]["traits"]:
                champion_info[name]["traits"].append(trait_label)
            if not champion_info[name]["skill"] and champ.get("chieu_thuc"):
                champion_info[name]["skill"] = champ["chieu_thuc"]

    unique_effects: dict[str, str] = {}
    for st in data.get("unique_traits", data.get("special_5cost_traits", [])):
        name = st["champion"]
        champion_info.setdefault(name, {"cost": st.get("cost", 5), "traits": [], "skill": None})
        trait_label = f"{st['name']} ({st['name_en']})"
        if trait_label not in champion_info[name]["traits"]:
            champion_info[name]["traits"].append(trait_label)
        unique_effects[name] = f"{st['name']} ({st['name_en']}): {st['effect']}"
        if not champion_info[name]["skill"] and st.get("chieu_thuc"):
            champion_info[name]["skill"] = st["chieu_thuc"]

    for champ_name, info in champion_info.items():
        traits_text = ", ".join(info["traits"])
        content = (
            f"Tướng DTCL mùa {season} ({season_name}): {champ_name}\n"
            f"Giá: {info['cost']} vàng\n"
            f"Thuộc tộc/hệ: {traits_text}\n"
        )
        skill = info.get("skill")
        if skill:
            content += f"Chiêu thức: {skill['ten_chieu']}\n"
            if "noi_tai" in skill:
                content += f"Nội tại: {skill['noi_tai']}\n"
            if "kich_hoat" in skill:
                content += f"Kích hoạt: {skill['kich_hoat']}\n"
        if champ_name in unique_effects:
            content += f"Tộc/Hệ duy nhất: {unique_effects[champ_name]}\n"

        docs.append(Document(
            page_content=content.strip(),
            metadata={
                "source": source,
                "doc_type": "tft_champion_trait",
                "champion_name": champ_name,
                "season": season,
                "cost": info["cost"],
                "traits": traits_text,
                "skill_name": skill["ten_chieu"] if skill else "",
            }
        ))

    return docs, all_champs, champion_info


# ─────────────────────────────────────────────────────────────
# STEP 4: Validate dữ liệu trước khi upload
# ─────────────────────────────────────────────────────────────
def validate_data(data: dict, champion_info: dict, all_champs: dict):
    logger.info("=" * 60)
    logger.info("VALIDATE: Kiểm tra tính nhất quán dữ liệu...")
    issues = []

    # 1. Tướng xuất hiện nhiều lần trong cùng 1 tộc
    for trait in data["traits"]:
        seen = []
        for c in trait["champions"]:
            if c["name"] in seen:
                issues.append(f"[DUPLICATE] {c['name']} xuất hiện 2+ lần trong tộc '{trait['name']}'")
            seen.append(c["name"])

    # 2. Kiểm tra cost nhất quán (cùng tướng, cost khác nhau ở tộc khác)
    cost_map: dict[str, list[tuple]] = {}
    for trait in data["traits"]:
        for c in trait["champions"]:
            cost_map.setdefault(c["name"], []).append((c["cost"], trait["name"]))
    for name, entries in cost_map.items():
        costs = set(e[0] for e in entries)
        if len(costs) > 1:
            detail = ", ".join(f"{t}: {cost} vàng" for cost, t in entries)
            issues.append(f"[COST_MISMATCH] {name} có cost khác nhau: {detail}")

    # 3. Kiểm tra danh sách tướng theo metatft (known correct data)
    KNOWN_TRAITS = {
        "Kai'Sa": ["Hắc Tinh", "Vô Pháp"],
        "Blitzcrank": ["Hành Tinh", "Tiên Phong", "Tiệc Tùng"],
        "Nami": ["Hành Tinh", "Nhân Bản"],
        "Ornn": ["Hành Tinh", "Can Trường"],
        "Samira": ["Hành Tinh", "Bắn Tỉa"],
        "Fizz": ["Tinh Linh Chuông", "Vô Pháp"],
        "Gnar": ["Tinh Linh Chuông", "Bắn Tỉa"],
        "Corki": ["Tinh Linh Chuông", "Định Mệnh"],
        "Jhin": ["Hắc Tinh", "Bắn Tỉa", "Hủy Diệt"],
        "Karma": ["Hắc Tinh", "Viễn Chinh"],
        "Riven": ["Thời Không", "Vô Pháp"],
        "Akali": ["N.O.V.A.", "Toán Cướp"],
        "Gwen": ["Hành Tinh", "Vô Pháp"],
        "Teemo": ["Hành Tinh", "Du Mục"],
        "Nasus": ["Hành Tinh", "Tiên Phong"],
        "Mordekaiser": ["Hắc Tinh", "Tiên Phong", "Dẫn Truyền"],
    }

    for champ_name, expected_traits in KNOWN_TRAITS.items():
        if champ_name not in all_champs:
            issues.append(f"[MISSING_CHAMP] {champ_name} không có trong dữ liệu!")
            continue
        actual_traits = all_champs[champ_name]["traits"]
        for expected in expected_traits:
            if expected not in actual_traits:
                issues.append(
                    f"[WRONG_TRAIT] {champ_name}: thiếu tộc/hệ '{expected}' "
                    f"(hiện có: {', '.join(actual_traits)})"
                )

    if not issues:
        logger.info("  Không phát hiện vấn đề! Dữ liệu nhất quán.")
    else:
        logger.warning("  Phát hiện %d vấn đề:", len(issues))
        for issue in issues:
            logger.warning("  %s", issue)

    return issues


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    logger.info("=" * 60)
    logger.info("AUDIT & FIX QDRANT — Bắt đầu")
    logger.info("=" * 60)

    # Load dữ liệu
    logger.info("Đọc file: %s", DATA_PATH)
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build documents + validate
    docs, all_champs, champion_info = build_documents(data)
    logger.info("Tổng documents sẽ upload: %d", len(docs))

    issues = validate_data(data, champion_info, all_champs)
    if issues:
        print(f"[WARN] {len(issues)} issues found in data (see audit_qdrant.log for details)")
        for issue in issues:
            print(f"  WARN: {issue}")
        print("[INFO] Continuing with upload despite warnings...")

    # Kết nối Qdrant
    collection_name = config.QDRANT_COLLECTION_NAME
    client = QdrantClient(
        host=config.QDRANT_HOST,
        port=config.QDRANT_PORT,
        api_key=config.QDRANT_API_KEY if config.QDRANT_API_KEY else None,
    )

    # Audit trước
    counts_before = audit_collection(client, collection_name)

    # Xóa chunk cũ
    delete_trait_docs(client, collection_name)

    # Upload mới
    logger.info("=" * 60)
    logger.info("UPLOAD: Đang upload %d documents...", len(docs))
    
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
    ids = vector_store.add_documents(docs)
    logger.info("Upload thành công %d documents.", len(ids))

    # Audit sau
    counts_after = audit_collection(client, collection_name)

    # Summary
    logger.info("=" * 60)
    logger.info("SUMMARY:")
    logger.info("  Traits trước: %s | sau: %s", counts_before.get("tft_trait"), counts_after.get("tft_trait"))
    logger.info("  Champion traits trước: %s | sau: %s", counts_before.get("tft_champion_trait"), counts_after.get("tft_champion_trait"))
    logger.info("  Tổng documents upload: %d", len(ids))
    logger.info("  Tổng tướng trong dữ liệu: %d", len(champion_info))
    logger.info("  Tổng tộc/hệ: %d (+ %d duy nhất)",
                len(data["traits"]),
                len(data.get("unique_traits", [])))
    logger.info("DONE!")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
