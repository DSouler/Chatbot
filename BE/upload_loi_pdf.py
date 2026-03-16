"""
Script upload tài liệu về lõi TFT lên Qdrant với semantic chunking.
Chia tài liệu thành các section có nghĩa thay vì chunk cơ học.

Usage:
    cd Chatbot/BE
    python upload_loi_pdf.py
"""
import os
import uuid
import asyncio
from dotenv import load_dotenv

load_dotenv()

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from langchain_openai import OpenAIEmbeddings

# --- Config ---
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "tài liệu TFT")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")
PDF_PATH = r"c:\Users\quan2\Downloads\tài liệu về lõi.pdf"

# --- Semantic chunks: mỗi chunk là 1 section có nghĩa, kèm metadata ---
SEMANTIC_CHUNKS = [
    {
        "content": (
            "Kì ngộ nên để tiền cho việc up cấp (level up):\n"
            "- Lõi kim cương xuất hiện đầu\n"
            "- Lõi kim cương xuất hiện cuối\n"
            "- Tất cả là lõi kim cương\n"
            "- Đầm cua\n"
            "- Vàng sau từng giai đoạn\n"
            "- Phần thưởng đa dạng theo từng giai đoạn\n\n"
            "Lý do: Các kì ngộ này cho nhiều tài nguyên kinh tế (vàng, lõi kim cương có giá trị cao), "
            "nên tận dụng để up cấp level sớm, lên 8-9 tìm tướng 4-5 cost mạnh."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "kì ngộ",
            "strategy": "up cấp",
            "category": "encounter_upgrade"
        }
    },
    {
        "content": (
            "Kì ngộ thích hợp để chơi reroll:\n"
            "- Khởi đầu với 2 trang bị thành phần\n"
            "- Tất cả là lõi vàng\n"
            "- Khởi động với 1 tướng 3 vàng ngẫu nhiên\n"
            "- Tướng khởi đầu lên được 2 sao\n"
            "- Khởi động với 1 tướng 2 vàng ngẫu nhiên\n"
            "- Không có kì ngộ\n\n"
            "Lý do: Các kì ngộ này không cho nhiều tài nguyên kinh tế, "
            "nhưng cho lợi thế sớm (trang bị, tướng sẵn 2 sao) nên phù hợp chơi reroll "
            "tướng giá rẻ (1-3 cost) để tạo sức mạnh sớm."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "kì ngộ",
            "strategy": "reroll",
            "category": "encounter_reroll"
        }
    },
    {
        "content": (
            "Lõi bạc đem lại lợi tức, phù hợp với việc up cấp:\n"
            "- Được Này Mất Kia I\n- Tiền Ăn Trưa\n- Một, Hai, Năm!\n"
            "- Hướng Đến Hồi Kết\n- Chiến Lợi Phẩm I\n- Kết Nối Gián Đoạn\n"
            "- Một, Hai, Ba\n- Nước Đi Liều Lĩnh\n- Đặc Quyền Phú Gia\n"
            "- Đòn Quyết Định\n- Quay Trúng Thưởng\n- Giả Dược+\n"
            "- Nâng Tầm Uy Lực\n- Chuyện Đời Thường\n- Kẻ Sống Sót\n"
            "- Khổng Lồ Ngoại Cỡ\n- Đồng Minh Của Bụt\n- Thương Gia Khôn Ngoan\n\n"
            "Đây là các lõi bạc cho kinh tế/lợi tức. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật up cấp level."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi bạc",
            "strategy": "up cấp",
            "tier": "bạc",
            "category": "silver_upgrade"
        }
    },
    {
        "content": (
            "Lõi bạc đem lại khả năng combat, lõi anh hùng, trang bị, reroll:\n"
            "- Nguyên Tố Khí\n- Pháo Kích Tầm Xa\n- Nguyên Tố Đất\n"
            "- Nguyên Tố Lửa\n- Nguyên Tố Nước\n- Nguyên Tố Gỗ\n"
            "- Phước Lành Vũ Trụ I\n- Giáp Tự Chế I\n- Độc Hành I\n"
            "- Làm Nóng I\n- Nhất Thống\n- Tiếp Tế Trang Bị\n"
            "- Đại Tiệc Trang Bị\n- Hộp Pandora\n- Xoay Bài Tự Động\n"
            "- Ngọn Gió Thứ Hai\n- Băng Trộm\n- Bạn Thân I\n"
            "- Dựa Hơi I\n- Xúc Xắc Vô Tận I\n- Xây Dựng Đội Hình\n"
            "- Lập Đội\n- Cầu Hồi Phục I\n- Kho Báu Sắt\n"
            "- Lò Rèn Tiềm Ẩn\n- Phân Nhánh\n- Tập Chịu Đòn\n"
            "- Phân Nhánh+\n- Tiến Hóa Bất Định\n- Cung Dự Phòng\n"
            "- Bước Đột Phá\n- Triệu Hồi Bất Tận\n- Ăn Mòn\n"
            "- Lệ Lưu Ly\n- Mở Lối\n- Khéo Tay Hay Làm\n"
            "- Hình Nhân Hóa\n- Ăn Miếng Trả Miếng+\n- Túi Đồ Cỡ Nhỏ\n\n"
            "Đây là các lõi bạc cho sức mạnh chiến đấu/trang bị. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật reroll tướng giá rẻ."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi bạc",
            "strategy": "reroll/combat",
            "tier": "bạc",
            "category": "silver_combat"
        }
    },
    {
        "content": (
            "Lõi vàng đem lại lợi tức, phù hợp với việc up cấp:\n"
            "- Kỷ Nguyên+\n- Những Người Bạn Nhỏ\n- Tứ Phương Tiếp Viện\n"
            "- Cơn Mưa Vàng\n- Kho Báu Bandle I\n- Hạ Đo Ván+\n"
            "- Nhà Thám Hiểm Ixtal\n- Tiến Hóa và Tiến Bộ\n- U.R.F.\n"
            "- Hành Trình Chính Đạo I\n- Thông Thoáng\n- Thua Có Tính Toán\n"
            "- Sống Vội\n- Bừa Bộn\n- Kiên Nhẫn Học Tập\n"
            "- Vay Tạm Ứng+\n- Aura Farming\n- Sinh Nhật Đoàn Tụ\n"
            "- Hàng Chờ Đấu Đôi\n- Xúc Xắc Hoành Tráng\n- Tăng Trưởng Bùng Nổ\n"
            "- Nghĩ Về Tương Lai\n- Thương Vụ Khó Xơi\n- Nhận Vàng\n"
            "- Do Dự I,II\n- Thăng Tiến Cuối Trận\n- Dòng Tiền Mờ Ám\n"
            "- Tài Khoản Tiết Kiệm\n- Chỉ 3 Vàng\n- Vệ Binh Ánh Sáng\n"
            "- Đội Hình Tối Ưu\n\n"
            "Đây là các lõi vàng cho kinh tế/lợi tức. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật up cấp level."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi vàng",
            "strategy": "up cấp",
            "tier": "vàng",
            "category": "gold_upgrade"
        }
    },
    {
        "content": (
            "Lõi vàng đem lại khả năng combat, lõi anh hùng, trang bị, reroll:\n"
            "- Hình Nộm Va Chạm\n- Túi Đồ Siêu Hùng\n- Võ Sĩ Giác Đấu\n"
            "- Phép Thuật Hỗn Loạn\n- Demacia Trường Tồn\n- Kẻ Tàn Phá\n"
            "- Bảo Vệ Thiên Phận\n- Thoát Khỏi Xiềng Thép\n- Darkwill Xâm Lược\n"
            "- Di Chuyển Bằng Cổng Hextech\n- Hắc Diệt Đế Vương\n- Silco Báo Thù\n"
            "- Cuộc Thi Nâng Tạ\n- Bộ Đôi Độc Dược\n- Phước Lành Vũ Trụ II\n"
            "- Độc Hành II\n- Giáp Tự Chế II\n- Cặp Đôi Hoàn Cảnh\n"
            "- Lò Rèn Thần Thoại\n- Nhà Máy Tái Chế\n- Bạn Thân II\n"
            "- Làm Nóng II\n- Thăng Hoa\n- Túi Đồ Cỡ Đại\n"
            "- Cầu Hồi Phục II\n- Khảm Bảo Thạch I\n- Arcane Viktor-y\n"
            "- Cộng Mệt Nghỉ!\n- Huấn Luyện Cận Vệ\n- Mũ Tử Thần\n"
            "- Chuẩn Xác và Uyển Chuyển\n- Nếm Mùi Lửa\n- Lấy Công Bù Thủ II\n"
            "- Thợ Rèn Kiếm\n- Người Đá Càn Quét\n- Túi Đồ Siêu Hùng++\n"
            "- Sét Cao Thế\n- Khiên Đơn Đấu\n- Bảo Hộ Vô Tận\n"
            "- Linh Hồn Chuộc Tội\n- NHẮM MẮT CHƠI BỪA\n- Kiếm Tử Thần\n"
            "- Giáp Gai Thép\n\n"
            "Đây là các lõi vàng cho sức mạnh chiến đấu/trang bị. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật reroll tướng giá rẻ."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi vàng",
            "strategy": "reroll/combat",
            "tier": "vàng",
            "category": "gold_combat"
        }
    },
    {
        "content": (
            "Lõi kim cương đem lại lợi tức, phù hợp với việc up cấp:\n"
            "- Thích Mở Rộng\n- Triệu Gọi Hỗn Mang\n- Hành Trình Chính Đạo II\n"
            "- Khuyến Mãi Kinh Nghiệm\n- Rồng Đẻ Trứng Vàng\n- Quà Sinh Nhật\n"
            "- Quỹ Phòng Hộ\n- Chiến Lợi Phẩm III\n- Bộ Khởi Đầu\n"
            "- Khổng Lồ Tí Hon\n- Chỉ Một Con Đường\n- Đầu Tư+\n"
            "- Tư Duy Tiến Bộ\n- Đánh Là Trúng\n- Gói Đăng Ký Hạng Sang\n"
            "- Vận Mệnh Kim Cương+\n- Bão Vàng\n- Cửu Sinh\n"
            "- Đẩy Nhanh Tiến Độ\n- Toàn Thắng\n- Sa Mạc Bí Ẩn\n"
            "- Chiến Lang\n- Long Binh\n- Vương Miện Hắc Hóa\n\n"
            "Đây là các lõi kim cương cho kinh tế/lợi tức. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật up cấp level."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi kim cương",
            "strategy": "up cấp",
            "tier": "kim cương",
            "category": "diamond_upgrade"
        }
    },
    {
        "content": (
            "Lõi kim cương đem lại khả năng combat, lõi anh hùng, trang bị, reroll:\n"
            "- Nhỏ Mà Có Võ\n- Cổ Ngữ Thế Giới\n- Định Luật Nguyên Tố\n"
            "- Trang Bị Đầy Đủ\n- Băng Trộm II++\n- Phước Lành Vũ Trụ III\n"
            "- Vé Kim Cương\n- Kho Thần Tích\n- Trung Tâm Thương Mại\n"
            "- Đo Ni Đóng Giày+\n- Chế Tạo Tại Chỗ\n- Kho Báu Chôn Giấu\n"
            "- Khảm Bảo Thạch II\n- Quang Lân Tiểu Yêu\n- Cố Gắng Lật Kèo\n"
            "- Thức Tỉnh Linh Hồn\n- Đam Mê Đai Lưng\n- Tất Tay Bậc Đồng II\n"
            "- Người Bạn Vàng\n- Giữ Vững Hàng Ngũ\n- Tối Đa Hóa\n"
            "- Phi Vụ Trang Bị\n- Một Bùa, Hai Bùa\n- Báo Oán\n"
            "- Tinh Túy Kim Long\n- Bộ Ba Hoàn Hảo II\n- Chờ Đợi Xứng Đáng II\n\n"
            "Đây là các lõi kim cương cho sức mạnh chiến đấu/trang bị. Khi được chọn >= 2 lõi thuộc nhóm này, "
            "nên ưu tiên chiến thuật reroll tướng giá rẻ."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "lõi kim cương",
            "strategy": "reroll/combat",
            "tier": "kim cương",
            "category": "diamond_combat"
        }
    },
    {
        "content": (
            "HƯỚNG DẪN QUYẾT ĐỊNH UP CẤP HAY REROLL DỰA TRÊN LÕI:\n\n"
            "Quy tắc chính:\n"
            "1. Nếu người chơi có >= 2 lõi thuộc nhóm 'lợi tức/up cấp' → NÊN up cấp level (fast 8, fast 9).\n"
            "2. Nếu người chơi có >= 2 lõi thuộc nhóm 'combat/trang bị/reroll' → NÊN reroll tướng giá rẻ.\n"
            "3. Nếu 1 lõi up cấp + 1 lõi combat → xem xét kì ngộ để quyết định.\n"
            "4. Kì ngộ cho vàng/kim cương → thiên về up cấp.\n"
            "5. Kì ngộ cho trang bị/tướng sẵn → thiên về reroll.\n\n"
            "Nhóm lõi lợi tức (up cấp): cho thêm vàng, EXP, tài nguyên kinh tế theo thời gian.\n"
            "Nhóm lõi combat (reroll): cho trang bị, tướng, sức mạnh chiến đấu trực tiếp.\n\n"
            "Ví dụ:\n"
            "- Có 'Tiền Ăn Trưa' (bạc up cấp) + 'Cơn Mưa Vàng' (vàng up cấp) → Nên up cấp.\n"
            "- Có 'Giáp Tự Chế I' (bạc combat) + 'Túi Đồ Siêu Hùng' (vàng combat) → Nên reroll.\n"
            "- Có 'Tiền Ăn Trưa' (bạc up cấp) + 'Giáp Tự Chế I' (bạc combat) + kì ngộ 'Đầm cua' → Nên up cấp vì kì ngộ thiên về up cấp."
        ),
        "metadata": {
            "source": "tài liệu về lõi.pdf",
            "section": "hướng dẫn quyết định",
            "strategy": "tổng hợp",
            "category": "decision_guide"
        }
    },
]


