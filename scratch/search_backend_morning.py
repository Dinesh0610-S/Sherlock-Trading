import sys
sys.stdout.reconfigure(encoding="utf-8")

def search_word(filename, word):
    with open(filename, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if word in line:
            print(f"{filename} Line {i+1}: {line.strip()}")

search_word("server.js", "morning")
print("---")
search_word("backend/server.py", "morning")
