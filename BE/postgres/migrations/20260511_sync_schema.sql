-- ============================================================
-- Migration: Đồng bộ schema DB với hệ thống thực tế
-- Ngày: 2026-05-11
-- Mô tả: Thêm cột thiếu vào users, messages; 
--         Thêm FK cho token_usage, message_feedback;
--         Tạo bảng question_feedback nếu chưa có;
--         Thêm positions mặc định.
-- ============================================================

-- ============================
-- 1. BẢNG users: thêm các cột auth + status
-- ============================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_dn TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ldap_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status SMALLINT DEFAULT 1;

-- ============================
-- 2. BẢNG messages: thêm images + sources
-- ============================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS images JSONB DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT NULL;

-- ============================
-- 3. BẢNG token_usage: tạo nếu chưa có + thêm FK
-- ============================
CREATE TABLE IF NOT EXISTS token_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    conversation_id BIGINT,
    model VARCHAR(128),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thêm FK cho token_usage → users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_token_usage_user'
          AND table_name = 'token_usage'
    ) THEN
        ALTER TABLE token_usage
            ADD CONSTRAINT fk_token_usage_user
            FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

-- Thêm FK cho token_usage → conversations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_token_usage_conversation'
          AND table_name = 'token_usage'
    ) THEN
        ALTER TABLE token_usage
            ADD CONSTRAINT fk_token_usage_conversation
            FOREIGN KEY (conversation_id) REFERENCES conversations(id);
    END IF;
END $$;

-- ============================
-- 4. BẢNG message_feedback: tạo nếu chưa có + thêm FK
-- ============================
CREATE TABLE IF NOT EXISTS message_feedback (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT,
    feedback VARCHAR(4) NOT NULL CHECK (feedback IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (message_id, user_id)
);

-- Thêm FK cho message_feedback → messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_message_feedback_message'
          AND table_name = 'message_feedback'
    ) THEN
        ALTER TABLE message_feedback
            ADD CONSTRAINT fk_message_feedback_message
            FOREIGN KEY (message_id) REFERENCES messages(id);
    END IF;
END $$;

-- Thêm FK cho message_feedback → users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_message_feedback_user'
          AND table_name = 'message_feedback'
    ) THEN
        ALTER TABLE message_feedback
            ADD CONSTRAINT fk_message_feedback_user
            FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

-- ============================
-- 5. BẢNG question_feedback: tạo nếu chưa có
-- ============================
CREATE TABLE IF NOT EXISTS question_feedback (
    id BIGSERIAL PRIMARY KEY,
    question_hash VARCHAR(32) NOT NULL UNIQUE,
    question_text TEXT,
    up_count INTEGER DEFAULT 0,
    down_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================
-- 6. Dữ liệu mẫu positions
-- ============================
INSERT INTO positions (id, position_name, level, created_at, updated_at)
VALUES
    (1, 'Intern', 0, NOW(), NOW()),
    (2, 'Employee', 1, NOW(), NOW()),
    (3, 'PM/SM/Team Lead', 2, NOW(), NOW()),
    (4, 'DL', 3, NOW(), NOW()),
    (5, 'C-Level', 4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================
-- DONE
-- ============================
