import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "countdown" in line.lower():
        print(f"Line {i+1}: {line.strip()}")
