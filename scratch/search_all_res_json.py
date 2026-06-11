import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js.bak"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "res.json" in line or "res.send" in line:
        print(f"Line {i+1}: {line.strip()}")
