import re

filepath = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()
    lines = content.splitlines()

keys = [
    "ClueBoard", "Verdict", "RRCalculator", "OptionIntel", 
    "TradeJournal", "FIIDIIFlow", "MorningBrief", "PreMarketIntel", 
    "Backtester", "SherlockBot", "OneTradePerdayGate", "activeTab"
]

output_path = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\scratch\key_search.txt"
with open(output_path, "w", encoding="utf-8") as out:
    for key in keys:
        out.write(f"=== SEARCH FOR: {key} ===\n")
        count = 0
        for i, line in enumerate(lines):
            if key in line:
                out.write(f"Line {i+1}: {line.strip()[:120]}\n")
                count += 1
                if count > 50:
                    out.write("... truncated ...\n")
                    break
        out.write("\n")

print("Done writing to scratch/key_search.txt")
