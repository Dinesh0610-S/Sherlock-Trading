import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "app.get('/api/premarket/scan'" in line:
        print(f"Start of /api/premarket/scan: Line {i+1}")
        for j in range(i, i+150):
            if j < len(lines):
                if "res.json(" in lines[j] or "res.send(" in lines[j] or "return res" in lines[j] or "iepHistory" in lines[j] or "niftyIepHistory" in lines[j]:
                    print(f"Line {j+1}: {lines[j].strip()}")
