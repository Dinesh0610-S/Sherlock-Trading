import requests
import json

def test_endpoints():
    output = []
    
    output.append("Testing /api/deduct endpoint...")
    deduct_payload = {
        "ticker": "NIFTY",
        "spot_price": 23547.75,
        "rsi": 35.0,
        "ema_status": "Bearish (9 < 21 EMA)",
        "vwap_position": "below",
        "vwap_val": 23547.75,
        "pcr": 0.96,
        "max_pain": 23500.0,
        "spot_below_ema21": True
    }
    
    try:
        resp = requests.post("http://localhost:5000/api/deduct", json=deduct_payload)
        output.append(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            output.append("Verdict Result:")
            output.append(resp.json().get("verdict"))
        else:
            output.append(f"Error Response: {resp.text}")
    except Exception as e:
        output.append(f"Failed to connect to /api/deduct: {e}")

    output.append("\n" + "="*50 + "\n")

    output.append("Testing /api/generate-signal endpoint...")
    signal_payload = {
        "ticker": "NIFTY",
        "direction": "SHORT",
        "metrics": {
            "spot_price": 23547.75,
            "rsi": 35.0,
            "ema_status": "Bearish (9 < 21 EMA)",
            "vwap_val": 23547.75,
            "pcr": 0.96,
            "max_pain": 23500.0,
            "spot_below_ema21": True
        }
    }
    
    try:
        resp = requests.post("http://localhost:5000/api/generate-signal", json=signal_payload)
        output.append(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            output.append("Signal Result:")
            output.append(resp.json().get("signal"))
        else:
            output.append(f"Error Response: {resp.text}")
    except Exception as e:
        output.append(f"Failed to connect to /api/generate-signal: {e}")

    with open("scratch/test_output.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))
    print("Test output saved to scratch/test_output.txt")

if __name__ == "__main__":
    test_endpoints()
