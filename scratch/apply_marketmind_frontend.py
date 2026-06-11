import re
import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
new_code_path = "scratch/new_premarket_intel.js"

print("Reading new component code...")
with open(new_code_path, "r", encoding="utf-8") as f:
    new_code = f.read()

print("Reading src/App.jsx...")
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define regex pattern to match the complete PreMarketIntel component block
# Starts with "function PreMarketIntel() {" and ends with "// ── Formatting Utilities ───────────────────────────────────────────────────"
pattern = r"function PreMarketIntel\(\) \{[\s\S]*?// ── Formatting Utilities ───────────────────────────────────────────────────"

if re.search(pattern, content):
    replacement = new_code + "\n\n// ── Formatting Utilities ───────────────────────────────────────────────────"
    content = re.sub(pattern, replacement, content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully replaced PreMarketIntel with the upgraded MarketMind dashboard!")
else:
    print("WARNING: Could not find PreMarketIntel block in App.jsx!")
