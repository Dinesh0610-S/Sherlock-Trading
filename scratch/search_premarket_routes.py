import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

workspace = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade"

for root, dirs, files in os.walk(workspace):
    if "node_modules" in root or ".zencoder" in root or ".zenflow" in root or "dist" in root:
        continue
    for file in files:
        if file.endswith((".js", ".jsx", ".py", ".json")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "premarket" in content.lower():
                        print(f"Found 'premarket' in: {path}")
            except Exception as e:
                pass
