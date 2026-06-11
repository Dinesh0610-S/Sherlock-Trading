import os

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith(".json") or f.endswith(".txt") or f.endswith(".md") or f.endswith(".cjs") or f.endswith(".js") or f.endswith(".py"):
            if "transcript.jsonl" in f:
                continue
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read()
                    if "FIX 2" in content or "FIX 3" in content or "FIX 1: NIFTY" in content:
                        print(f"Found match in file {path}, size={len(content)}")
                        # Print some lines around it
                        lines = content.splitlines()
                        for idx, line in enumerate(lines):
                            if "FIX 1:" in line or "FIX 2" in line or "FIX 3" in line or "FIX 4" in line:
                                print(f"  L{idx}: {line[:120]}")
            except Exception as e:
                pass
