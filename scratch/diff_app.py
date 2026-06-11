import difflib

file1 = "src/App.jsx.bak"
file2 = "src/App.jsx"

with open(file1, "r", encoding="utf-8") as f1, open(file2, "r", encoding="utf-8") as f2:
    lines1 = f1.readlines()
    lines2 = f2.readlines()

diff = difflib.unified_diff(lines1, lines2, fromfile=file1, tofile=file2, n=3)

# Write to file
with open("scratch/app_diff.txt", "w", encoding="utf-8") as out:
    out.writelines(diff)
print("Saved diff to scratch/app_diff.txt")
