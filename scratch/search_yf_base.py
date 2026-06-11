import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "YF_BASE" in line or "NSE_HEADERS" in line:
        print(f"Line {i+1}: {line.strip()}")
