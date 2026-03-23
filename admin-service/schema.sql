-- companies
CREATE TABLE IF NOT EXISTS companies (
    company_id BIGINT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- departments
CREATE TABLE IF NOT EXISTS departments (
    id BIGINT PRIMARY KEY,
    department_id BIGINT UNIQUE, -- Cho phép NULL nhưng phải UNIQUE để làm FOREIGN KEY
    department_name TEXT NOT NULL,
    company_id BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- positions
CREATE TABLE IF NOT EXISTS positions (
    id BIGINT PRIMARY KEY,
    position_name TEXT,
    level INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    department_id BIGINT, -- cho phép NULL
    position_id BIGINT NOT NULL,
    level INT,
    first_name TEXT,
    last_name TEXT,
    username TEXT UNIQUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (position_id) REFERENCES positions(id)
);

-- collection
CREATE TABLE IF NOT EXISTS collection (
    id BIGINT PRIMARY KEY,
    collection_name TEXT,
    collection_desc TEXT,
    owner TEXT,
    status INT,
    updated_at TIMESTAMP,
    created_at TIMESTAMP
);

-- files
CREATE TABLE IF NOT EXISTS files (
    id BIGINT PRIMARY KEY,
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
    id BIGINT PRIMARY KEY,
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
    id BIGINT PRIMARY KEY,
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
    id BIGINT PRIMARY KEY,
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
    id BIGINT PRIMARY KEY,
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
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
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

-- Thêm cột content
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;

-- Thêm cột role  
ALTER TABLE messages ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
