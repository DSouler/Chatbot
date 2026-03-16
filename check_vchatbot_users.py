import psycopg2

c = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='postgres',
    dbname='vchatbot'
)
cur = c.cursor()

cur.execute('SELECT id, username FROM users')
users = cur.fetchall()

print('=== vchatbot database users ===')
if users:
    for r in users:
        print(f'ID: {r[0]}, Username: {r[1]}')
else:
    print('No users found')

cur.execute('SELECT COUNT(*) FROM conversations')
print(f'\nTotal conversations: {cur.fetchone()[0]}')

c.close()
