import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

log_paths = [
    r"C:\Users\DINESHMANI\.gemini\antigravity\brain\0ea2ca08-ee1b-44e2-8850-c7dd80bfefdb\.system_generated\logs\transcript_full.jsonl",
    r"C:\Users\DINESHMANI\.gemini\antigravity\brain\0ea2ca08-ee1b-44e2-8850-c7dd80bfefdb\.system_generated\logs\transcript.jsonl"
]

print("Searching for index.jsx content in logs...")
found = False
for log_path in log_paths:
    if not os.path.exists(log_path):
        continue
    print(f"Reading {log_path}...")
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if "index.jsx" in line:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                
                # Check tool calls
                tool_calls = obj.get("tool_calls", [])
                if not tool_calls:
                    # check content
                    content = obj.get("content", "")
                    if "index.jsx" in content and ("const renderPanelGap" in content or "SectorPulse" in content):
                        print(f"Step {obj.get('step_index')}: found in content")
                    continue
                
                for tc in tool_calls:
                    args = tc.get("Arguments", {})
                    if args and "TargetFile" in args and "index.jsx" in args["TargetFile"]:
                        print(f"Step Index: {obj.get('step_index')} | Tool: {tc.get('ToolName')}")
                        found = True
                        if tc.get('ToolName') == 'write_to_file' and "CodeContent" in args:
                            size = len(args["CodeContent"])
                            print(f"  Found write_to_file with CodeContent of size {size}")
                            with open(f"scratch/extracted_index_step_{obj.get('step_index')}.jsx", "w", encoding="utf-8") as out:
                                out.write(args["CodeContent"])
                            print(f"  Saved to scratch/extracted_index_step_{obj.get('step_index')}.jsx")
                        elif tc.get('ToolName') == 'replace_file_content' and "ReplacementContent" in args:
                            print(f"  Found replace_file_content target: {args.get('TargetContent')[:60]}...")
                            with open(f"scratch/extracted_replace_step_{obj.get('step_index')}.txt", "w", encoding="utf-8") as out:
                                out.write(f"TARGET:\n{args.get('TargetContent')}\n\nREPLACEMENT:\n{args.get('ReplacementContent')}")
                            print(f"  Saved to scratch/extracted_replace_step_{obj.get('step_index')}.txt")
                        elif tc.get('ToolName') == 'multi_replace_file_content':
                            print("  Found multi_replace_file_content")
                            # Dump chunks
                            chunks = args.get("ReplacementChunks", [])
                            with open(f"scratch/extracted_multireplace_step_{obj.get('step_index')}.json", "w", encoding="utf-8") as out:
                                json.dump(chunks, out, indent=2, ensure_ascii=False)
                            print(f"  Saved chunks to scratch/extracted_multireplace_step_{obj.get('step_index')}.json")

if not found:
    print("No tool calls targeting index.jsx found. Let's list any other .jsx files in scratch that were extracted.")
    for file in os.listdir("scratch"):
        if file.endswith(".jsx") or file.endswith(".txt"):
            print(f"  scratch/{file} (size: {os.path.getsize(os.path.join('scratch', file))} bytes)")
