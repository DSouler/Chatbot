import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Database config
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_NAME = os.getenv("POSTGRES_DB", "vchatbot")

# ⚠️ QUAN TRỌNG: dùng tên service postgres trong docker
DB_HOST = os.getenv("POSTGRES_HOST", "postgres")

# ⚠️ port postgres trong docker luôn là 5432
DB_PORT = os.getenv("POSTGRES_PORT", "5432")


def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        cursor_factory=RealDictCursor
    )


def init_messages_images_column():
    """Add images JSONB column to messages table if it doesn't exist."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS images JSONB DEFAULT NULL
    """)
    cur.execute("""
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT NULL
    """)
    conn.commit(); cur.close(); conn.close()


# Update conversation name
def update_conversation_name(user_id, conversation_id, name):
    conn = get_connection(); cur = conn.cursor()
    cur.execute(
        "UPDATE conversations SET name=%s WHERE id=%s AND user_id=%s",
        (name, conversation_id, user_id)
    )
    conn.commit(); cur.close(); conn.close()


# Create conversation
def create_conversation(user_id, name):
    created_at = datetime.utcnow()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO conversations (user_id, name, status, created_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        (user_id, name, 1, created_at)
    )

    result = cur.fetchone()
    conversation_id = result["id"] if result else None

    conn.commit()
    cur.close()
    conn.close()

    return conversation_id


# Add message
def add_message(conversation_id, content, created_by, role="user", images=None):
    created_at = datetime.utcnow()
    images_param = Json(images) if images else None

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO messages (conversation_id, status, content, created_by, role, created_at, images)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (conversation_id, 1, content, created_by, role, created_at, images_param)
    )

    result = cur.fetchone()
    message_id = result["id"] if result else None

    conn.commit()
    cur.close()
    conn.close()

    return message_id


def update_last_bot_message(conversation_id, content, sources=None):
    """Update the content (and optionally sources) of the last assistant message in a conversation.
    Returns the real DB id of the updated message."""
    conn = get_connection()
    cur = conn.cursor()
    if sources is not None:
        cur.execute(
            """
            UPDATE messages SET content = %s, sources = %s
            WHERE id = (
                SELECT id FROM messages
                WHERE conversation_id = %s AND role = 'assistant'
                ORDER BY created_at DESC LIMIT 1
            )
            RETURNING id
            """,
            (content, Json(sources), conversation_id)
        )
    else:
        cur.execute(
            """
            UPDATE messages SET content = %s
            WHERE id = (
                SELECT id FROM messages
                WHERE conversation_id = %s AND role = 'assistant'
                ORDER BY created_at DESC LIMIT 1
            )
            RETURNING id
            """,
            (content, conversation_id)
        )
    row = cur.fetchone()
    message_id = row[0] if row else None
    conn.commit()
    cur.close()
    conn.close()
    return message_id


# Get all messages
def get_messages(conversation_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT * FROM messages
        WHERE conversation_id = %s
        ORDER BY created_at ASC
        """,
        (conversation_id,)
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Explicitly convert RealDictRow to plain dict so FastAPI serializes JSONB fields correctly.
    # If images column is a JSONB string (older psycopg2), parse it here too.
    messages = []
    for row in rows:
        d = dict(row)
        if isinstance(d.get('images'), str):
            try:
                d['images'] = json.loads(d['images'])
            except Exception:
                d['images'] = None
        if isinstance(d.get('sources'), str):
            try:
                d['sources'] = json.loads(d['sources'])
            except Exception:
                d['sources'] = None
        messages.append(d)

    return messages


# Get messages by role
def get_messages_by_role(conversation_id, role=None):
    conn = get_connection()
    cur = conn.cursor()

    if role:
        cur.execute(
            """
            SELECT * FROM messages
            WHERE conversation_id = %s AND role = %s
            ORDER BY created_at ASC
            """,
            (conversation_id, role)
        )
    else:
        cur.execute(
            """
            SELECT * FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at ASC
            """,
            (conversation_id,)
        )

    messages = cur.fetchall()

    cur.close()
    conn.close()

    return messages


# Get conversations by user
def get_conversations_by_user(user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT * FROM conversations
        WHERE user_id = %s
        ORDER BY id DESC
        """,
        (user_id,)
    )

    conversations = cur.fetchall()

    cur.close()
    conn.close()

    return conversations


