"""
Re-upload tft_patch_16_6_official.txt vào Qdrant với section-based chunking.
Xóa data cũ trước, sau đó upload lại đúng cách.
"""
import os
import sys
import uuid
from dotenv import load_dotenv

load_dotenv()

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchText
from langchain_openai import OpenAIEmbeddings

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "tài liệu TFT")
OPENAI_API_KEY = os.getenv("LLM_API_KEY")

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "tft_patch_16_6_official.txt")
SOURCE_NAME = "tft_patch_16_6_official.txt"

# =====================
# STEP 1: XÓA DATA CŨ
# =====================
print("=" * 60)
print("STEP 1: Kết nối Qdrant và xóa data patch cũ...")
print(f"  Host: {QDRANT_HOST}:{QDRANT_PORT}")
print(f"  Collection: {COLLECTION_NAME}")
print("=" * 60)

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# Kiểm tra collection tồn tại
collections = [c.name for c in client.get_collections().collections]
if COLLECTION_NAME not in collections:
    print(f"[ERROR] Collection '{COLLECTION_NAME}' không tồn tại!")
    sys.exit(1)

count_before = client.count(collection_name=COLLECTION_NAME).count
print(f"[INFO] Số vectors hiện tại: {count_before}")

# Xóa các points có source là file patch cũ
old_sources = [
    "tft_patch_16_6_official.txt",
    "tft_patch_16_6.txt",
    "tft_patch_16_6_full.txt",
]

deleted_total = 0
for src in old_sources:
    try:
        result = client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="metadata.file_name",
                        match=MatchText(text=src)
                    )
                ]
            )
        )
        print(f"[DELETED] Xóa vectors nguồn '{src}': {result}")
        deleted_total += 1
    except Exception as e:
        print(f"[SKIP] Không tìm thấy hoặc lỗi khi xóa '{src}': {e}")

count_after_delete = client.count(collection_name=COLLECTION_NAME).count
print(f"[INFO] Số vectors sau khi xóa: {count_after_delete}")

# =====================
# STEP 2: ĐỌC & CHUNK
# =====================
print()
print("=" * 60)
print("STEP 2: Đọc file và chia thành sections...")
print("=" * 60)

with open(DATA_FILE, "r", encoding="utf-8") as f:
    content = f.read()

print(f"[INFO] Đã đọc file: {len(content)} ký tự")

# Section-based chunking: chia theo ## headers
import re

# Tách theo heading cấp 2 (##)
raw_sections = re.split(r'\n(?=## )', content)

# Nhóm các section nhỏ lại nếu quá ngắn (< 200 chars)
sections = []
buffer = ""

for section in raw_sections:
    section = section.strip()
    if not section:
        continue
    
    combined = (buffer + "\n\n" + section).strip() if buffer else section
    
    # Nếu combined quá dài (> 2000 chars), flush buffer trước
    if buffer and len(combined) > 2000:
        sections.append(buffer.strip())
        buffer = section
    else:
        buffer = combined

if buffer.strip():
    sections.append(buffer.strip())

# Với sections quá lớn (> 2500), sub-split theo ###
final_chunks = []
for sec in sections:
    if len(sec) > 2500:
        sub = re.split(r'\n(?=### )', sec)
        # Ghép sub-sections nếu quá nhỏ
        sub_buffer = ""
        for s in sub:
            s = s.strip()
            if not s:
                continue
            combined = (sub_buffer + "\n\n" + s).strip() if sub_buffer else s
            if sub_buffer and len(combined) > 2000:
                final_chunks.append(sub_buffer.strip())
                sub_buffer = s
            else:
                sub_buffer = combined
        if sub_buffer.strip():
            final_chunks.append(sub_buffer.strip())
    else:
        final_chunks.append(sec)

print(f"[INFO] Tổng số chunks gốc: {len(final_chunks)}")
for i, chunk in enumerate(final_chunks):
    preview = chunk[:80].replace('\n', ' ')
    print(f"  Chunk {i+1:02d} ({len(chunk)} chars): {preview}...")

# Tạo thêm chunk tổng hợp "BẢN CẬP NHẬT 16.6 - TẤT CẢ THAY ĐỔI"
# Chunk này đảm bảo khi hỏi "bản cập nhật mới có gì" sẽ luôn retrieve được traits + augments

# Lấy nội dung traits
traits_chunk = next((c for c in final_chunks if 'TỘC/HỆ' in c.upper()), "")
# Lấy nội dung augments/kinh tế
aug_chunk = next((c for c in final_chunks if 'NÂNG CẤP KINH TẾ' in c.upper() or 'NÂNG CẤP KHÁC' in c.upper()), "")
# Lấy summary tướng
champ_summary = next((c for c in final_chunks if 'TÓM TẮT NHANH' in c.upper()), "")

overview_chunk = f"""# PATCH 16.6 TFT - TOÀN BỘ THAY ĐỔI BẢN CẬP NHẬT
## Đấu Trường Chân Lý - Bản Cập Nhật 16.6 - Tất Cả Thay Đổi

Bản cập nhật 16.6 bao gồm các thay đổi về: Tộc/Hệ (Traits), Tướng (Champions), Lõi/Augments/Nâng Cấp, Hệ thống.

---
{traits_chunk}

---
{aug_chunk}

---
### TÓM TẮT TƯỚNG BUFF/NERF:
{champ_summary}
"""

final_chunks.append(overview_chunk.strip())
print(f"\n[INFO] Đã thêm chunk tổng hợp. Tổng: {len(final_chunks)} chunks")

# =====================
# STEP 3: EMBED & UPLOAD
# =====================
print()
print("=" * 60)
print("STEP 3: Embedding và upload lên Qdrant...")
print("=" * 60)

embeddings = OpenAIEmbeddings(
    openai_api_key=OPENAI_API_KEY,
    model="text-embedding-ada-002"
)

print(f"[INFO] Đang embed {len(final_chunks)} chunks...")
vectors = embeddings.embed_documents(final_chunks)
print(f"[OK] Đã embed xong. Dimension: {len(vectors[0])}")

points = [
    PointStruct(
        id=str(uuid.uuid4()),
        vector={"dense": vec},
        payload={
            "page_content": chunk,
            "metadata": {
                "source": SOURCE_NAME,
                "file_name": SOURCE_NAME,
                "patch": "16.6",
                "type": "patch_notes"
            }
        }
    )
    for chunk, vec in zip(final_chunks, vectors)
]

client.upsert(collection_name=COLLECTION_NAME, points=points)

count_final = client.count(collection_name=COLLECTION_NAME).count
print(f"[SUCCESS] Upload xong! {len(points)} chunks mới.")
print(f"[INFO] Tổng vectors trong collection: {count_final}")
print()
print("=" * 60)
print("HOÀN TẤT! Chatbot sẽ tìm được thông tin tộc/hệ và lõi.")
print("=" * 60)
