"""
backup_qdrant.py — Backup & Restore dữ liệu Qdrant collection ra file JSON

Cách dùng:
  # Backup (xuất toàn bộ points ra file JSON):
  python backup_qdrant.py backup

  # Restore (đưa dữ liệu từ file JSON vào lại Qdrant):
  python backup_qdrant.py restore

  # Tùy chỉnh file output (mặc định: qdrant_backup_YYYYMMDD_HHMMSS.json):
  python backup_qdrant.py backup --output my_backup.json
  python backup_qdrant.py restore --input my_backup.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
QDRANT_HOST       = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT       = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY") or None
COLLECTION_NAME   = os.getenv("QDRANT_COLLECTION_NAME", "tài liệu TFT")
BATCH_SIZE        = 200   # số points đọc mỗi lần scroll
# ─────────────────────────────────────────────────────────────────────────────


def get_client() -> QdrantClient:
    return QdrantClient(
        host=QDRANT_HOST,
        port=QDRANT_PORT,
        api_key=QDRANT_API_KEY,
    )


# =============================================================================
# BACKUP
# =============================================================================

def backup(output_path: str) -> None:
    client = get_client()

    # Kiểm tra collection tồn tại
    try:
        info = client.get_collection(COLLECTION_NAME)
    except Exception as e:
        logger.error(f"Không tìm thấy collection '{COLLECTION_NAME}': {e}")
        sys.exit(1)

    total_points = info.points_count or 0
    logger.info(
        f"Bắt đầu backup collection '{COLLECTION_NAME}' "
        f"({total_points} points) → {output_path}"
    )

    # Đọc cấu hình vector từ collection
    vectors_config = info.config.params.vectors
    if isinstance(vectors_config, dict):
        vectors_cfg_serial = {
            name: {
                "size": cfg.size,
                "distance": cfg.distance.value,
            }
            for name, cfg in vectors_config.items()
        }
    else:
        # Single unnamed vector
        vectors_cfg_serial = {
            "": {
                "size": vectors_config.size,
                "distance": vectors_config.distance.value,
            }
        }

    all_points = []
    offset = None
    fetched = 0

    while True:
        results, next_offset = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=BATCH_SIZE,
            with_payload=True,
            with_vectors=True,
            offset=offset,
        )

        for point in results:
            # Serialize vector — có thể là dict (named) hoặc list (unnamed)
            if isinstance(point.vector, dict):
                vector_serial = {k: list(v) for k, v in point.vector.items()}
            elif point.vector is not None:
                vector_serial = list(point.vector)
            else:
                vector_serial = None

            all_points.append({
                "id":      str(point.id),
                "vector":  vector_serial,
                "payload": point.payload or {},
            })

        fetched += len(results)
        logger.info(f"  Đã đọc {fetched}/{total_points} points...")

        if next_offset is None:
            break
        offset = next_offset

    backup_data = {
        "collection_name": COLLECTION_NAME,
        "vectors_config":  vectors_cfg_serial,
        "total_points":    len(all_points),
        "backup_time":     datetime.now(timezone.utc).isoformat(),
        "points":          all_points,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    logger.info(
        f"✅ Backup hoàn tất: {len(all_points)} points "
        f"→ {output_path} ({size_mb:.1f} MB)"
    )


# =============================================================================
# RESTORE
# =============================================================================

def restore(input_path: str) -> None:
    if not os.path.exists(input_path):
        logger.error(f"Không tìm thấy file backup: {input_path}")
        sys.exit(1)

    logger.info(f"Đang đọc file backup: {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    collection  = backup_data.get("collection_name", COLLECTION_NAME)
    total       = backup_data.get("total_points", 0)
    points_data = backup_data.get("points", [])
    vectors_cfg = backup_data.get("vectors_config", {})
    backup_time = backup_data.get("backup_time", "unknown")

    logger.info(
        f"Restore '{collection}': {total} points "
        f"(backup tạo lúc {backup_time})"
    )

    client = get_client()

    # Tạo/kiểm tra collection
    existing_collections = [c.name for c in client.get_collections().collections]
    if collection in existing_collections:
        logger.info(f"Collection '{collection}' đã tồn tại — sẽ upsert (không xóa data cũ).")
    else:
        logger.info(f"Tạo mới collection '{collection}'...")
        # Build VectorParams từ config trong file backup
        vc = {}
        for name, cfg in vectors_cfg.items():
            dist_map = {
                "Cosine": Distance.COSINE,
                "Dot":    Distance.DOT,
                "Euclid": Distance.EUCLID,
            }
            distance = dist_map.get(cfg["distance"], Distance.COSINE)
            vc[name] = VectorParams(size=cfg["size"], distance=distance)
        client.create_collection(collection, vectors_config=vc)
        logger.info(f"Đã tạo collection '{collection}'.")

    # Upsert theo batch
    upserted = 0
    for i in range(0, len(points_data), BATCH_SIZE):
        batch = points_data[i : i + BATCH_SIZE]
        qdrant_points = []
        for p in batch:
            vec = p["vector"]
            # Chuyển lại về format Qdrant
            if isinstance(vec, dict):
                vector_arg = {k: v for k, v in vec.items()}
            else:
                vector_arg = vec

            qdrant_points.append(
                PointStruct(
                    id=p["id"],
                    vector=vector_arg,
                    payload=p.get("payload", {}),
                )
            )

        client.upsert(collection_name=collection, points=qdrant_points)
        upserted += len(batch)
        logger.info(f"  Đã restore {upserted}/{total} points...")

    logger.info(f"✅ Restore hoàn tất: {upserted} points vào collection '{collection}'")


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Backup & Restore Qdrant collection ra/vào file JSON"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # backup sub-command
    p_backup = sub.add_parser("backup", help="Xuất dữ liệu Qdrant ra file JSON")
    p_backup.add_argument(
        "--output", "-o",
        default=None,
        help="Đường dẫn file output (mặc định: qdrant_backup_YYYYMMDD_HHMMSS.json)"
    )

    # restore sub-command
    p_restore = sub.add_parser("restore", help="Nạp dữ liệu từ file JSON vào Qdrant")
    p_restore.add_argument(
        "--input", "-i",
        default=None,
        help="Đường dẫn file backup cần restore (mặc định: file qdrant_backup_*.json mới nhất)"
    )

    args = parser.parse_args()

    if args.command == "backup":
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = args.output or f"qdrant_backup_{ts}.json"
        backup(output)

    elif args.command == "restore":
        # Nếu không chỉ định file, tìm file backup mới nhất trong thư mục hiện tại
        input_file = args.input
        if not input_file:
            candidates = sorted(
                [f for f in os.listdir(".") if f.startswith("qdrant_backup_") and f.endswith(".json")],
                reverse=True,
            )
            if not candidates:
                logger.error("Không tìm thấy file backup nào. Hãy chỉ định --input <file>.")
                sys.exit(1)
            input_file = candidates[0]
            logger.info(f"Tự động chọn file backup mới nhất: {input_file}")
        restore(input_file)


if __name__ == "__main__":
    main()
