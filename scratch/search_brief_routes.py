with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\brief_route.txt", "w", encoding="utf-8") as out:
    for i, l in enumerate(lines):
        if "get_morning_brief" in l:
            out.write(f"Line {i+1}: {l.strip()}\n")
            for j in range(i, min(i + 20, len(lines))):
                out.write(f"  {j+1}: {lines[j].strip()}\n")
            out.write("-" * 50 + "\n")

print("Done writing to scratch/brief_route.txt")
