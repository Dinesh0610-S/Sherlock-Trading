import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "calculatePreMarketConfidence" in line:
        print(f"server.js Line {i+1}: {line.strip()}")
