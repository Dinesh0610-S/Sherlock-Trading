import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines in log: {len(lines)}")
print("=== LAST 20 LINES ===")
for line in lines[-20:]:
    obj = json.loads(line)
    typ = obj.get("type")
    idx = obj.get("step_index")
    content = obj.get("content", "")
    if content is None:
        content = ""
    print(f"Step {idx} ({typ}): {content[:200]}...")
