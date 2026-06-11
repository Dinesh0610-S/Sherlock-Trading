import os
import sys
sys.stdout.reconfigure(encoding="utf-8")

search_dir = "scratch"
query = "/api/premarket/scan"

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith(".txt") or file.endswith(".py") or file.endswith(".js") or file.endswith(".cjs"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if query in content:
                    print(f"Found in {path}")
            except Exception as e:
                pass
