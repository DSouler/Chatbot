"""Add missing chieu_thuc (skills) for 10 champions in tft_traits_dtcl_s17.json.
Data sourced from blitz.gg/vi/tft/set17/champions on 2026-04-13.
"""
import json

DATA_PATH = "data/tft_traits_dtcl_s17.json"

MISSING_SKILLS = {
    "Aatrox": {
        "ten_chieu": "Nhát Chém Tinh Tú",
        "kich_hoat": "Hồi lại (tỉ lệ theo AP), sau đó gây sát thương vật lý (tỉ lệ theo AD + Giáp) lên mục tiêu hiện tại. Chiêu Thức N.O.V.A.: Chém xuyên chiến trường, hất tung tất cả kẻ địch trong thoáng chốc và gây sát thương vật lý (tỉ lệ theo AD + Giáp)."
    },
    "Lulu": {
        "ten_chieu": "Mưa Sao Rơi",
        "noi_tai": "Nhận một hiệu ứng phụ khác nhau mỗi trận dựa trên chòm sao Chiêm Tinh.",
        "kich_hoat": "Triệu hồi một thứ gì đó từ trên trời rơi xuống, gây 150/225/360 (tỉ lệ theo AP) sát thương phép lên 3 kẻ địch xung quanh và tạo hiệu ứng đặc biệt dựa trên Chòm Sao Chiêm Tinh của trận này."
    },
    "Pantheon": {
        "ten_chieu": "Phòng Thủ Nâng Cao",
        "kich_hoat": "Nhận Lá Chắn (tỉ lệ theo Máu + AP) và 15% Chống Chịu trong 4 giây. Trong thời gian tác dụng, gây sát thương vật lý (tỉ lệ theo AD) mỗi giây lên kẻ địch theo hình nón."
    },
    "Maokai": {
        "ten_chieu": "Bàn Tay Hội Tụ",
        "noi_tai": "Nhận thêm 45% Máu tối đa từ mọi nguồn.",
        "kich_hoat": "Triệu hồi những dây leo tạo thành hình chữ X hội tụ vào mục tiêu, gây sát thương phép (tỉ lệ theo AP) lên mỗi kẻ địch trúng phải và Làm Choáng chúng trong 1.5/1.5/1.75 giây. N.O.V.A. Tấn Công: Phóng ra một làn sóng rồng làm choáng tất cả kẻ địch trong 1.5/1.5/1.75 giây. Trong phần còn lại của giao tranh, các đòn đánh của Maokai gây thêm sát thương vật lý (tỉ lệ theo Máu)."
    },
    "Caitlyn": {
        "ten_chieu": "Nhắm Thẳng Đầu",
        "noi_tai": "Đòn đánh có 15% tỉ lệ May Mắn bắn ra một cú Thiện Xạ cường hóa, gây sát thương vật lý (tỉ lệ theo AD + AP). May Mắn: Tính toán hai lần, lấy kết quả tốt hơn.",
        "kich_hoat": "Chiêu Thức N.O.V.A.: Đánh dấu tất cả kẻ địch, tăng sát thương chúng nhận vào thêm 10%. Lần đầu tiên mục tiêu bị đánh dấu còn ít hơn 50% Máu, Thiện Xạ chúng để gây sát thương vật lý (tỉ lệ theo AD + AP)."
    },
    "Lissandra": {
        "ten_chieu": "Thiên Thạch Đen",
        "kich_hoat": "Ném một mảnh băng về phía mục tiêu hiện tại, gây 250/375/600 (tỉ lệ theo AP) sát thương phép lên mục tiêu đầu tiên trúng phải. Sau khi trúng mục tiêu đầu tiên hoặc khi bay hết tầm, mảnh băng sẽ phát nổ, gây sát thương phép (tỉ lệ theo AP) lên những mục tiêu ở gần."
    },
    "LeBlanc": {
        "ten_chieu": "Phá Vỡ Thực Tại",
        "noi_tai": "Thay vào đó, đòn đánh gây sát thương phép (tỉ lệ theo AP).",
        "kich_hoat": "Triệu hồi 5 phân thân cùng tấn công trong 5 đòn đánh, gây 25/25/150% sát thương. Trong đòn tấn công cuối cùng, các phân thân bắn ra một tia gây sát thương phép (tỉ lệ theo AP)."
    },
    "Jinx": {
        "ten_chieu": "Thái Độ Bùng Nổ",
        "kich_hoat": "Bắn một loạt tên lửa (tỉ lệ theo Tốc Độ Đánh) theo hình nón, mỗi tên lửa gây sát thương vật lý (tỉ lệ theo AD) lên mục tiêu đầu tiên trúng phải."
    },
    "Leona": {
        "ten_chieu": "Khiên Mặt Trời",
        "kich_hoat": "Nhận Lá Chắn (tỉ lệ theo AP) trong 4 giây. Nện vào mục tiêu hiện tại, gây 100/150/225 (tỉ lệ theo Giáp + Kháng Phép) sát thương phép và làm choáng chúng trong 1.75/1.75/2 giây."
    },
    "Zoe": {
        "ten_chieu": "Nghịch Sao",
        "kich_hoat": "Bắn một ngôi sao nghịch ngợm vào mục tiêu hiện tại, gây 68/102/153 (tỉ lệ theo AP) sát thương phép lên mục tiêu đầu tiên trúng phải và sát thương phép lên những kẻ địch khác mà nó đi qua. Khi ngôi sao đến điểm đích, chuyển hướng nó về phía một kẻ địch ở xa, tăng tốc độ và lặp lại sát thương. Có thể chuyển hướng 4 lần."
    },
}

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

fixes = 0
for trait in data["traits"]:
    for champ in trait["champions"]:
        name = champ["name"]
        if name in MISSING_SKILLS and "chieu_thuc" not in champ:
            champ["chieu_thuc"] = MISSING_SKILLS[name]
            print(f"Added skill for {name}: {MISSING_SKILLS[name]['ten_chieu']}")
            fixes += 1

with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nTotal skills added: {fixes}")
