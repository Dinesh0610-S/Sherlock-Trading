import re
import sys
sys.stdout.reconfigure(encoding="utf-8")

file_path = "src/App.jsx"
backup_path = "src/App.jsx.bak"

print("Restoring src/App.jsx from backup...")
with open(backup_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Upgraded ConfidenceRing (Issue 3 Conviction Colors: 85%+ electric blue)
print("1. Replacing ConfidenceRing colors...")
target_ring = """  const color       = safeScore >= 85 ? '#00ff88' :
                      safeScore >= 65 ? '#f5a623' : '#ff4444';"""

replacement_ring = """  const color       = safeScore >= 85 ? '#00e5ff' : // conviction electric blue
                      safeScore >= 70 ? '#00e676' : // green
                      safeScore >= 40 ? '#ffab00' : '#ff1744'; // amber / red"""

if target_ring in content:
    content = content.replace(target_ring, replacement_ring)
    print("ConfidenceRing replaced successfully!")
else:
    print("WARNING: target_ring not found!")

# 2. Add proxyHealth state & polling in App()
print("2. Adding proxyHealth state and polling...")
target_health_state = """  // Navigation
  const [activeTab, setActiveTab] = useState('clueBoard');"""

replacement_health_state = """  // Navigation
  const [activeTab, setActiveTab] = useState('clueBoard');

  // Proxy Health state (Issue 1)
  const [proxyHealth, setProxyHealth] = useState('CHECKING');

  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' || data.status === 'OK') {
            setProxyHealth('ONLINE');
            return;
          }
        }
        setProxyHealth('OFFLINE');
      } catch (err) {
        setProxyHealth('OFFLINE');
      }
    };
    pollHealth();
    const id = setInterval(pollHealth, 10000);
    return () => clearInterval(id);
  }, []);"""

if target_health_state in content:
    content = content.replace(target_health_state, replacement_health_state)
    print("proxyHealth state added successfully!")
else:
    print("WARNING: target_health_state not found!")

# 3. Inject top bar Health status badge
print("3. Adding top bar Health status badge...")
target_badge = """        <div className="header-meta">
          <div className="meta-item">
            <span className="badge-live">Live</span>
          </div>"""

replacement_badge = """        <div className="header-meta">
          <div className="meta-item">
            <span className="badge-live">Live</span>
          </div>
          <div className="meta-item">
            <span style={{
              background: proxyHealth === 'ONLINE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: proxyHealth === 'ONLINE' ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4, padding: '2px 8px', fontSize: 10,
              color: proxyHealth === 'ONLINE' ? '#22c55e' : '#ef4444',
              fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              transition: 'all 0.3s ease'
            }}>
              🔌 PROXY: {proxyHealth}
            </span>
          </div>"""

if target_badge in content:
    content = content.replace(target_badge, replacement_badge)
    print("Health status badge added successfully!")
else:
    print("WARNING: target_badge not found!")

# 4. Read PreMarketIntel new component code from scratch/replace_frontend_complete.cjs
print("4. Reading new PreMarketIntel block from replace_frontend_complete.cjs...")
with open("scratch/replace_frontend_complete.cjs", "r", encoding="utf-8") as f:
    script_lines = f.readlines()

# Line 75 index is script_lines[75], we strip the 'const newPreMarketIntelCode = `' prefix
first_line = script_lines[75][len("const newPreMarketIntelCode = `"):]
# Line 1006 index is script_lines[1006] (inclusive of the closing function brace)
middle_lines = script_lines[76:1007]
new_premarket_code = first_line + "".join(middle_lines)

# Find PreMarketIntel block in src/App.jsx and replace it
print("Replacing PreMarketIntel block...")
# Use re.escape or re.sub with regex to replace the function PreMarketIntel block
pattern = r"function PreMarketIntel\(\) \{[\s\S]*?// ── Formatting Utilities ───────────────────────────────────────────────────"

match = re.search(pattern, content)
if match:
    replacement_block = new_premarket_code + "\n\n// ── Formatting Utilities ───────────────────────────────────────────────────"
    content = re.sub(pattern, replacement_block, content)
    print("PreMarketIntel block replaced successfully!")
else:
    print("WARNING: PreMarketIntel block pattern not found in src/App.jsx!")

print("Writing changes back to src/App.jsx...")
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Frontend upgrade applied successfully!")