# Get one conversation
def get_conversation_by_user_and_id(user_id, conversation_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT *
        FROM conversations
        WHERE user_id = %s AND id = %s
        """,
        (user_id, conversation_id)
    )

    conversation = cur.fetchone()

    cur.close()
    conn.close()

    return conversation


# Delete conversation
def delete_conversation_by_user_and_id(user_id, conversation_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        DELETE FROM messages
        WHERE conversation_id = %s
        """,
        (conversation_id,)
    )

    cur.execute(
        """
        DELETE FROM conversations
        WHERE user_id = %s AND id = %s
        """,
        (user_id, conversation_id)
    )

    conn.commit()

    cur.close()
    conn.close()

    return True


# Sync user from auth_db to vchatbot
def sync_user_from_auth_db(user_id, username, first_name=None, last_name=None, department_id=None, position_id=1):
    """
    Sync a user from auth_db to vchatbot database
    This is called after successful user registration
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        exists = cur.fetchone()

        if not exists:
            # Insert user
            created_at = datetime.utcnow()
            cur.execute(
                """
                INSERT INTO users (id, username, first_name, last_name, department_id, position_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (user_id, username, first_name, last_name, department_id, position_id, created_at)
            )
            conn.commit()
            return True
        else:
            return False  # User already exists
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


