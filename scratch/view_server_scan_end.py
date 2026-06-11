import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "app.get('/api/premarket/scan'" in line:
        for j in range(i + 150, i + 300):
            if j < len(lines):
                print(f"Line {j+1}: {lines[j].strip()}")
        break
