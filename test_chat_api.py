import requests
import json

# Test chat API
url = "http://localhost:8000/chat/message"

request_data = {
    "question": "Xin chào",
    "conversation_id": None,
    "created_by": 1,
    "chat_history": [],
    "mode": "RAG",
    "retrieval_settings": {
        "retrieval_mode": "vector",
        "use_MMR": False,
        "use_reranking": False,
        "use_llm_relevant_scoring": False,
        "prioritize_table": False
    },
    "reasoning_settings": {
        "language": "Vietnamese",
        "framework": "simple",
        "llm": {
            "model": "gpt-4o-mini",
            "temperature": 0.7
        }
    }
}

print("Testing chat API...")
print(f"URL: {url}")
print(f"Request data: {json.dumps(request_data, indent=2)}")
print("-" * 50)

try:
    response = requests.post(url, json=request_data, stream=True, timeout=30)
    print(f"Status code: {response.status_code}")

    if response.status_code == 200:
        print("\n✓ API is working! Streaming response:")
        for line in response.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    try:
                        data = json.loads(decoded[6:])
                        print(f"  - {data.get('type')}: {data.get('content', data.get('message', ''))[:50]}")
                    except:
                        pass
    else:
        print(f"\n✗ Error: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"\n✗ Exception: {e}")
