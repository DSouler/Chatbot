# Hướng dẫn sử dụng API Messages với Role

## Tổng quan
API Messages đã được cập nhật để hỗ trợ trường `role` để phân biệt giữa tin nhắn của người dùng và bot.

## Cấu trúc Database

### Bảng `messages`
```sql
CREATE TABLE messages (
    id String PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    status SMALLINT,
    content TEXT,
    role VARCHAR(20) DEFAULT 'user', -- 'user' hoặc 'assistant'
    updated_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_by BIGINT,
    created_by BIGINT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

## API Endpoints

### 1. Tạo tin nhắn mới
**POST** `/messages`

**Body:**
```json
{
    "conversation_id": 1,
    "content": "Xin chào, tôi có câu hỏi",
    "created_by": 1,
    "role": "user"  // Tùy chọn, mặc định là "user"
}
```

**Response:**
```json
{
    "message_id": "msg_123"
}
```

### 2. Lấy tất cả tin nhắn trong cuộc hội thoại
**GET** `/conversations/{conversation_id}/messages`

**Response:**
```json
{
    "messages": [
        {
            "id": "msg_1",
            "conversation_id": 1,
            "content": "Xin chào",
            "role": "user",
            "created_at": "2024-01-01T10:00:00Z",
            "created_by": 1
        },
        {
            "id": "msg_2", 
            "conversation_id": 1,
            "content": "Chào bạn! Tôi có thể giúp gì cho bạn?",
            "role": "assistant",
            "created_at": "2024-01-01T10:00:01Z",
            "created_by": 1
        }
    ]
}
```

### 3. Lấy tin nhắn theo role
**GET** `/conversations/{conversation_id}/messages/{role}`

**Ví dụ:**
- `/conversations/1/messages/user` - Lấy tin nhắn của người dùng
- `/conversations/1/messages/assistant` - Lấy tin nhắn của bot

**Response:**
```json
{
    "messages": [
        {
            "id": "msg_1",
            "conversation_id": 1,
            "content": "Xin chào",
            "role": "user",
            "created_at": "2024-01-01T10:00:00Z",
            "created_by": 1
        }
    ]
}
```

## Các giá trị Role

- `"user"`: Tin nhắn từ người dùng
- `"assistant"`: Tin nhắn từ bot/assistant

## Cách sử dụng

### Khi người dùng gửi tin nhắn:
```json
{
    "conversation_id": 1,
    "content": "Câu hỏi của người dùng",
    "created_by": 1,
    "role": "user"
}
```

### Khi bot trả lời:
```json
{
    "conversation_id": 1,
    "content": "Câu trả lời của bot",
    "created_by": 1,
    "role": "assistant"
}
```

## Migration

Để cập nhật database hiện tại, chạy:
```bash
python migrate.py
```

Script này sẽ:
1. Thêm cột `content` nếu chưa tồn tại
2. Thêm cột `role` với giá trị mặc định `'user'`
3. Chạy migration schema.sql 