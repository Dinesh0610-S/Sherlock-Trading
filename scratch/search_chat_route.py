with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "/api/chat" in l:
        print(f"Line {i+1}: {l.strip()}")
        for j in range(i, min(i + 35, len(lines))):
            print(f"  {j+1}: {lines[j].strip()}")
        print("-" * 50)
