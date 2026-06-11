import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Line 75 (1-based index 76):", repr(lines[75]))
print("Line 76 (1-based index 77):", repr(lines[76]))
print("Line 1005 (1-based index 1006):", repr(lines[1005]))
print("Line 1006 (1-based index 1007):", repr(lines[1006]))
print("Line 1007 (1-based index 1008):", repr(lines[1007]))
print("Line 1008 (1-based index 1009):", repr(lines[1008]))
