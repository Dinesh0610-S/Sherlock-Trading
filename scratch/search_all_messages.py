import os
import json

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
matches = []
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith(".json"):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    data = json.load(file)
                    content = ""
                    if isinstance(data, dict):
                        content = data.get("content", "") or data.get("Message", "")
                    elif isinstance(data, str):
                        content = data
                    
                    if "FIX 1: NIFTY 50 EXPIRY" in content:
                        print(f"Found in json: {path}, length: {len(content)}")
                        matches.append((path, content))
            except:
                pass

# Let's write the longest one found to a file
if matches:
    matches.sort(key=lambda x: len(x[1]), reverse=True)
    best_path, best_content = matches[0]
    print(f"Best match: {best_path} (len={len(best_content)})")
    with open("scratch/untruncated_prompt.txt", "w", encoding="utf-8") as out:
        out.write(best_content)
    print("Saved to scratch/untruncated_prompt.txt")
else:
    print("No match found.")
