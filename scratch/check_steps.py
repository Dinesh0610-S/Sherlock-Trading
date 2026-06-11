import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        obj = json.loads(line)
        step_idx = obj.get("step_index")
        if step_idx is not None and 5700 <= step_idx <= 5745:
            typ = obj.get("type")
            content = obj.get("content", "")
            if content is None:
                content = ""
            print(f"Step {step_idx} ({typ}): {content[:100]}...")
