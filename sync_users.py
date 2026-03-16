import psycopg2

# Sync user from auth_db to vchatbot
auth_conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='postgres',
    dbname='auth_db'
)

vchat_conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='postgres',
    dbname='vchatbot'
)

auth_cur = auth_conn.cursor()
vchat_cur = vchat_conn.cursor()

# Get all users from auth_db
auth_cur.execute('SELECT id, username, email, first_name, last_name, department_id, position_id, role FROM users')
auth_users = auth_cur.fetchall()

print(f"Found {len(auth_users)} users in auth_db")

for user in auth_users:
    user_id, username, email, first_name, last_name, dept_id, pos_id, role = user

    # Check if user exists in vchatbot
    vchat_cur.execute('SELECT id FROM users WHERE id = %s', (user_id,))
    exists = vchat_cur.fetchone()

    if not exists:
        print(f"Inserting user {user_id} ({username}) into vchatbot...")

        # Insert user into vchatbot (without role column)
        vchat_cur.execute('''
            INSERT INTO users (id, username, first_name, last_name, department_id, position_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        ''', (user_id, username, first_name, last_name, dept_id, pos_id))

        print(f"  [OK] User {user_id} synced")
    else:
        print(f"User {user_id} ({username}) already exists in vchatbot")

vchat_conn.commit()
print(f"\nSync completed!")

auth_conn.close()
vchat_conn.close()
