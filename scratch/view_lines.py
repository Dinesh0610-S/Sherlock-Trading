import sys

start_line = int(sys.argv[1]) if len(sys.argv) > 1 else 3200
end_line = int(sys.argv[2]) if len(sys.argv) > 2 else 3350

filepath = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

output_path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\lines_out.txt"
with open(output_path, "w", encoding="utf-8") as out:
    for i in range(start_line - 1, min(end_line, len(lines))):
        out.write(f"{i+1}: {lines[i]}")

print(f"Written lines {start_line} to {end_line} to scratch/lines_out.txt")
