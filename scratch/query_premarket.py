import requests
import json

def query():
    url = "http://localhost:3001/api/premarket/options-entry"
    headers = {"Content-Type": "application/json"}
    payload = {"symbol": "NIFTY"}
    
    print(f"Sending POST request to {url}...")
    try:
        resp = requests.post(url, headers=headers, json=payload)
        print("Status code:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            print("\nResponse:")
            print(json.dumps(data, indent=2))
        else:
            print("Response:", resp.text)
    except Exception as e:
        print("Error connecting to server:", e)

if __name__ == "__main__":
    query()
