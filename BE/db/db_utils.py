import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_NAME = os.getenv("POSTGRES_DB", "vchatbot")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5433")

def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        cursor_factory=RealDictCursor
    )

def create_conversation(user_id, name):
    created_at = datetime.utcnow()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conversations (user_id, name, status, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
        (user_id, name, 1, created_at)
    )
    result = cur.fetchone()
    conversation_id = result['id'] if result else None
    conn.commit()
    cur.close()
    conn.close()
    return conversation_id

def add_message(conversation_id, content, created_by, role='user'):
    created_at = datetime.utcnow()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (conversation_id, status, content, created_by, role, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (conversation_id, 1, content, created_by, role, created_at)
    )
    result = cur.fetchone()
    message_id = result['id'] if result else None
    conn.commit()
    cur.close()
    conn.close()
    return message_id

def get_messages(conversation_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
        (conversation_id,)
    )
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return messages

def get_messages_by_role(conversation_id, role=None):
    conn = get_connection()
    cur = conn.cursor()
    if role:
        cur.execute(
            "SELECT * FROM messages WHERE conversation_id = %s AND role = %s ORDER BY created_at ASC",
            (conversation_id, role)
        )
    else:
        cur.execute(
            "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
            (conversation_id,)
        )
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return messages

def get_conversations_by_user(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM conversations WHERE user_id = %s ORDER BY id DESC",
        (user_id,)
    )
    conversations = cur.fetchall()
    cur.close()
    conn.close()
    return conversations

def get_conversation_by_user_and_id(user_id, conversation_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM conversations WHERE user_id = %s AND id = %s ",
        (user_id, conversation_id)
    )
    conversation = cur.fetchone()
    cur.close()
    conn.close()
    return conversation

def delete_conversation_by_user_and_id(user_id, conversation_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM conversations WHERE user_id = %s AND id = %s",
        (user_id, conversation_id)
    )
    conn.commit()
    cur.close()
    conn.close()
    return True
