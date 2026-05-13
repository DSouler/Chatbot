-- ============================================================
-- VChatbot Database Schema
-- Đồng bộ với hệ thống thực tế (auth-service + BE controllers)
-- ============================================================

-- companies
CREATE TABLE IF NOT EXISTS companies (
    company_id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- departments
CREATE TABLE IF NOT EXISTS departments (
    department_id BIGSERIAL PRIMARY KEY,
    department_name TEXT NOT NULL,
    company_id BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- positions
CREATE TABLE IF NOT EXISTS positions (
    id BIGSERIAL PRIMARY KEY,
    position_name TEXT,
    level INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- users
-- Bao gồm đầy đủ các cột auth (email, password_hash, role, LDAP, status)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT,
    position_id BIGINT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT UNIQUE,
    email VARCHAR(255),
    password_hash TEXT,
    role TEXT,
    ldap_dn TEXT,
    is_ldap_user BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status SMALLINT DEFAULT 1,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (position_id) REFERENCES positions(id)
);

-- collection
CREATE TABLE IF NOT EXISTS collection (
    id BIGSERIAL PRIMARY KEY,
    collection_name TEXT,
    collection_desc TEXT,
    owner TEXT,
    status INT,
    updated_at TIMESTAMP,
    created_at TIMESTAMP
);

-- files
CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    original_name TEXT,
    uploaded_name TEXT,
    collection_id BIGINT,
    url TEXT,
    extension TEXT,
    type INT,
    level INT,
    owner TEXT,
    status SMALLINT,
    size TEXT,
    created_by BIGINT,
    updated_by BIGINT,
    updated_at TIMESTAMP,
    created_at TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collection(id)
);

-- chunks
CREATE TABLE IF NOT EXISTS chunks (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT,
    file_name TEXT,
    file_path TEXT,
    level INT,
    owner TEXT,
    description TEXT,
    status SMALLINT,
    updated_at TIMESTAMP,
    created_at TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id)
);

-- scopes
CREATE TABLE IF NOT EXISTS scopes (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT,
    company_id BIGINT NOT NULL,
    chunk_id BIGINT NOT NULL,
    updated_at TIMESTAMP,
    created_at TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (company_id) REFERENCES companies(company_id),
    FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

-- retrieval_settings
CREATE TABLE IF NOT EXISTS retrieval_settings (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    retrieval_mode BIGINT,
    search_type SMALLINT,
    prioritize_table SMALLINT,
    use_mmr SMALLINT,
    use_reranking SMALLINT,
    use_lim_relevant_scoring SMALLINT,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- reasoning_settings
CREATE TABLE IF NOT EXISTS reasoning_settings (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    reasoning_level INT,
    use_advanced_logic BOOLEAN,
    max_depth INTEGER,
    language TEXT,
    framework TEXT,
    system_prompt TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- conversations
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR,
    status SMALLINT,
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- messages
-- Bao gồm images (JSONB) và sources (JSONB) được sử dụng bởi controller
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    status SMALLINT,
    content TEXT,
    role VARCHAR(20) DEFAULT 'user',
    updated_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_by BIGINT,
    created_by BIGINT,
    images JSONB DEFAULT NULL,
    sources JSONB DEFAULT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- token_usage
-- Ghi nhận lượng token tiêu thụ mỗi khi LLM trả lời (được gọi từ app.py → record_token_usage)
CREATE TABLE IF NOT EXISTS token_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    conversation_id BIGINT,
    model VARCHAR(128),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- message_feedback
-- Lưu phản hồi (up/down) của từng user cho từng tin nhắn assistant
CREATE TABLE IF NOT EXISTS message_feedback (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT,
    feedback VARCHAR(4) NOT NULL CHECK (feedback IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- question_feedback
-- Gom nhóm phản hồi theo nội dung câu hỏi (dùng MD5 hash) để thống kê cross-conversation
CREATE TABLE IF NOT EXISTS question_feedback (
    id BIGSERIAL PRIMARY KEY,
    question_hash VARCHAR(32) NOT NULL UNIQUE,
    question_text TEXT,
    up_count INTEGER DEFAULT 0,
    down_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Dữ liệu mẫu
-- ============================================================

-- Positions mặc định
INSERT INTO positions (id, position_name, level, created_at, updated_at)
VALUES
    (1, 'Intern', 0, NOW(), NOW()),
    (2, 'Employee', 1, NOW(), NOW()),
    (3, 'PM/SM/Team Lead', 2, NOW(), NOW()),
    (4, 'DL', 3, NOW(), NOW()),
    (5, 'C-Level', 4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
