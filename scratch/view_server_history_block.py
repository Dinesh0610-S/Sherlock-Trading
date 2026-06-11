import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js.bak"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for j in range(3050, 3260):
    if j < len(lines):
        print(f"Line {j+1}: {lines[j].rstrip()}")
