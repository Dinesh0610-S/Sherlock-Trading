import json

json_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\messages\40abe27e-4c95-431c-ac43-3804ca8c4a16.json"
try:
    with open(json_path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    
    # Let's print keys and some attributes
    print("Keys:", obj.keys())
    content = obj.get("Message", "") or obj.get("content", "")
    print("Content length:", len(content))
    
    # Save content to scratch/extracted_message.txt
    with open("scratch/extracted_message.txt", "w", encoding="utf-8") as out:
        out.write(content)
    print("Saved to scratch/extracted_message.txt")
except Exception as e:
    print("Error:", e)
