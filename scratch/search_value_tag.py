import os
import sys
sys.stdout.reconfigure(encoding="utf-8")

search_dir = "src"
for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith(".jsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            for i, line in enumerate(lines):
                if "<value" in line:
                    print(f"{path}:{i+1}: {line.strip()}")
