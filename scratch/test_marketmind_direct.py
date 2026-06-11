import urllib.request
import time

url = "http://localhost:3001/api/morning/marketmind-data"
print("Connecting...")
start = time.time()
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=35) as f:
        print(f"Status: {f.status}")
        content = f.read().decode('utf-8')
        print(f"Content length: {len(content)}")
        print(f"Time taken: {time.time() - start:.2f}s")
        print("Response snippet:", content[:200])
except Exception as e:
    print(f"Error after {time.time() - start:.2f}s: {e}")
