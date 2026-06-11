import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

log_path = r"C:\Users\DINESHMANI\.gemini\antigravity\brain\641787a0-6251-4052-9205-d0e8b3ff2c8b\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        obj = json.loads(line)
        step_idx = obj.get("step_index")
        if step_idx is not None and 5777 <= step_idx <= 5806:
            typ = obj.get("type")
            tcalls = obj.get("tool_calls", [])
            print(f"--- STEP {step_idx} ({typ}) ---")
            content = obj.get("content", "")
            if content:
                print(f"Content: {content[:400]}")
            if tcalls:
                for tc in tcalls:
                    print(f"  Tool: {tc.get('name')}")
                    args = tc.get("arguments", tc.get("args", {}))
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except:
                            pass
                    if isinstance(args, dict):
                        desc = args.get("Description", args.get("description", ""))
                        if desc:
                            print(f"    Description: {desc}")
                        tgt = args.get("TargetFile", args.get("Target", ""))
                        if tgt:
                            print(f"    Target: {tgt}")
                        inst = args.get("Instruction", "")
                        if inst:
                            print(f"    Instruction: {inst}")
                        chunks = args.get("ReplacementChunks", "")
                        if chunks:
                            print(f"    ReplacementChunks: {str(chunks)[:400]}...")
                        rep = args.get("ReplacementContent", "")
                        if rep:
                            print(f"    ReplacementContent: {str(rep)[:400]}...")
