"""
Delete old Season 16 data from Qdrant collection.
Removes: tft_item, tft_item_meta, and patch notes documents.

Usage:
    cd BE
    python cleanup_s16_qdrant.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

QDRANT_HOST = os.getenv("QDRANT_HOST", "10.1.12.165")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "tài liệu TFT")

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# Check collection exists
collections = [c.name for c in client.get_collections().collections]
if COLLECTION_NAME not in collections:
    print(f"[ERROR] Collection '{COLLECTION_NAME}' not found!")
    sys.exit(1)

info = client.get_collection(COLLECTION_NAME)
print(f"Collection '{COLLECTION_NAME}' has {info.points_count} points before cleanup.\n")

# --- 1. Delete tft_item (S16 items data) ---
print("[1/3] Deleting old tft_item points...")
try:
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qdrant_models.FilterSelector(
            filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="metadata.doc_type",
                        match=qdrant_models.MatchValue(value="tft_item"),
                    )
                ]
            )
        ),
    )
    print("   Done.")
except Exception as e:
    print(f"   Warning: {e}")

# --- 2. Delete tft_item_meta (OP.GG meta data) ---
print("[2/3] Deleting old tft_item_meta points...")
try:
    client.delete(
        collection_name=COLLECTION_NAME,
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
    print("   Done.")
except Exception as e:
    print(f"   Warning: {e}")

# --- 3. Delete patch notes (source = tft_patch_16_6_official.txt) ---
print("[3/3] Deleting old patch 16.6 notes...")
try:
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qdrant_models.FilterSelector(
            filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="metadata.source",
                        match=qdrant_models.MatchValue(value="tft_patch_16_6_official.txt"),
                    )
                ]
            )
        ),
    )
    print("   Done.")
except Exception as e:
    print(f"   Warning: {e}")

info = client.get_collection(COLLECTION_NAME)
print(f"\nCollection '{COLLECTION_NAME}' has {info.points_count} points after cleanup.")
print("S16 data removed successfully!")
