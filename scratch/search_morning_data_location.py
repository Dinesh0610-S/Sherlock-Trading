import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "app.get('/api/morning/market-data'" in line:
        print(f"Start: Line {i+1}")
        # search for the end of the route
        for j in range(i, i + 100):
            if "res.json(result);" in lines[j] or "res.send(" in lines[j]:
                print(f"End block: Line {j+1}: {lines[j].strip()}")
                print(f"Next line {j+2}: {lines[j+1].strip()}")
                break
        break
