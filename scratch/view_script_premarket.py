import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Extract from line 76 (index 75) to line 998 (index 997)
extracted = lines[75:998]

# Print first 20 and last 20 lines to verify
print("First 20 lines:")
for line in extracted[:20]:
    print(line.rstrip())

print("\nLast 20 lines:")
for line in extracted[-20:]:
    print(line.rstrip())
