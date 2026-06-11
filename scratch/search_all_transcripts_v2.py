import os
import json

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
for root, dirs, files in os.walk(brain_dir):
    if "transcript.jsonl" in files:
        path = os.path.join(root, "transcript.jsonl")
        try:
            with open(path, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    if "FIX 1: " in line or "FIX 2: " in line or "FIX 3: " in line:
                        try:
                            obj = json.loads(line)
                            content = obj.get("content", "")
                            # let's see if there is any truncated text
                            has_trunc = "truncated" in content.lower()
                            print(f"{path} L{idx}: len={len(content)}, has_trunc={has_trunc}, type={obj.get('type')}, source={obj.get('source')}")
                        except Exception as json_err:
                            pass
        except Exception as e:
            pass
