import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "SENSEX" in line or "bse" in line or "BSE" in line:
        print(f"Line {i+1}: {line.strip()}")
