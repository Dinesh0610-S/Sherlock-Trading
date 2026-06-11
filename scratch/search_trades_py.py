with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "/api/trades" in l or "trades/close" in l:
        print(f"Line {i+1}: {l.strip()}")
        # print 20 lines after
        for j in range(i, min(i + 25, len(lines))):
            print(f"  {j+1}: {lines[j].strip()}")
        print("-" * 50)
