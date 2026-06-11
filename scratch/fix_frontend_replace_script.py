import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/replace_frontend_complete.cjs"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """  const [isSimulationMode, setIsSimulationMode] = React.useState(false);
  const [showDebug, setShowDebug]               = React.useState(false);"""

replacement = """  const [isSimulationMode, setIsSimulationMode] = React.useState(false);
  const [showDebug, setShowDebug]               = React.useState(false);
  const niftyIepHistory = pmData?.niftyIepHistory || [];"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully modified replace_frontend_complete.cjs to define niftyIepHistory!")
else:
    print("Target not found in replace_frontend_complete.cjs!")
