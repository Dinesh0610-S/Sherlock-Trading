filepath = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

endpoints = [
    "delivery-percent",
    "bulk-block-deals",
    "india-vix",
    "global-cues",
    "sector-flow"
]

for ep in endpoints:
    if ep in code:
        print(f"Found: {ep} in App.jsx")
    else:
        print(f"NOT found: {ep} in App.jsx")
