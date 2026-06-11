import sys

sys.stdout.reconfigure(encoding="utf-8")

file_path = "backend/ai_advisory.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "rsi_warning" in line or "rsi_warning_text" in line:
        print(f"Line {i+1}: {line.strip()}")
