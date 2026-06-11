import os
import re

path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\backtester.py"
out_path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\backtester_stats.txt"

if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        code = f.read()
    
    matches = re.finditer(r"def\s+calc_stats\(.*?\):.*?return\s+\w+", code, re.DOTALL)
    with open(out_path, "w", encoding="utf-8") as out:
        for m in matches:
            out.write(m.group(0) + "\n\n")
            out.write("-" * 50 + "\n\n")
    print("Done writing to scratch/backtester_stats.txt")
else:
    print("Backtester backend file not found")
