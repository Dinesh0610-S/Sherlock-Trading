import sys
sys.stdout.reconfigure(encoding="utf-8")

def fix_file(filename):
    print(f"Fixing file {filename}...")
    with open(filename, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Let's inspect the target lines to ensure they are what we expect
    print(f"Line 3184 (1-based index 3185): {lines[3184].strip()}")
    print(f"Line 3248 (1-based index 3249): {lines[3248].strip()}")
    
    # We want to remove lines from index 3184 to 3248 inclusive
    new_lines = lines[:3184] + lines[3249:]
    
    with open(filename, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"Fixed {filename} successfully!")

fix_file("server.js")
fix_file("proxy.js")
