import sys

sys.stdout.reconfigure(encoding="utf-8")

file_path = r"backend/ai_advisory.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "FIX" in line or "Fix" in line or "safety" in line or "gate" in line:
        print(f"Line {i+1}: {line.strip()}")
