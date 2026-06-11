import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/index.css"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if " value" in line or "value {" in line or "value," in line:
        print(f"Line {i+1}: {line.strip()}")
