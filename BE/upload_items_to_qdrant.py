"""
Upload TFT items data from tft_items_dtcl_s16.json into Qdrant.

Each item becomes a Document with rich text content suitable for RAG retrieval,
then gets embedded (OpenAI text-embedding-ada-002) and upserted via langchain-qdrant.

Usage:
    cd BE
    python upload_items_to_qdrant.py
"""
import json
import logging
import sys
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
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "tft_items_dtcl_s16.json")


def load_items(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_documents(data: dict) -> list[Document]:
    """Convert items JSON into LangChain Documents for ingestion."""
    docs: list[Document] = []

    # --- 1. Base component documents ---
    for comp in data["base_components"]:
        content = (
            f"Trang bị cơ bản DTCL mùa {data['season']}: {comp['name']} ({comp['name_en']})\n"
            f"Loại: Trang bị nguyên liệu / thành phần cơ bản\n"
            f"Chỉ số: {comp['stat']}\n"
            f"Item ID: {comp['item_id']}\n"
            f"Hình ảnh: {comp['image']}"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "source": data["source"],
                "doc_type": "tft_item",
                "item_type": "base_component",
                "item_name": comp["name"],
                "item_name_en": comp["name_en"],
                "item_id": comp["item_id"],
                "image_url": comp["image"],
                "season": data["season"],
            }
        ))

    # --- 2. Combined item documents ---
    for item in data["combined_items"]:
        recipe_text = " + ".join(item["recipe_vn"])
        content = (
            f"Trang bị ghép DTCL mùa {data['season']}: {item['name']} ({item.get('name_en', '')})\n"
            f"Cách ghép: {recipe_text}\n"
            f"Công thức: {item['recipe_vn'][0]} + {item['recipe_vn'][1]} = {item['name']}\n"
            f"Hiệu ứng: {item['description']}\n"
            f"Item ID: {item['item_id']}\n"
            f"Hình ảnh: {item['image']}"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "source": item.get("url", data["source"]),
                "doc_type": "tft_item",
                "item_type": "combined_item",
                "item_name": item["name"],
                "item_name_en": item.get("name_en", ""),
                "item_id": item["item_id"],
                "image_url": item["image"],
                "recipe_component_1": item["recipe_vn"][0],
                "recipe_component_2": item["recipe_vn"][1],
                "season": data["season"],
            }
        ))

    # --- 3. Full combination table document (for "bảng ghép đồ" queries) ---
    table = data["combination_table"]
    headers = table["headers"]
    grid = table["grid"]
    lines = [
        f"Bảng ghép đồ trang bị DTCL mùa {data['season']} (TFT Set {data['season']})\n",
        "Cách đọc: Hàng = nguyên liệu 1, Cột = nguyên liệu 2, Ô = trang bị ghép ra.\n",
    ]
    # Header row
    lines.append("| |" + "|".join(headers) + "|")
    lines.append("|" + "---|" * (len(headers) + 1))
    for i, row in enumerate(grid):
        lines.append(f"|{headers[i]}|" + "|".join(row) + "|")
    combo_table_text = "\n".join(lines)

    docs.append(Document(
        page_content=combo_table_text,
        metadata={
            "source": data["source"],
            "doc_type": "tft_item",
            "item_type": "combination_table",
            "season": data["season"],
        }
    ))

    # --- 4. Quick-lookup recipe list (condensed) ---
    recipe_lines = [f"Danh sách công thức ghép đồ DTCL mùa {data['season']}:\n"]
    for item in data["combined_items"]:
        recipe_lines.append(
            f"- {item['recipe_vn'][0]} + {item['recipe_vn'][1]} = {item['name']}"
        )
    docs.append(Document(
        page_content="\n".join(recipe_lines),
        metadata={
            "source": data["source"],
            "doc_type": "tft_item",
            "item_type": "recipe_list",
            "season": data["season"],
        }
    ))

    return docs


def main():
    logger.info("Loading items data from %s", DATA_PATH)
    data = load_items(DATA_PATH)

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
                    size=1536,  # text-embedding-ada-002 dimension
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
