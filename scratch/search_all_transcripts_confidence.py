import os

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
matches = []

for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if "transcript.jsonl" in f:
            continue
        path = os.path.join(root, f)
        try:
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
                if "computeDeepConfidenceScore" in content or "DeepConfidenceScore" in content or "10-dimension" in content:
                    print(f"Found match in {path}")
                    matches.append((path, content))
        except:
            pass

print(f"Total files matched: {len(matches)}")
