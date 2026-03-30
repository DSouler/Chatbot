-- Chatbot DB schema upgrade for social-network style product
-- Safe migration: only CREATE/ALTER IF NOT EXISTS, no destructive change

BEGIN;

-- 1) Conversation enhancements
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS tenant_id TEXT,
    ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) DEFAULT 'dm', -- dm | group | bot
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private',    -- private | followers | public
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_lastmsg ON conversations (tenant_id, last_message_at DESC);

-- 2) Multi-participant conversation (group chat support)
CREATE TABLE IF NOT EXISTS conversation_participants (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- owner | admin | member | bot
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_message_id BIGINT,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation ON conversation_participants (conversation_id);

-- 3) Message enhancements
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text', -- text | image | file | tool | system
    ADD COLUMN IF NOT EXISTS parent_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS seq_no BIGINT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_created ON messages (conversation_id, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages (parent_message_id);

-- 4) Attachments table (normalize images/files instead of JSON-only)
CREATE TABLE IF NOT EXISTS message_attachments (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    attachment_type VARCHAR(20) NOT NULL, -- image | file | audio | video
    storage_provider VARCHAR(20) NOT NULL DEFAULT 's3', -- s3 | local | qdrant
    object_key TEXT,
    url TEXT,
    mime_type VARCHAR(120),
    size_bytes BIGINT,
    width INT,
    height INT,
    duration_ms INT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments (message_id);

-- 5) Reactions/feedback (keep old message_feedback for compatibility)
CREATE TABLE IF NOT EXISTS message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(30) NOT NULL, -- like | dislike | laugh | heart | etc.
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions (user_id, created_at DESC);

-- 6) LLM run/audit table for observability and billing
CREATE TABLE IF NOT EXISTS llm_message_runs (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    tenant_id TEXT,
    provider VARCHAR(50),
    model VARCHAR(128),
    request_payload JSONB,
    response_payload JSONB,
    latency_ms INT,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'success', -- success | failed | timeout
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_runs_conversation_created ON llm_message_runs (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_runs_user_created ON llm_message_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_runs_model_created ON llm_message_runs (model, created_at DESC);

-- 7) RAG sources normalized (instead of only messages.sources JSONB)
CREATE TABLE IF NOT EXISTS message_sources (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    source_type VARCHAR(20) DEFAULT 'doc', -- doc | web | tool | db
    source_id TEXT,
    source_title TEXT,
    source_url TEXT,
    chunk_id BIGINT REFERENCES chunks(id) ON DELETE SET NULL,
    file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
    score NUMERIC(10,6),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_sources_message ON message_sources (message_id);
CREATE INDEX IF NOT EXISTS idx_message_sources_chunk ON message_sources (chunk_id);

-- 8) Optional social graph, if chatbot is embedded in social network app
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON user_follows (followee_id, created_at DESC);

-- 9) Backfill convenience: keep conversations.last_message_at updated for old rows
UPDATE conversations c
SET last_message_at = m.max_created
FROM (
    SELECT conversation_id, MAX(created_at) AS max_created
    FROM messages
    GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id
  AND c.last_message_at IS NULL;

COMMIT;
