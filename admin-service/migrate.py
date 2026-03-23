import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("POSTGRES_USER", "admin")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin")
DB_NAME = os.getenv("POSTGRES_DB", "postgres")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5439")

def migrate(sql_path="schema.sql"):
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()
    statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    for stmt in statements:
        try:
            cur.execute(stmt)
        except Exception as e:
            print(f"Error executing: {stmt}\n{e}")
    conn.commit()
    cur.close()
    conn.close()
    print("Migration done!") 