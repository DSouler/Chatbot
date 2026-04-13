"""
Upload TFT Season 17 traits data from tft_traits_dtcl_s17.json into Qdrant.

Each trait becomes a Document with champion list, tier bonuses, and description
suitable for RAG retrieval.

Usage:
    cd BE
    python upload_traits_s17_to_qdrant.py
"""
import json
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
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "tft_traits_dtcl_s17.json")


def load_data(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_documents(data: dict) -> list[Document]:
    """Convert traits JSON into LangChain Documents for ingestion."""
    docs: list[Document] = []
    season = data["season"]
    season_name = data["season_name"]
    source = data["source"]

    # --- 1. Per-trait documents ---
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
                extra_lines.append(f"{bonus[key]}")
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

    # --- 2. Unique traits (per-champion) ---
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

    # --- 3. Full summary document (for "tộc hệ mùa 17 là gì" queries) ---
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

    # --- 3b. Champions grouped by cost (for "tướng 5 vàng / 4 vàng gồm ai" queries) ---
    # Collect all champions with cost + traits + skill name
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
        if not all_champs[name]["skill"] and st.get("chieu_thuc"):
            all_champs[name]["skill"] = st["chieu_thuc"]["ten_chieu"]

    # Per-cost summary document
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

    # Full champion list by cost (single document)
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

    # --- 4. Per-champion document with traits, cost, skill (for "tướng X thuộc tộc hệ gì / chiêu gì" queries) ---
    champion_info: dict[str, dict] = {}
    for trait in data["traits"]:
        for champ in trait["champions"]:
            name = champ["name"]
            if name not in champion_info:
                champion_info[name] = {"cost": champ["cost"], "traits": [], "skill": champ.get("chieu_thuc")}
            champion_info[name]["traits"].append(f"{trait['name']} ({trait['name_en']})")
            # Take skill from whichever trait entry has it
            if not champion_info[name]["skill"] and champ.get("chieu_thuc"):
                champion_info[name]["skill"] = champ["chieu_thuc"]
    # Add unique traits
    unique_effects: dict[str, str] = {}
    for st in data.get("unique_traits", data.get("special_5cost_traits", [])):
        name = st["champion"]
        champion_info.setdefault(name, {"cost": st.get("cost", 5), "traits": [], "skill": None})
        champion_info[name]["traits"].append(f"{st['name']} ({st['name_en']})")
        unique_effects[name] = f"{st['name']} ({st['name_en']}): {st['effect']}"
        # Pick up skill from unique_traits if champion has no skill yet
        if not champion_info[name]["skill"] and st.get("chieu_thuc"):
            champion_info[name]["skill"] = st["chieu_thuc"]

    for champ_name, info in champion_info.items():
        traits_text = ", ".join(info["traits"])
        content = (
            f"Tướng DTCL mùa {season} ({season_name}): {champ_name}\n"
            f"Giá: {info['cost']} vàng\n"
            f"Thuộc tộc/hệ: {traits_text}\n"
        )
        # Add skill info
        skill = info.get("skill")
        if skill:
            content += f"Chiêu thức: {skill['ten_chieu']}\n"
            if "noi_tai" in skill:
                content += f"Nội tại: {skill['noi_tai']}\n"
            if "kich_hoat" in skill:
                content += f"Kích hoạt: {skill['kich_hoat']}\n"
        # Add unique trait effect
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

    return docs


def main():
    logger.info("Loading traits data from %s", DATA_PATH)
    data = load_data(DATA_PATH)

    logger.info("Building documents...")
    docs = build_documents(data)
    logger.info("Created %d documents", len(docs))

    # --- Connect to Qdrant ---
    collection_name = config.QDRANT_COLLECTION_NAME
    logger.info("Connecting to Qdrant at %s:%s, collection=%s",
                config.QDRANT_HOST, config.QDRANT_PORT, collection_name)

    client = QdrantClient(
        host=config.QDRANT_HOST,
        port=config.QDRANT_PORT,
        api_key=config.QDRANT_API_KEY if config.QDRANT_API_KEY else None,
    )

    # Ensure collection exists
    try:
        client.get_collection(collection_name)
        logger.info("Collection '%s' already exists.", collection_name)
    except Exception:
        logger.info("Collection '%s' not found, creating...", collection_name)
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
        logger.info("Created collection '%s'.", collection_name)

    # --- Build vector store + embeddings ---
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

    # --- Upload ---
    logger.info("Uploading %d documents to Qdrant...", len(docs))
    ids = vector_store.add_documents(docs)
    logger.info("Successfully uploaded %d documents. IDs: %s ... %s",
                len(ids), ids[:3], ids[-1] if ids else "")

    # Verify
    info = client.get_collection(collection_name)
    logger.info("Collection '%s' now has %d points.",
                collection_name, info.points_count)

    print(f"\nDone! {len(ids)} documents uploaded to Qdrant collection '{collection_name}'.")


if __name__ == "__main__":
    main()