# --- token_usage table ---
def init_token_usage_table():
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS token_usage (
            id               SERIAL PRIMARY KEY,
            user_id          INTEGER,
            conversation_id  INTEGER,
            model            VARCHAR(128),
            prompt_tokens    INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            total_tokens     INTEGER DEFAULT 0,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit(); cur.close(); conn.close()


def record_token_usage(user_id, conversation_id, model, prompt_tokens, completion_tokens):
    total = (prompt_tokens or 0) + (completion_tokens or 0)
    conn = get_connection(); cur = conn.cursor()
    cur.execute(
        "INSERT INTO token_usage (user_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (user_id, conversation_id, model, prompt_tokens or 0, completion_tokens or 0, total, datetime.utcnow())
    )
    conn.commit(); cur.close(); conn.close()


def get_message_with_context(message_id: int):
    """Get an assistant message and the preceding user question in the same conversation."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT * FROM messages WHERE id = %s", (message_id,))
    msg = cur.fetchone()
    if not msg:
        cur.close(); conn.close()
        return None, None
    msg = dict(msg)
    cur.execute("""
        SELECT * FROM messages
        WHERE conversation_id = %s AND role = 'user' AND created_at < %s
        ORDER BY created_at DESC LIMIT 1
    """, (msg['conversation_id'], msg['created_at']))
    question_row = cur.fetchone()
    cur.close(); conn.close()
    return msg, dict(question_row) if question_row else None


# --- message_feedback table ---

def init_message_feedback_table():
    """Create message_feedback table if not exists."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS message_feedback (
            id SERIAL PRIMARY KEY,
            message_id BIGINT NOT NULL,
            user_id BIGINT,
            feedback VARCHAR(4) NOT NULL CHECK (feedback IN ('up', 'down')),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (message_id, user_id)
        )
    """)
    conn.commit(); cur.close(); conn.close()


def upsert_message_feedback(message_id: int, user_id, feedback: str):
    """Insert or update a user's feedback on a message."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO message_feedback (message_id, user_id, feedback)
        VALUES (%s, %s, %s)
        ON CONFLICT (message_id, user_id) DO UPDATE SET feedback = EXCLUDED.feedback
    """, (message_id, user_id, feedback))
    conn.commit(); cur.close(); conn.close()


def get_feedback_stats(message_id: int, user_id=None):
    """Get up/down counts and optional user vote for a single message."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE feedback = 'up')   AS up_count,
            COUNT(*) FILTER (WHERE feedback = 'down') AS down_count
        FROM message_feedback WHERE message_id = %s
    """, (message_id,))
    row = cur.fetchone()
    up = int(row['up_count']) if row else 0
    down = int(row['down_count']) if row else 0
    user_vote = None
    if user_id is not None:
        cur.execute(
            "SELECT feedback FROM message_feedback WHERE message_id = %s AND user_id = %s",
            (message_id, user_id)
        )
        vrow = cur.fetchone()
        if vrow:
            user_vote = vrow['feedback']
    cur.close(); conn.close()
    return {'up': up, 'down': down, 'user_vote': user_vote}


def get_batch_feedback_stats(message_ids: list, user_id=None):
    """Get feedback stats for multiple messages in one query."""
    if not message_ids:
        return {}
    conn = get_connection(); cur = conn.cursor()
    cur.execute("""
        SELECT message_id,
               COUNT(*) FILTER (WHERE feedback = 'up')   AS up_count,
               COUNT(*) FILTER (WHERE feedback = 'down') AS down_count
        FROM message_feedback
        WHERE message_id = ANY(%s)
        GROUP BY message_id
    """, (message_ids,))
    result = {mid: {'up': 0, 'down': 0, 'user_vote': None} for mid in message_ids}
    for row in cur.fetchall():
        result[row['message_id']]['up'] = int(row['up_count'])
        result[row['message_id']]['down'] = int(row['down_count'])
    if user_id is not None:
        cur.execute("""
            SELECT message_id, feedback FROM message_feedback
            WHERE message_id = ANY(%s) AND user_id = %s
        """, (message_ids, user_id))
        for vrow in cur.fetchall():
            result[vrow['message_id']]['user_vote'] = vrow['feedback']
    cur.close(); conn.close()
    return result


def get_usage_stats(user_id=None, days=30):
    conn = get_connection(); cur = conn.cursor()
    where = "WHERE created_at >= NOW() - INTERVAL '%s days'" % int(days)
    if user_id:
        where += " AND user_id = %s" % int(user_id)
    # Summary totals
    cur.execute(f"SELECT COALESCE(SUM(prompt_tokens),0) AS prompt_tokens, COALESCE(SUM(completion_tokens),0) AS completion_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens, COUNT(*) AS messages FROM token_usage {where}")
    summary = dict(cur.fetchone() or {})
    # Per-day breakdown
    cur.execute(f"SELECT DATE(created_at) AS day, COALESCE(SUM(prompt_tokens),0) AS prompt_tokens, COALESCE(SUM(completion_tokens),0) AS completion_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens, COUNT(*) AS messages FROM token_usage {where} GROUP BY DATE(created_at) ORDER BY day DESC")
    daily = [dict(row) for row in cur.fetchall()]
    cur.close(); conn.close()
    return {"summary": summary, "daily": daily}


def get_admin_feedback_report(days=30):
    """Aggregate feedback stats for admin report: summary, daily breakdown, top liked/disliked messages."""
    conn = get_connection(); cur = conn.cursor()
    days_int = int(days)

    # Summary totals
    cur.execute("""
        SELECT
            COALESCE(COUNT(*) FILTER (WHERE feedback = 'up'),   0) AS total_up,
            COALESCE(COUNT(*) FILTER (WHERE feedback = 'down'), 0) AS total_down,
            COUNT(DISTINCT user_id) AS total_voters
        FROM message_feedback
        WHERE created_at >= NOW() - INTERVAL '%s days'
    """ % days_int)
    summary = dict(cur.fetchone() or {})

    # Per-day breakdown
    cur.execute("""
        SELECT
            DATE(created_at) AS day,
            COALESCE(COUNT(*) FILTER (WHERE feedback = 'up'),   0) AS up_count,
            COALESCE(COUNT(*) FILTER (WHERE feedback = 'down'), 0) AS down_count
        FROM message_feedback
        WHERE created_at >= NOW() - INTERVAL '%s days'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    """ % days_int)
    daily = [dict(row) for row in cur.fetchall()]

    # Top 10 liked messages
    cur.execute("""
        SELECT
            mf.message_id,
            COALESCE(COUNT(*) FILTER (WHERE mf.feedback = 'up'),   0) AS up_count,
            COALESCE(COUNT(*) FILTER (WHERE mf.feedback = 'down'), 0) AS down_count,
            m.content,
            m.conversation_id,
            m.created_at AS message_created_at
        FROM message_feedback mf
        LEFT JOIN messages m ON m.id = mf.message_id
        GROUP BY mf.message_id, m.content, m.conversation_id, m.created_at
        HAVING COUNT(*) FILTER (WHERE mf.feedback = 'up') > 0
        ORDER BY up_count DESC, down_count ASC
        LIMIT 10
    """)
    top_liked = [dict(row) for row in cur.fetchall()]

    # Top 10 disliked messages
    cur.execute("""
        SELECT
            mf.message_id,
            COALESCE(COUNT(*) FILTER (WHERE mf.feedback = 'up'),   0) AS up_count,
            COALESCE(COUNT(*) FILTER (WHERE mf.feedback = 'down'), 0) AS down_count,
            m.content,
            m.conversation_id,
            m.created_at AS message_created_at
        FROM message_feedback mf
        LEFT JOIN messages m ON m.id = mf.message_id
        GROUP BY mf.message_id, m.content, m.conversation_id, m.created_at
        HAVING COUNT(*) FILTER (WHERE mf.feedback = 'down') > 0
        ORDER BY down_count DESC, up_count ASC
        LIMIT 10
    """)
    top_disliked = [dict(row) for row in cur.fetchall()]

    cur.close(); conn.close()
    return {
        "summary": summary,
        "daily": daily,
        "top_liked": top_liked,
        "top_disliked": top_disliked,
    }