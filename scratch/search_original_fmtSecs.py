import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx.bak"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "fmtSecs" in line:
        print(f"Original Line {i+1}: {line.strip()}")
