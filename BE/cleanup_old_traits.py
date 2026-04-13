"""
Delete old tft_trait and tft_champion_trait documents from Qdrant, keeping only the latest upload.

Usage: python cleanup_old_traits.py
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
import config

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

client = QdrantClient(
    host=config.QDRANT_HOST,
    port=config.QDRANT_PORT,
    api_key=config.QDRANT_API_KEY if config.QDRANT_API_KEY else None,
)

collection_name = config.QDRANT_COLLECTION_NAME
info = client.get_collection(collection_name)
print(f"Before: {info.points_count} total points")

# Count tft_trait and tft_champion_trait docs (uploaded by upload_traits_s17_to_qdrant)
for doc_type in ["tft_trait", "tft_champion_trait"]:
    result = client.count(
        collection_name=collection_name,
        count_filter=qdrant_models.Filter(
            must=[qdrant_models.FieldCondition(
                key="metadata.doc_type",
                match=qdrant_models.MatchValue(value=doc_type)
            )]
        ),
        exact=True,
    )
    print(f"  {doc_type}: {result.count} points")

# We need to keep only the 99 latest ones - but without IDs we can't easily tell which.
# Instead, delete ALL tft_trait and tft_champion_trait, then verify new 99 are gone, re-upload.
# Better approach: delete all, then re-upload.

print("\nDeleting all tft_trait documents...")
client.delete(
    collection_name=collection_name,
    points_selector=qdrant_models.FilterSelector(
        filter=qdrant_models.Filter(
            must=[qdrant_models.FieldCondition(
                key="metadata.doc_type",
                match=qdrant_models.MatchValue(value="tft_trait")
            )]
        )
    ),
)
print("Deleted tft_trait docs.")

print("Deleting all tft_champion_trait documents...")
client.delete(
    collection_name=collection_name,
    points_selector=qdrant_models.FilterSelector(
        filter=qdrant_models.Filter(
            must=[qdrant_models.FieldCondition(
                key="metadata.doc_type",
                match=qdrant_models.MatchValue(value="tft_champion_trait")
            )]
        )
    ),
)
print("Deleted tft_champion_trait docs.")

info = client.get_collection(collection_name)
print(f"\nAfter deletion: {info.points_count} total points")
print("Now re-run upload_traits_s17_to_qdrant.py to re-upload with correct data.")
