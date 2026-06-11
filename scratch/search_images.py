import os
import sys
sys.stdout.reconfigure(encoding="utf-8")

search_paths = [
    "c:\\Users\\DINESHMANI\\Desktop\\Pictures\\Trade",
    "c:\\Users\\DINESHMANI\\.gemini\\antigravity"
]

for base_path in search_paths:
    if os.path.exists(base_path):
        print(f"Searching in {base_path}...")
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if "476f" in file or "476" in file:
                    print(f"Found: {os.path.join(root, file)}")
