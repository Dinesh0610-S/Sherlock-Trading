import os
import time

scratch_dir = "scratch"
files = [os.path.join(scratch_dir, f) for f in os.listdir(scratch_dir)]
files = [f for f in files if os.path.isfile(f)]
files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

print("Top 20 most recently modified files in scratch:")
for f in files[:20]:
    mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(f)))
    print(f"{f}: {mtime} (size: {os.path.getsize(f)} bytes)")
