with open(r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\index.css", "r", encoding="utf-8") as f:
    css = f.read()

if "trade-taken-banner" in css:
    print("Found trade-taken-banner in index.css")
    # Print the style block
    import re
    matches = re.findall(r"\.trade-taken-banner\s*\{[^}]*\}", css)
    for m in matches:
        print(m)
else:
    print("trade-taken-banner NOT found in index.css")
