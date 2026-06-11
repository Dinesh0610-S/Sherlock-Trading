import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for j in range(315, 335):
    if j < len(lines):
        print(f"Line {j+1}: {lines[j].rstrip()}")
