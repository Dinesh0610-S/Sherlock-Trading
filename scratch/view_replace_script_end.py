import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for j in range(980, min(len(lines), 1015)):
    print(f"Line {j+1}: {lines[j].rstrip()}")
