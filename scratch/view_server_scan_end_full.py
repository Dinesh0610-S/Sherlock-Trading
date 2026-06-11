import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "server.js.bak"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

found_scan = False
for i, line in enumerate(lines):
    if "app.get('/api/premarket/scan'" in line:
        found_scan = True
        print(f"Scan API starts at {i+1}")
    if found_scan and i > 2938:
        # Look for routes defined after scan API
        if "app.get(" in line or "app.post(" in line:
            print(f"Next route: Line {i+1}: {line.strip()}")
