import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'className="header-meta"' in line or 'badge-live' in line:
        print(f"Header meta starts at Line {i+1}")
        for j in range(i - 2, i + 10):
            if j < len(lines):
                print(f"Line {j+1}: {lines[j].rstrip()}")
