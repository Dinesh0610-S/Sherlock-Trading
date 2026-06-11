import os
import json

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
matches = []

for root, dirs, files in os.walk(brain_dir):
    for f in files:
        path = os.path.join(root, f)
        try:
            if f.endswith(".jsonl") or f.endswith(".json") or f.endswith(".txt"):
                with open(path, "r", encoding="utf-8") as file:
                    if f.endswith(".jsonl"):
                        for line in file:
                            if "Nifty 50 weekly expiry is TUESDAY" in line:
                                matches.append((path, line))
                    else:
                        content = file.read()
                        if "Nifty 50 weekly expiry is TUESDAY" in content:
                            matches.append((path, content))
        except:
            pass

print(f"Found {len(matches)} files containing the phrase.")
for idx, (path, content) in enumerate(matches):
    print(f"{idx}: {path} length: {len(content)}")
    # Write to a file
    with open(f"scratch/match_{idx}.txt", "w", encoding="utf-8") as out:
        out.write(content)
