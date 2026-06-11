filepath = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "optionMetrics" in line or "setOptionMetrics" in line:
        print(f"Line {i+1}: {line.strip()}")
