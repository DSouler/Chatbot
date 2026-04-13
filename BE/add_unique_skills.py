"""Add chieu_thuc (skill) data to unique_traits entries that are missing it."""
import json

DATA_PATH = "data/tft_traits_dtcl_s17.json"

# Skills for champions that ONLY exist in unique_traits (no regular trait entry)
# Data from blitz.gg/vi/tft/set17/champions
UNIQUE_CHAMP_SKILLS = {
    "Morgana": {
        "ten_chieu": "Thể Hắc Ám",
        "noi_tai": "Hồi máu bằng 20% sát thương Kỹ Năng.",
        "kich_hoat": "Hóa thân thành Thể Hắc Ám trong 5 giây, nhận 250/300/4000 (tỉ lệ theo AP) Lá Chắn trong thời gian này. Khi ở Thể Hắc Ám, kết nối với 3 kẻ địch gần nhất, gây sát thương phép (tỉ lệ theo AP) mỗi giây lên từng kẻ địch. Khi kết thúc biến hình, gây sát thương phép (tỉ lệ theo AP) lên tất cả kẻ địch bị kết nối."
    },
    "Rhaast": {
        "ten_chieu": "Lưỡi Hái Thánh Thần",
        "kich_hoat": "Nhận 20% Chống Chịu trong 2 giây, hồi máu (tỉ lệ theo AP) trong suốt thời gian hiệu lực. Sau đó, chém theo đường thẳng về phía trước, gây 120/180/300 (tỉ lệ theo AD) sát thương vật lý lên các kẻ địch trúng chiêu và hất tung chúng trong 1 giây."
    },
    "Zed": {
        "ten_chieu": "Phân Thân Lượng Tử",
        "kich_hoat": "Tạo một phân thân phía sau mục tiêu với Máu tối đa giảm 33% và tiêu hao Năng Lượng tăng 30. Phân thân sẽ kế thừa các trang bị, chỉ số và Máu hiện tại của bản thể tạo ra nó, và có thể tung chiêu Phân Thân Lượng Tử."
    },
    "Graves": {
        "ten_chieu": "Đạn Nổ Thần Công",
        "noi_tai": "Đòn đánh thường bắn ra 5 đường đạn theo hình nón, mỗi đường đạn gây sát thương vật lý (SMCK cơ bản).",
        "kich_hoat": "Bắn ra một quả đạn nổ gây 360/540/5555 (tỉ lệ theo AD) sát thương vật lý lên mục tiêu, và sát thương vật lý (tỉ lệ theo AD + AP) lên những kẻ địch liền kề."
    },
    "Vex": {
        "ten_chieu": "Giúp Ta Một Tay, Bóng Đen!",
        "noi_tai": "Mỗi khi Vex tấn công, Bóng Đen sẽ ra đòn vào một kẻ địch ở gần, gây sát thương phép (tỉ lệ theo AP). Mỗi khi kẻ địch bị Bóng Đen đánh trúng 5 lần, Bóng Đen sẽ ra đòn lên chúng thêm một lần nữa.",
        "kich_hoat": "Bóng Đen tung ra 3 đòn đánh cường hóa, gây sát thương phép (tỉ lệ theo AP)."
    },
    "Miss Fortune": {
        "ten_chieu": "Kho Vũ Khí Xạ Thần",
        "kich_hoat": "Triển khai Miss Fortune để chọn kích hoạt Chế Độ Dẫn Truyền, Chế Độ Thách Đấu hoặc Chế Độ Nhân Bản. Chế độ được chọn sẽ quyết định kỹ năng và tộc/hệ của cô ấy."
    },
}

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

fixes = 0
for st in data["unique_traits"]:
    name = st["champion"]
    if name in UNIQUE_CHAMP_SKILLS and "chieu_thuc" not in st:
        st["chieu_thuc"] = UNIQUE_CHAMP_SKILLS[name]
        print(f"Added skill for {name}: {UNIQUE_CHAMP_SKILLS[name]['ten_chieu']}")
        fixes += 1

with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nTotal skills added to unique_traits: {fixes}")
