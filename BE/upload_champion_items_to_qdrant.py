"""
Upload champion-item recommendation data from op.gg into Qdrant.

Crawls https://op.gg/vi/tft/meta-trends/item, builds per-champion documents
with 3 best items + alternatives, then embeds and upserts to Qdrant.

Usage:
    cd BE
    python upload_champion_items_to_qdrant.py
"""
import asyncio
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

from agents.tft_meta_crawler import (
    scrape_opgg_champion_items,
    format_champion_items_context,
    ITEM_RECIPES,
    ITEM_DESCRIPTIONS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

VECTOR_NAME = "dense"
DOC_TYPE = "tft_champion_items"
SEASON = 17
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "opgg_champion_items.json")


def build_documents(champion_items: dict) -> list[Document]:
    """Convert champion → items mapping into LangChain Documents."""
    docs: list[Document] = []

    for champion, items in champion_items.items():
        if not items:
            continue

        # Filter out emblems
        emblem_keywords = ["ấn ", "vương miện chiến thuật", "siêu xẻng"]
        standard_items = [
            it for it in items
            if not any(kw in it["item_name"].lower() for kw in emblem_keywords)
        ]
        if not standard_items:
            standard_items = items

        # Score and sort items — prefer champion-specific stats when available
        def _score(it: dict) -> float:
            pos_score = (6 - it["champion_position"]) * 10
            avg_place = it.get("champion_avg_place", it["avg_place"])
            top4 = it.get("champion_top4_rate", it["top4_rate"])
            place_score = (6 - avg_place) * 15
            top4_score = top4 * 0.5
            game_bonus = min(it["games"] / 100000, 10)
            return pos_score + place_score + top4_score + game_bonus

        for it in standard_items:
            it["_score"] = _score(it)
        standard_items.sort(key=lambda x: -x["_score"])

        # Separate standard vs radiant
        radiant_kw = ["ánh sáng", "radiant"]
        normal = [it for it in standard_items if not any(kw in it["item_name"].lower() for kw in radiant_kw)]
        radiant = [it for it in standard_items if any(kw in it["item_name"].lower() for kw in radiant_kw)]

        best_3 = normal[:3]
        alternatives = normal[3:5]

        # Build rich document content
        lines = [
            f"Trang bị gợi ý cho {champion} trong DTCL mùa {SEASON} (nguồn: op.gg/vi/tft/meta-trends/item)",
            "",
            f"3 trang bị tối ưu (Best in Slot) cho {champion}:",
        ]

        item_names_best = []
        item_names_alt = []

        for idx, it in enumerate(best_3, 1):
            recipe = ITEM_RECIPES.get(it["item_name"])
            desc = ITEM_DESCRIPTIONS.get(it["item_name"], "")
            recipe_str = f" | Ghép: {recipe[0]} + {recipe[1]}" if recipe else ""
            desc_str = f" | {desc}" if desc else ""
            avg_p = it.get("champion_avg_place", it["avg_place"])
            top4 = it.get("champion_top4_rate", it["top4_rate"])
            lines.append(
                f"  {idx}. {it['item_name']}"
                f" — Avg place: #{avg_p:.2f}"
                f" | Top 4: {top4:.1f}%"
                f" | Games: {it['games']:,}"
                f"{recipe_str}{desc_str}"
            )
            item_names_best.append(it["item_name"])

        if alternatives:
            lines.append("")
            lines.append(f"Trang bị thay thế cho {champion}:")
            for it in alternatives:
                recipe = ITEM_RECIPES.get(it["item_name"])
                desc = ITEM_DESCRIPTIONS.get(it["item_name"], "")
                recipe_str = f" | Ghép: {recipe[0]} + {recipe[1]}" if recipe else ""
                desc_str = f" | {desc}" if desc else ""
                avg_p = it.get("champion_avg_place", it["avg_place"])
                top4 = it.get("champion_top4_rate", it["top4_rate"])
                lines.append(
                    f"  • {it['item_name']}"
                    f" — Avg place: #{avg_p:.2f}"
                    f" | Top 4: {top4:.1f}%"
                    f"{recipe_str}{desc_str}"
                )
                item_names_alt.append(it["item_name"])

        if radiant:
            lines.append("")
            lines.append(f"Phiên bản Ánh Sáng cho {champion}:")
            for it in radiant[:2]:
                lines.append(
                    f"  ✦ {it['item_name']}"
                    f" — Avg place: #{it['avg_place']:.2f}"
                    f" | Top 4: {it['top4_rate']:.1f}%"
                )

        content = "\n".join(lines)

        docs.append(Document(
            page_content=content,
            metadata={
                "source": "https://op.gg/vi/tft/meta-trends/item",
                "doc_type": DOC_TYPE,
                "champion_name": champion,
                "best_items": item_names_best,
                "alt_items": item_names_alt,
                "total_items": len(items),
                "season": SEASON,
            },
        ))

    # Summary document: all champions and their best items
    summary_lines = [
        f"Bảng tổng hợp trang bị gợi ý cho tất cả tướng DTCL mùa {SEASON} (op.gg):\n"
    ]
    for champion in sorted(champion_items.keys()):
        items = champion_items[champion]
        emblem_keywords = ["ấn ", "vương miện chiến thuật", "siêu xẻng"]
        radiant_kw = ["ánh sáng", "radiant"]
        normal = [
            it for it in items
            if not any(kw in it["item_name"].lower() for kw in emblem_keywords)
            and not any(kw in it["item_name"].lower() for kw in radiant_kw)
        ]
        if not normal:
            normal = items
        top3 = sorted(normal, key=lambda x: x["champion_position"])[:3]
        item_str = ", ".join(it["item_name"] for it in top3)
        summary_lines.append(f"  {champion}: {item_str}")

    docs.append(Document(
        page_content="\n".join(summary_lines),
        metadata={
            "source": "https://op.gg/vi/tft/meta-trends/item",
            "doc_type": DOC_TYPE,
            "champion_name": "__summary__",
            "season": SEASON,
        },
    ))

    return docs


