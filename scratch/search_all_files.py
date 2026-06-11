import os

search_dirs = [
    r"c:\Users\DINESHMANI\Desktop\Pictures\Trade",
    r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b"
]

query = "Fix 2"
query2 = "Fix 3"

for sdir in search_dirs:
    for root, dirs, files in os.walk(sdir):
        if ".system_generated" in root or "node_modules" in root or ".git" in root or ".tempmediaStorage" in root:
            continue
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if query in content or query2 in content:
                        print(f"Match found in: {path}")
            except Exception as e:
                pass
