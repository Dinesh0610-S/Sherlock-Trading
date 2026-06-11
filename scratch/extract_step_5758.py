import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line)
        if obj.get("step_index") == 5758:
            print(obj.get("content", ""))
            break