def main():
    logger.info("Crawling op.gg item page for champion-item data...")
    champion_items = asyncio.run(scrape_opgg_champion_items())

    if not champion_items:
        logger.error("No champion-item data crawled. Aborting.")
        return

    logger.info("Crawled data for %d champions", len(champion_items))

    # Save raw data locally
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(champion_items, f, ensure_ascii=False, indent=2)
    logger.info("Saved raw data to %s", DATA_PATH)

    # Build documents
    docs = build_documents(champion_items)
    logger.info("Created %d documents", len(docs))

    # Connect to Qdrant
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
                    distance=qdrant_models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "sparse": qdrant_models.SparseVectorParams(
                    index=qdrant_models.SparseIndexParams(on_disk=True)
                )
            },
        )
        logger.info("Created collection '%s'.", collection_name)

    # Delete old champion_items points before re-uploading
    logger.info("Removing old %s points...", DOC_TYPE)
    try:
        client.delete(
            collection_name=collection_name,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="metadata.doc_type",
                            match=qdrant_models.MatchValue(value=DOC_TYPE),
                        )
                    ]
                )
            ),
        )
        logger.info("Old %s points removed.", DOC_TYPE)
    except Exception as e:
        logger.warning("Could not delete old points (may not exist yet): %s", e)

    # Build vector store + embeddings
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

    # Upload
    logger.info("Uploading %d documents to Qdrant...", len(docs))
    ids = vector_store.add_documents(docs)
    logger.info("Successfully uploaded %d documents.", len(ids))

    # Verify
    info = client.get_collection(collection_name)
    logger.info("Collection '%s' now has %d points.", collection_name, info.points_count)
    print(f"\n✓ Done! {len(ids)} champion-item documents uploaded to '{collection_name}'.")
    print(f"  Champions: {len(champion_items)}")
    print(f"  Documents: {len(docs)} (per-champion + 1 summary)")


if __name__ == "__main__":
    main()
