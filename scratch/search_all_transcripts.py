import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"

for root, dirs, files in os.walk(brain_dir):
    if "transcript.jsonl" in files:
        path = os.path.join(root, "transcript.jsonl")
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    if "Fix 6 critical trading logic errors" in line:
                        obj = json.loads(line)
                        content = obj.get("content", "")
                        print(f"FOUND in {path}: length {len(content)}")
                        # If content contains more details (not truncated, or less truncated)
                        if "FIX 2" in content or "FIX 3" in content or "FIX 4" in content:
                            print("This might be the full one!")
                            # Save it to a file
                            out_path = "scratch/found_full_request.txt"
                            with open(out_path, "w", encoding="utf-8") as out:
                                out.write(content)
                            print(f"Saved to {out_path}")
        except Exception as e:
            print(f"Error reading {path}: {e}")
