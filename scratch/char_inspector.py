import sys
sys.stdout.reconfigure(encoding="utf-8")

def inspect_line(filename, line_no):
    with open(filename, "r", encoding="utf-8") as f:
        lines = f.readlines()
    line = lines[line_no - 1]
    print(f"File: {filename}, Line: {line_no}")
    print(f"String: {repr(line)}")
    print("Chars:")
    for c in line:
        print(f"  {repr(c)} (code: {ord(c)})")

inspect_line("src/App.jsx", 323)
print("\n---")
inspect_line("src/App.jsx.bak", 315)
