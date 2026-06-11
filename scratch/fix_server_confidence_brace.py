import sys
sys.stdout.reconfigure(encoding="utf-8")

def fix_brace(filename):
    print(f"Fixing brace in {filename}...")
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()
    
    target = """  return {
    score: finalScore,
    label,
    recommendation,
    factors
  };
// Option cards generator"""

    replacement = """  return {
    score: finalScore,
    label,
    recommendation,
    factors
  };
}

// Option cards generator"""

    if target in content:
        content = content.replace(target, replacement)
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully fixed brace in {filename}!")
    else:
        print(f"Target not found in {filename}!")

fix_brace("server.js")
fix_brace("proxy.js")
