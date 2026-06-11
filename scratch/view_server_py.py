with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    code = f.read()

import re
match = re.search(r"\"indicators\":\s*\{.*?\}", code, re.DOTALL)
if match:
    print(match.group(0))
else:
    # Try finding indicator keys mapped
    lines = code.splitlines()
    for i, l in enumerate(lines):
        if "indicators" in l or "ema_50" in l or "avg_volume_20d" in l:
            print(f"Line {i+1}: {l.strip()}")
