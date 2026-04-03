"""
Upload OP.GG TFT item meta-trend data into Qdrant.

Each item becomes a Document with stats (avg place, top4 rate, pick rate, games)
and top champion names. No detailed champion data is stored.

Usage:
    cd BE
    python upload_opgg_items_to_qdrant.py
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
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "opgg_items_meta.json")


def load_data(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_documents(data: dict) -> list[Document]:
    """Convert OP.GG item meta JSON into LangChain Documents."""
    docs: list[Document] = []
    source = data["source"]
    season = data["season"]

    for item in data["items"]:
        champ_names = [c["name"] for c in item.get("top_champions", [])]
        champs_text = ", ".join(champ_names) if champ_names else "Không có dữ liệu"

        games = item.get("games") or 0
        content = (
            f"Trang bị DTCL mùa {season} (meta OP.GG): {item['name']}\n"
            f"Xếp hạng phổ biến: #{item['rank']}\n"
            f"Vị trí trung bình: #{item.get('avg_place', 'N/A')}\n"
            f"Tỉ lệ top 4: {item.get('top4_rate', 'N/A')}%\n"
            f"Tỉ lệ chọn: {item.get('pick_rate', 'N/A')}%\n"
            f"Số trận: {games:,}\n"
            f"Top tướng dùng tốt nhất: {champs_text}\n"
            f"Hình ảnh: {item['image_url']}"
        )

        docs.append(Document(
            page_content=content,
            metadata={
                "source": source,
                "doc_type": "tft_item_meta",
                "item_name": item["name"],
                "item_rank": item["rank"],
                "avg_place": item.get("avg_place") or 0,
                "top4_rate": item.get("top4_rate") or 0,
                "pick_rate": item.get("pick_rate") or 0,
                "games": games,
                "image_url": item["image_url"],
                "image_file": item.get("image_file", ""),
                "top_champions": champ_names,
                "season": season,
            },
        ))

    # --- Summary document: ranked item list ---
    summary_lines = [f"Bảng xếp hạng trang bị DTCL mùa {season} theo meta OP.GG:\n"]
    for item in data["items"]:
        champ_names = [c["name"] for c in item.get("top_champions", [])]
        champs_str = ", ".join(champ_names[:3]) if champ_names else ""
        g = item.get('games') or 0
        summary_lines.append(
            f"#{item['rank']} {item['name']} — "
            f"Avg #{item.get('avg_place', 'N/A')}, Top4 {item.get('top4_rate', 'N/A')}%, "
            f"Pick {item.get('pick_rate', 'N/A')}% ({g:,} trận)"
            + (f" | Tướng: {champs_str}" if champs_str else "")
        )
    docs.append(Document(
        page_content="\n".join(summary_lines),
        metadata={
            "source": source,
            "doc_type": "tft_item_meta",
            "item_type": "ranking_summary",
            "season": season,
        },
    ))

    return docs


def main():
    logger.info("Loading OP.GG items data from %s", DATA_PATH)
    data = load_data(DATA_PATH)
    logger.info("Loaded %d items", data["total_items"])

    docs = build_documents(data)
    logger.info("Created %d documents", len(docs))

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

    # --- Delete old opgg item meta points before re-uploading ---
    logger.info("Removing old tft_item_meta points...")
    try:
        client.delete(
            collection_name=collection_name,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="metadata.doc_type",
                            match=qdrant_models.MatchValue(value="tft_item_meta"),
                        )
                    ]
                )
            ),
        )
        logger.info("Old tft_item_meta points removed.")
    except Exception as e:
        logger.warning("Could not delete old points (may not exist yet): %s", e)

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
    logger.info("Successfully uploaded %d documents.", len(ids))

    # Verify
    info = client.get_collection(collection_name)
    logger.info("Collection '%s' now has %d points.", collection_name, info.points_count)
    print(f"\nDone! {len(ids)} documents uploaded to '{collection_name}'.")


if __name__ == "__main__":
    main()
