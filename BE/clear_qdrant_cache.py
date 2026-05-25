"""
clear_qdrant_cache.py
=======================
Script để xóa cache câu trả lời RAG lưu trong Qdrant.
(Xóa các point có metadata.is_auto_cached = True hoặc doc_type = cached_qa)
"""
import logging
import os
import sys

from dotenv import load_dotenv
load_dotenv()

import config
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

def main():
    collection_name = config.QDRANT_COLLECTION_NAME
    logger.info("Kết nối Qdrant tại %s:%s, collection='%s'", 
                config.QDRANT_HOST, config.QDRANT_PORT, collection_name)
    
    client = QdrantClient(
        host=config.QDRANT_HOST,
        port=config.QDRANT_PORT,
        api_key=config.QDRANT_API_KEY if config.QDRANT_API_KEY else None,
    )
    
    # Check total points before
    info = client.get_collection(collection_name)
    logger.info("Tổng số points ban đầu: %d", info.points_count)

    # Đếm số lượng cache
    try:
        count_res = client.count(
            collection_name=collection_name,
            count_filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="metadata.is_auto_cached",
                        match=qdrant_models.MatchValue(value=True)
                    )
                ]
            ),
            exact=True
        )
        logger.info("Số lượng câu trả lời bị cache (is_auto_cached=True): %d", count_res.count)
    except Exception as e:
        logger.warning("Lỗi đếm cache: %s", e)

    # Xóa cache
    logger.info("Tiến hành xóa toàn bộ cache RAG...")
    try:
        delete_res = client.delete(
            collection_name=collection_name,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="metadata.is_auto_cached",
                            match=qdrant_models.MatchValue(value=True)
                        )
                    ]
                )
            ),
            wait=True
        )
        logger.info("Kết quả xóa cache: %s", delete_res)
    except Exception as e:
        logger.error("Lỗi khi xóa cache: %s", e)
        
    # Check total points after
    info_after = client.get_collection(collection_name)
    logger.info("Tổng số points sau khi dọn dẹp: %d", info_after.points_count)
    logger.info("Đã dọn dẹp xong semantic cache trong Qdrant!")

if __name__ == "__main__":
    main()
