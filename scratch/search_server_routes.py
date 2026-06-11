import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "app.get(" in line or "app.post(" in line or "app.use(" in line:
        print(f"Line {i+1}: {line.strip()}")
