"""Quick test of WEB_SEARCH endpoint with URL"""
import urllib.request
import json
import sys

data = json.dumps({
    "question": "https://op.gg/tft/meta-trends/comps doi hinh nao dang tier OP",
    "mode": "WEB_SEARCH",
    "retrieval_settings": {
        "retrieval_mode": "vector",
        "use_MMR": False,
        "use_reranking": False,
        "use_llm_relevant_scoring": False,
        "prioritize_table": False
    },
    "reasoning_settings": {
        "language": "Vietnamese",
        "llm": {"model": "gpt-4o-mini"}
    },
    "chat_history": []
}).encode("utf-8")

print("Sending request to /chat/message...", flush=True)
req = urllib.request.Request(
    "http://localhost:8096/chat/message",
    data=data,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        print(f"HTTP {resp.status}", flush=True)
        count = 0
        for line in resp:
            decoded = line.decode("utf-8").strip()
            if decoded and count < 40:
                print(decoded, flush=True)
                count += 1
                if "done" in decoded:
                    break
except Exception as e:
    print(f"ERROR: {e}", flush=True)
    sys.exit(1)
