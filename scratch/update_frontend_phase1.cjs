const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update ConfidenceRing color schema
const oldConfidenceRing = `const ConfidenceRing = ({ score, label, recommendation }) => {
  const safeScore   = isNaN(score) || !score ? 0 : score;
  const radius      = 28;
  const circumference = 2 * Math.PI * radius;
  const filled      = (safeScore / 100) * circumference;
  const color       = safeScore >= 85 ? '#00ff88' :
                      safeScore >= 65 ? '#f5a623' : '#ff4444';`;

const newConfidenceRing = `const ConfidenceRing = ({ score, label, recommendation }) => {
  const safeScore   = isNaN(score) || !score ? 0 : score;
  const radius      = 28;
  const circumference = 2 * Math.PI * radius;
  const filled      = (safeScore / 100) * circumference;
  const color       = safeScore >= 85 ? '#00e5ff' : // Electric blue (conviction)
                      safeScore >= 70 ? '#00e676' : // Green
                      safeScore >= 40 ? '#ffab00' : '#ff1744'; // Amber / Red`;

if (content.includes(oldConfidenceRing)) {
  content = content.replace(oldConfidenceRing, newConfidenceRing);
  console.log('Successfully updated ConfidenceRing color schema in App.jsx');
}

// 2. Add proxyHealth state and polling to main App export
const oldStateAnchor = `export default function App() {


  // Navigation
  const [activeTab, setActiveTab] = useState('clueBoard');`;

const newStateAnchor = `export default function App() {


  // Navigation
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
  }, []);`;

if (content.includes(oldStateAnchor)) {
  content = content.replace(oldStateAnchor, newStateAnchor);
  console.log('Successfully added proxyHealth state and polling in App.jsx');
}

// 3. Inject top bar health check indicator badge
const oldHeaderAnchor = `        <div className="header-meta">
          <div className="meta-item">
            <span className="badge-live">Live</span>
          </div>`;

const newHeaderAnchor = `        <div className="header-meta">
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
          </div>`;

if (content.includes(oldHeaderAnchor)) {
  content = content.replace(oldHeaderAnchor, newHeaderAnchor);
  console.log('Successfully injected top bar health indicator in App.jsx');
}

// Write back updated content before replacing PreMarketIntel function block
fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved intermediate changes to App.jsx');
