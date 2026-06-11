with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\server.js", "r", encoding="utf-8") as f:
    code = f.read()

import re
matches = re.finditer(r"app\.get\(['\"]/api/nse/[^'\"]+['\"].*?\}\);", code, re.DOTALL)
for m in matches:
    print(m.group(0))
    print("-" * 50)
