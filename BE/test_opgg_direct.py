"""Test web_reader_tool directly on op.gg"""
import asyncio
import sys
sys.path.insert(0, r"C:\Users\quan2\Downloads\chatbot\Chatbot\BE")
from agents.web_reader_tool import WebReaderTool

async def main():
    tool = WebReaderTool()
    print("Testing op.gg scrape...", flush=True)
    result = await tool.read_url("https://op.gg/tft/meta-trends/comps")
    print(f"Success: {result.get('success')}", flush=True)
    print(f"Error: {result.get('error', 'none')}", flush=True)
    content = result.get('content', '')
    print(f"Content length: {len(content)}", flush=True)
    if content:
        print(f"First 500 chars:\n{content[:500]}", flush=True)
    else:
        print("No content returned!", flush=True)

asyncio.run(main())
