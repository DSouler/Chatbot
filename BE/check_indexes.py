import time
import requests

print("Testing with http://localhost:8096/history/1 ...")
for i in range(1, 3):
    t0 = time.time()
    try:
        res = requests.get("http://localhost:8096/history/1")
        print(f"localhost Request {i}: Status {res.status_code}, time {time.time() - t0:.4f} seconds")
    except Exception as e:
        print(f"localhost Request {i} failed: {e}")

print("\nTesting with http://127.0.0.1:8096/history/1 ...")
for i in range(1, 3):
    t0 = time.time()
    try:
        res = requests.get("http://127.0.0.1:8096/history/1")
        print(f"127.0.0.1 Request {i}: Status {res.status_code}, time {time.time() - t0:.4f} seconds")
    except Exception as e:
        print(f"127.0.0.1 Request {i} failed: {e}")
