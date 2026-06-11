import sys
sys.stdout.reconfigure(encoding="utf-8")

def add_history(filename):
    print(f"Adding niftyIepHistory to {filename}...")
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()
    
    target = """    iep_stability: iepStability,
    vol_vs_avg_ratio: volVsAvgRatio,"""

    replacement = """    iep_stability: iepStability,
    vol_vs_avg_ratio: volVsAvgRatio,
    niftyIepHistory: niftyIepHistory || [],"""

    if target in content:
        content = content.replace(target, replacement)
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully added to {filename}!")
    else:
        print(f"Target not found in {filename}!")

add_history("server.js")
add_history("proxy.js")
