import sys
import re

# Configure stdout
sys.stdout.reconfigure(encoding='utf-8')

file_path = 'src/App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to perform replacements specifically inside the PreMarketIntel component block
# PreMarketIntel starts at: 'function PreMarketIntel()'
# We will find the range in App.jsx
start_idx = content.find('function PreMarketIntel()')
if start_idx == -1:
    print("Error: Could not find function PreMarketIntel")
    sys.exit(1)

# Find the end of the function block.
# PreMarketIntel is defined as function PreMarketIntel() { ... }
# Let's find the closing brace by counting braces.
brace_count = 0
found_first_brace = False
end_idx = -1

for idx in range(start_idx, len(content)):
    char = content[idx]
    if char == '{':
        brace_count += 1
        found_first_brace = True
    elif char == '}':
        brace_count -= 1
        if found_first_brace and brace_count == 0:
            end_idx = idx + 1
            break

if end_idx == -1:
    print("Error: Could not find closing brace of PreMarketIntel")
    sys.exit(1)

sub_content = content[start_idx:end_idx]

# Replacements
replacements = [
    ('#00e5ff', 'var(--gold)'),
    ('rgba(0,229,255,0.15)', 'rgba(201, 168, 76, 0.15)'),
    ('rgba(0,229,255,0.1)', 'rgba(201, 168, 76, 0.1)'),
    ('rgba(0,229,255,0.04)', 'rgba(201, 168, 76, 0.04)'),
    ('rgba(0,229,255,0.03)', 'rgba(201, 168, 76, 0.03)'),
    ('rgba(0,229,255,0.05)', 'rgba(201, 168, 76, 0.05)'),
    ('background: \'#0a0f1d\'', "background: 'var(--bg-primary)'"),
    ('background: \'#0a101f\'', "background: 'var(--bg-primary)'"),
    ('background: "#0a0f1d"', 'background: "var(--bg-primary)"'),
    ('background: \'#0a0c10\'', "background: 'var(--bg-primary)'"),
    ('background: "#0a0c10"', 'background: "var(--bg-primary)"'),
    ('color: \'#e2e8f0\'', "color: 'var(--text-primary)'"),
    ('color: "#e2e8f0"', 'color: "var(--text-primary)"'),
    ("fontFamily: 'system-ui, -apple-system, sans-serif'", "fontFamily: 'var(--font-mono)'"),
    ('fontFamily: "system-ui, -apple-system, sans-serif"', 'fontFamily: "var(--font-mono)"'),
    ('background: activeSubTab === tab.id ? \'rgba(0,229,255,0.15)\'', "background: activeSubTab === tab.id ? 'rgba(201, 168, 76, 0.15)'"),
    ('border: activeSubTab === tab.id ? \'1px solid #00e5ff\'', "border: activeSubTab === tab.id ? '1px solid var(--gold)'"),
    ('color: activeSubTab === tab.id ? \'#00e5ff\'', "color: activeSubTab === tab.id ? 'var(--gold)'"),
    ('border: activeSubTab === tab.id ? "1px solid #00e5ff"', 'border: activeSubTab === tab.id ? "1px solid var(--gold)"'),
    ('color: activeSubTab === tab.id ? "#00e5ff"', 'color: activeSubTab === tab.id ? "var(--gold)"'),
    # Glowing shadow
    ('boxShadow: planData.verdict?.verdict === \'BULLISH\' || planData.verdict?.verdict === \'STRONGLY BULLISH\'\n                    ? \'0 0 30px rgba(0,229,255,0.1)\'', "boxShadow: planData.verdict?.verdict === 'BULLISH' || planData.verdict?.verdict === 'STRONGLY BULLISH'\n                    ? '0 0 30px rgba(201, 168, 76, 0.15)'"),
]

modified_sub_content = sub_content
for old, new in replacements:
    modified_sub_content = modified_sub_content.replace(old, new)

# Let's perform additional custom changes
# Change headers background sticky from background: '#0a0f1d' to background: 'var(--bg-primary)'
modified_sub_content = modified_sub_content.replace("background: '#0a0f1d'", "background: 'var(--bg-primary)'")
modified_sub_content = modified_sub_content.replace('background: "#0a0f1d"', 'background: "var(--bg-primary)"')

# Change title font to Cinzel (Sherlock display font)
old_title_h2 = """<h2 style={{
            margin: 0, fontSize: '26px', fontWeight: 800, color: 'var(--gold)',
            letterSpacing: '-0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'
          }}>"""
new_title_h2 = """<h2 style={{
            margin: 0, fontSize: '26px', fontWeight: 700, color: 'var(--gold)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px',
            textShadow: '0 0 10px rgba(201, 168, 76, 0.35)'
          }}>"""
modified_sub_content = modified_sub_content.replace(old_title_h2, new_title_h2)

# Change loading overlay colors
modified_sub_content = modified_sub_content.replace("border: '3px solid rgba(0, 229, 255, 0.1)'", "border: '3px solid rgba(201, 168, 76, 0.1)'")
modified_sub_content = modified_sub_content.replace("borderTop: '3px solid var(--gold)'", "borderTop: '3px solid var(--gold)'")

# Save
new_content = content[:start_idx] + modified_sub_content + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Programmatic theme refactoring completed successfully!")
