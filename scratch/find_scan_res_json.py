import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js.bak"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for j in range(2938, 3445):
    if "res.json" in lines[j] or "res.send" in lines[j]:
        print(f"Line {j+1}: {lines[j].strip()}")
