import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "function fetchYFQuoteRaw" in line or "const fetchYFQuoteRaw" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 50 lines below
        for j in range(i, min(i+50, len(lines))):
            print(f"  {j+1}: {lines[j].rstrip()}")
