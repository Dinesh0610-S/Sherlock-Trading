with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    code = f.read()

import re
matches = re.finditer(r"def\s+add_trade\(\).*?return\s+jsonify", code, re.DOTALL)
for m in matches:
    print(m.group(0))
    print("-" * 50)

matches = re.finditer(r"def\s+close_trade\(\).*?return\s+jsonify", code, re.DOTALL)
for m in matches:
    print(m.group(0))
    print("-" * 50)
