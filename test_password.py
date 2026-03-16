from passlib.context import CryptContext
import psycopg2

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

# Connect to database
c = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='postgres',
    dbname='auth_db'
)
cur = c.cursor()
cur.execute('SELECT username, password_hash FROM users WHERE username = %s', ('user1',))
r = cur.fetchone()

if r and r[1]:
    username, password_hash = r
    print(f"Testing passwords for user: {username}")
    print(f"Password hash starts with: {password_hash[:30]}...")

    # Test common passwords
    passwords_to_test = ['password123', '123456', 'password', '12345678', 'admin', 'user1', 'Password123']

    for pwd in passwords_to_test:
        result = pwd_context.verify(pwd, password_hash)
        status = "[MATCH]" if result else "[No match]"
        print(f"{status}: '{pwd}'")
else:
    print('No user found or no password hash')

c.close()
