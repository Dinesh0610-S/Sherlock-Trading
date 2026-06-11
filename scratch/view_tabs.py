import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "nav-tab" in line or "activeTab" in line:
        if "button" in line or "&&" in line or "Tab" in line:
            print(f"Line {i+1}: {line.strip()}")
