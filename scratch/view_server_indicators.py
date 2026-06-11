with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(259, min(290, len(lines))):
    print(f"{idx+1}: {lines[idx].strip()}")
