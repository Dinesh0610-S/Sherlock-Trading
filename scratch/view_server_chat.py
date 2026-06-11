with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\backend\server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\server_chat.txt", "w", encoding="utf-8") as out:
    for idx in range(524, min(590, len(lines))):
        out.write(f"{idx+1}: {lines[idx].strip()}\n")

print("Done writing to scratch/server_chat.txt")
