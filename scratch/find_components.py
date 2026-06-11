filepath = r"c:\Users\DINESHMANI\Desktop\Pictures\Trade\src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    line_num = i + 1
    if "api/chat" in line or "handleSendMessage" in line or "handleSend" in line or "chatMessages" in line:
        if "const" in line or "function" in line:
            print(f"Line {line_num}: {line.strip()}")
