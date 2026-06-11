import os

brain_dir = r"C:\Users\DINESHMANI\.gemini\antigravity\brain"
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if "plan" in f.lower() and f.endswith(".md"):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read()
                    if "FIX 1" in content or "FIX 2" in content or "FIX 3" in content:
                        print(f"Found plan in {path}, size: {len(content)}")
                        # Save it
                        out_path = f"scratch/found_plan_{os.path.basename(os.path.dirname(root))}.md"
                        with open(out_path, "w", encoding="utf-8") as out:
                            out.write(content)
                        print(f"Saved to {out_path}")
            except:
                pass
