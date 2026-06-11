import json

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line)
        tcalls = obj.get("tool_calls", [])
        for tc in tcalls:
            if "run_command" in tc.get("name", ""):
                # We can check if it returns task-5358
                pass
        # Let's search the whole file for the string task-5358
        if "task-5358" in line:
            print(f"Step {obj.get('step_index')}: type {obj.get('type')}")
            content = obj.get("content", "")
            if content:
                print(content[:300])
