import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(2980, 3030):
    if i < len(lines):
        print(f"Line {i+1}: {lines[i].strip()}")
