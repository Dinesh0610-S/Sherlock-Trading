import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "export default function App" in line:
        print(f"App starts at Line {i+1}")
        for j in range(i, i+15):
            print(f"Line {j+1}: {lines[j].rstrip()}")
