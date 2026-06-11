import urllib.request
import json
import time

url = "http://localhost:3001/api/morning/marketmind-data"
print(f"Requesting {url} ...")
start = time.time()
try:
    with urllib.request.urlopen(url, timeout=15) as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Status: {status}")
        print(f"Duration: {time.time() - start:.2f}s")
        data = json.loads(body)
        print("Data keys:", list(data.keys()) if isinstance(data, dict) else type(data))
except Exception as e:
    print(f"Failed: {e}")
