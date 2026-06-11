import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """  const niftyGap = pmData?.nifty_gap ?? null;"""

replacement = """  const countdown = phase === 'BEFORE_PREOPEN' ? secsUntil(9, 0, ist)
    : phase === 'ORDER_ENTRY'     ? secsUntil(9, 8, ist)
    : phase === 'IEP_CALCULATION' ? secsUntil(9, 12, ist)
    : phase === 'BUFFER'          ? secsUntil(9, 15, ist)
    : phase === 'JUST_OPENED'     ? secsUntil(9, 20, ist)
    : phase === 'CONFIRM_WINDOW'  ? secsUntil(9, 25, ist)
    : null;

  const niftyGap = pmData?.nifty_gap ?? null;"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully added countdown calculation to replace_frontend_complete.cjs!")
else:
    print("Target not found in replace_frontend_complete.cjs!")
