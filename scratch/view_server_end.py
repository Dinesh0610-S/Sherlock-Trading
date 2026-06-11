import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
for j in range(max(0, len(lines) - 50), len(lines)):
    print(f"Line {j+1}: {lines[j].rstrip()}")
