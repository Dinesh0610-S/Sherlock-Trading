import os
import sys

path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\morning_brief.py"
out_path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\morning_brief_code.txt"

if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        code = f.read()
    with open(out_path, "w", encoding="utf-8") as out:
        out.write(code[:3000])
    print("Done writing to scratch/morning_brief_code.txt")
else:
    print(f"File not found: {path}")
