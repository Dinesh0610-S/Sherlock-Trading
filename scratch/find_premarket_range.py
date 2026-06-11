import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start = 270
for i in range(260, 1100):
    if i < len(lines):
        line = lines[i]
        if "Formatting Utilities" in line or "function" in line or "export default" in line:
            print(f"Line {i+1}: {line.strip()}")