def main():
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    print(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

    # Ensure collection exists
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        print(f"Creating collection '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)}
        )
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")

    # Delete old data from this source to avoid duplicates
    print("Deleting old data from 'tài liệu về lõi.pdf'...")
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="metadata.source",
                        match=MatchValue(value="tài liệu về lõi.pdf")
                    )
                ]
            )
        )
        print("Old data deleted.")
    except Exception as e:
        print(f"Warning: Could not delete old data: {e}")

    # Create embeddings
    print("Creating embeddings with text-embedding-ada-002...")
    embeddings = OpenAIEmbeddings(
        openai_api_key=LLM_API_KEY,
        model="text-embedding-ada-002"
    )

    texts = [chunk["content"] for chunk in SEMANTIC_CHUNKS]
    vectors = embeddings.embed_documents(texts)
    print(f"Generated {len(vectors)} embeddings.")

    # Build points
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector={"dense": vec},
            payload={
                "page_content": chunk["content"],
                "metadata": chunk["metadata"]
            }
        )
        for chunk, vec in zip(SEMANTIC_CHUNKS, vectors)
    ]

    # Upsert
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    print(f"Successfully uploaded {len(points)} semantic chunks to Qdrant!")
    print("\nChunks uploaded:")
    for i, chunk in enumerate(SEMANTIC_CHUNKS):
        print(f"  {i+1}. [{chunk['metadata']['category']}] {chunk['metadata']['section']} - {chunk['metadata']['strategy']}")


if __name__ == "__main__":
    main()
