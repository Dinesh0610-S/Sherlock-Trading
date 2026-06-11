import json
import os

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if "Fix 6 critical trading logic" in line:
            obj = json.loads(line)
            content = obj.get("content", "")
            print(f"Line {idx}: step {obj.get('step_index')}, type {obj.get('type')}, length {len(content)}")
