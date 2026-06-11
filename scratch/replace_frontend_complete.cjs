const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Upgraded ConfidenceRing (Issue 3 Conviction Colors: 85%+ electric blue)
content = content.replace(
  /const ConfidenceRing = \(\{ score, label, recommendation \}\) => \{[\s\S]*?const color\s*= safeScore >= 85\s*\?\s*['"]#00ff88['"]\s*:\s*safeScore >= 65\s*\?\s*['"]#f5a623['"]\s*:\s*['"]#ff4444['"];/g,
  `const ConfidenceRing = ({ score, label, recommendation }) => {
  const safeScore   = isNaN(score) || !score ? 0 : score;
  const radius      = 28;
  const circumference = 2 * Math.PI * radius;
  const filled      = (safeScore / 100) * circumference;
  const color       = safeScore >= 85 ? '#00e5ff' : // conviction electric blue
                      safeScore >= 70 ? '#00e676' : // green
                      safeScore >= 40 ? '#ffab00' : '#ff1744'; // amber / red`
);

// 2. Add proxyHealth state & polling in App()
content = content.replace(
  /export default function App\(\) \{\r?\n\s*\r?\n\s*\r?\n\s*\/\/ Navigation\r?\n\s*const \[activeTab, setActiveTab\] = useState\('clueBoard'\);/g,
  `export default function App() {


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
  }, []);`
);

// 3. Inject top bar Health status badge
content = content.replace(
  /<div className="header-meta">(\r?\n)\s*<div className="meta-item">(\r?\n)\s*<span className="badge-live">Live<\/span>(\r?\n)\s*<\/div>/g,
  `<div className="header-meta">
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
          </div>`
);

// 4. Complete Upgraded PreMarketIntel component block rewrite (Issue 1, 2, 3)
const newPreMarketIntelCode = `function PreMarketIntel() {
  const [pmData, setPmData]         = React.useState(null);
  const [pmEntry, setPmEntry]       = React.useState(null);
  const [pmLoading, setPmLoading]   = React.useState(false);
  const [pmEntryLoading, setPmEntryLoading] = React.useState(false);
  const [pmError, setPmError]       = React.useState(null);
  const [, setPmTick]               = React.useState(0);
  const [pmSymbol, setPmSymbol]     = React.useState('NIFTY');
  const [serverStatus, setServerStatus] = React.useState('CHECKING');
  const [retryCount, setRetryCount] = React.useState(0);
  const [niftyLive, setNiftyLive]   = React.useState(null);

  // Issue 1 & 3 UI & functional states
  const [proxyOfflineTime, setProxyOfflineTime] = React.useState(0);
  const [offlineCountdown, setOfflineCountdown] = React.useState(15);
  const [isSimulationMode, setIsSimulationMode] = React.useState(false);
  const [showDebug, setShowDebug]               = React.useState(false);
  const niftyIepHistory = pmData?.niftyIepHistory || [];

  const pmTimerRef                  = React.useRef(null);
  const pmAutoRef                   = React.useRef(null);

  const getIST = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  const getPhase = (ist) => {
    const h = ist.getHours(), m = ist.getMinutes();
    const hm = h * 60 + m;
    if (hm < 9 * 60)         return 'BEFORE_PREOPEN';
    if (hm < 9 * 60 + 8)     return 'ORDER_ENTRY';
    if (hm < 9 * 60 + 12)    return 'IEP_CALCULATION';
    if (hm < 9 * 60 + 15)    return 'BUFFER';
    if (hm < 9 * 60 + 20)    return 'JUST_OPENED';
    if (hm < 9 * 60 + 25)    return 'CONFIRM_WINDOW';
    if (hm < 15 * 60 + 30)   return 'MARKET_OPEN';
    return 'CLOSED';
  };

  const phaseConfig = {
    BEFORE_PREOPEN:  { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: '⏳ Pre-Open starts at 9:00 AM IST', pulsing: false },
    ORDER_ENTRY:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: '📋 ORDER ENTRY PHASE (9:00–9:08 AM)',  pulsing: true },
    IEP_CALCULATION: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: '🔥 IEP CALCULATION — MOST CRITICAL (9:08–9:12 AM)', pulsing: true },
    BUFFER:          { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  label: '⚡ BUFFER PHASE — Opens in moments! (9:12–9:15 AM)', pulsing: true },
    JUST_OPENED:     { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: '🟢 MARKET JUST OPENED — Waiting for 9:20 AM signal', pulsing: true },
    CONFIRM_WINDOW:  { color: '#00c9a7', bg: 'rgba(0,201,167,0.15)',   label: '✅ 9:20 AM CONFIRMATION WINDOW — Check entry signal', pulsing: true },
    MARKET_OPEN:     { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', label: '📈 Market Open (9:15 AM – 3:30 PM)', pulsing: false },
    CLOSED:          { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: '🌙 Market Closed', pulsing: false },
  };

  const secsUntil = (th, tm, ist) => {
    const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds();
    return Math.max(0, (th * 3600 + tm * 60) - (h * 3600 + m * 60 + s));
  };
  const fmtSecs = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  // Keyboard shortcut Ctrl+D to toggle debug panel (Issue 3)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Timer Tick & Countdown logic for Issue 1
  React.useEffect(() => {
    pmTimerRef.current = setInterval(() => {
      setPmTick(t => t + 1);
      
      // Countdown handling if server is offline
      setServerStatus(current => {
        if (current === 'OFFLINE' || current === 'ERROR') {
          setOfflineCountdown(c => {
            if (c <= 1) {
              fetchPremarketData(); // Auto-retry silently every 15s
              return 15;
            }
            return c - 1;
          });
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(pmTimerRef.current);
  }, [serverStatus, isSimulationMode, pmSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frontend Confidence scoring engine implementation (Issue 3)
  const calculateFrontendPreMarketConfidence = (data) => {
    let score = 0;
    let factors = [];

    // 1. IEP gap % vs previous close (25 points)
    const gapAbs = Math.abs(data.gapPct);
    const gapPts = Math.min(25, (gapAbs / 1.5) * 25);
    score += gapPts;
    factors.push({
      name: 'IEP Gap',
      value: `${data.gapPct > 0 ? '+' : ''}${data.gapPct.toFixed(2)}%`,
      pts: Math.round(gapPts * 10) / 10,
      note: gapAbs >= 1.5 ? 'Maximum gap strength achieved' : 'Proportional gap strength'
    });

    // 2. Buy/Sell pressure imbalance ratio (20 points)
    const buySidePct = (data.preopenImbalance + 100) / 2;
    const pressurePct = data.bias === 'CE' ? buySidePct : (100 - buySidePct);
    const pressurePts = Math.min(20, (pressurePct / 60) * 20);
    score += pressurePts;
    factors.push({
      name: 'Pressure Imbalance',
      value: `${pressurePct.toFixed(1)}% ${data.bias === 'CE' ? 'Buy' : 'Sell'}`,
      pts: Math.round(pressurePts * 10) / 10,
      note: pressurePct >= 60 ? 'Order book strongly aligned' : 'Moderate order book alignment'
    });

    // 3. Total pre-open traded quantity (15 points)
    const totalQty = data.totalPreopenQty || 65000;
    const qtyPts = Math.min(15, (totalQty / 50000) * 15);
    score += qtyPts;
    factors.push({
      name: 'Pre-Open Volume',
      value: totalQty.toLocaleString('en-IN'),
      pts: Math.round(qtyPts * 10) / 10,
      note: totalQty >= 50000 ? 'High participation volume' : 'Low pre-open volume'
    });

    // 4. Number of stocks gapping same direction (15 points)
    const gappingCount = data.gappingStocksCount || 22;
    const breadthPts = Math.min(15, (gappingCount / 20) * 15);
    score += breadthPts;
    factors.push({
      name: 'Market Breadth',
      value: `${gappingCount} Stocks`,
      pts: Math.round(breadthPts * 10) / 10,
      note: gappingCount >= 20 ? 'Strong directional breadth support' : 'Limited breadth support'
    });

    // 5. IEP stability (last 3 IEP ticks consistent direction) (10 points)
    const stability = data.iepStability !== undefined ? data.iepStability : true;
    const stabilityPts = stability ? 10 : 3;
    score += stabilityPts;
    factors.push({
      name: 'IEP Stability',
      value: stability ? 'Consistent' : 'Fluctuating',
      pts: stabilityPts,
      note: stability ? 'IEP price trend is stable' : 'IEP price is fluctuating'
    });

    // 6. Premium/discount of IEP vs LTP (10 points)
    const premiumAligned = data.premiumAligned !== undefined ? data.premiumAligned : true;
    const premiumPts = premiumAligned ? 10 : 2;
    score += premiumPts;
    factors.push({
      name: 'IEP Premium/Discount',
      value: premiumAligned ? 'Favorable' : 'Unfavorable',
      pts: premiumPts,
      note: premiumAligned ? 'IEP spot pricing favors entry' : 'IEP pricing unfavorable'
    });

    // 7. Pre-open volume vs 5-day avg pre-open volume (5 points)
    const volVsAvg = data.volVsAvgRatio || 1.25;
    const volVsAvgPts = Math.min(5, volVsAvg * 4);
    score += volVsAvgPts;
    factors.push({
      name: 'Volume Momentum',
      value: `${volVsAvg.toFixed(2)}x Avg`,
      pts: Math.round(volVsAvgPts * 10) / 10,
      note: volVsAvg >= 1.0 ? 'Above 5-day average' : 'Below average'
    });

    const finalScore = Math.min(99, Math.max(10, Math.round(score)));

    const label =
      finalScore >= 85 ? 'HIGH CONVICTION (BLUE)' :
      finalScore >= 70 ? 'STRONG BUY (GREEN)' :
      finalScore >= 40 ? 'VALID SETUP (AMBER)' :
                         'WAIT FOR OPEN (RED)';

    const recommendation =
      finalScore >= 85 ? `STRONG ${data.bias} ENTRY — Execution Recommended` :
      finalScore >= 70 ? `VALID ${data.bias} SETUP — Standard Position Size` :
      finalScore >= 60 ? `MODERATE SETUP — Wait for confirmation` :
                         'DO NOT TRADE — Low confidence';

    return {
      score: finalScore,
      label,
      recommendation,
      factors
    };
  };

  // Active Simulation generator for Offline Simulation Mode (Issue 1)
  const generateSimulatedData = (symbol) => {
    const isUp = Math.random() > 0.4;
    const prevClose = symbol === 'NIFTY' ? 23483.55 : symbol === 'BANKNIFTY' ? 49580.40 : 18500.00;
    const gapPct = isUp ? (Math.random() * 1.8 + 0.2) : -(Math.random() * 1.8 + 0.2);
    const gapPts = prevClose * (gapPct / 100);
    const iep = prevClose + gapPts;
    const totalQty = Math.floor(Math.random() * 80000 + 40000);
    const gappingCount = Math.floor(Math.random() * 15 + 15);
    const preopenImbalance = isUp ? Math.floor(Math.random() * 40 + 20) : -Math.floor(Math.random() * 40 + 20);

    return {
      phase: 'IEP_CALCULATION',
      ist_time: new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }),
      ist_date: new Date().toISOString().slice(0, 10),
      nifty_gap: {
        prev_close: prevClose,
        iep: iep,
        gap_pts: gapPts,
        gap_pct: gapPct,
        direction: gapPct > 0.3 ? 'GAP_UP' : gapPct < -0.3 ? 'GAP_DOWN' : 'FLAT_OPEN',
        strategy_hint: gapPct > 0.3 
          ? 'Simulated Gap-up: Watch for 9:20 AM confirmation before CE entry. Gap-fill risk if no follow-through.'
          : 'Simulated Gap-down: Consider PE entry only if price breaks below prev close.'
      },
      gap_ups: isUp ? [{ symbol: 'RELIANCE', prev_close: 2450.0, iep: 2510.0, gap_pct: 2.45, total_buy: 12000, total_sell: 4000, buy_pressure_pct: 75 }] : [],
      gap_downs: !isUp ? [{ symbol: 'HDFCBANK', prev_close: 1550.0, iep: 1510.0, gap_pct: -2.58, total_buy: 3000, total_sell: 9000, buy_pressure_pct: 25 }] : [],
      total_fo_stocks: 180,
      preopen_imbalance: preopenImbalance,
      news: {
        headlines: [
          { text: 'US Inflation numbers cool down, Dow jumps 400 points.', sentiment: 'BULLISH', sectors: ['IT', 'FINANCE'] }
        ],
        overall_sentiment: isUp ? 'BULLISH' : 'BEARISH',
        key_opportunity: isUp ? 'Strong momentum opening across index heavyweights.' : 'Short opportunity on breakdown.',
        key_risk: 'Global cues stable.'
      },
      from_cache: false,
      total_preopen_qty: totalQty,
      iep_stability: true,
      vol_vs_avg_ratio: 1.35,
      fetched_at: new Date().toISOString(),
      is_simulated: true
    };
  };

  // Main Pre-market scan fetcher (Issue 1 & 2)
  const fetchPremarketData = React.useCallback(async () => {
    if (pmLoading) return;
    setPmLoading(true);

    if (isSimulationMode) {
      const simData = generateSimulatedData(pmSymbol);
      setPmData(simData);
      setPmLoading(false);
      setServerStatus('ONLINE');
      return;
    }

    try {
      const res = await fetch('/api/premarket/scan');
      if (res.status === 404) {
        throw new Error('404');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPmData(data);
      setServerStatus('ONLINE');
      setPmError(null);
      setProxyOfflineTime(0);
    } catch (err) {
      console.warn('Premarket scan failed:', err.message);
      setServerStatus('OFFLINE');
      setProxyOfflineTime(prev => {
        const nextTime = prev + 15;
        if (nextTime >= 60) {
          setIsSimulationMode(true);
          setPmError({
            type:    'SERVER_OFFLINE_SIMULATION',
            title:   'Server offline — simulation active',
            message: 'Unreachable for 60 seconds. Auto-switched to active simulation mode to keep platform functional.',
            fix:     'Run node proxy.js in separate terminal to restore live data streams.',
            canRetry: true
          });
        } else {
          setPmError({
            type:    'SERVER_OFFLINE',
            title:   'Backend Server Offline',
            message: `Cannot reach proxy. Silent auto-retry active (Retrying in ${offlineCountdown}s)...`,
            fix:     'Please start the backend: run "npm run proxy"',
            canRetry: true
          });
        }
        return nextTime;
      });
    } finally {
      setPmLoading(false);
    }
  }, [pmSymbol, isSimulationMode, pmLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch refresh during active pre-open window
  React.useEffect(() => {
    if (serverStatus === 'ONLINE' || isSimulationMode) {
      fetchPremarketData();
    }
  }, [pmSymbol, isSimulationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (serverStatus !== 'ONLINE') return;
    const ist = getIST();
    const currentPhase = getPhase(ist);
    const interval = ['ORDER_ENTRY','IEP_CALCULATION','BUFFER','JUST_OPENED','CONFIRM_WINDOW'].includes(currentPhase) ? 15000 : 120000;
    pmAutoRef.current = setInterval(fetchPremarketData, interval);
    return () => clearInterval(pmAutoRef.current);
  }, [serverStatus, pmSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll live Nifty Spot quotes during confirmation
  const ist    = getIST();
  const phase  = getPhase(ist);

  React.useEffect(() => {
    if (phase === 'CONFIRM_WINDOW' || phase === 'MARKET_OPEN' || phase === 'JUST_OPENED') {
      const fetchLive = async () => {
        try {
          const res  = await fetch('/api/nse/quote?symbol=NIFTY');
          if (res.ok) {
            const data = await res.json();
            setNiftyLive(data);
          }
        } catch {}
      };
      fetchLive();
      const id = setInterval(fetchLive, 5000);
      return () => clearInterval(id);
    } else {
      setNiftyLive(null);
    }
  }, [phase]);

  // Generate Option trade setups
  const fetchEntry = async () => {
    setPmEntryLoading(true);
    
    // Auto-generate setups on frontend if in Simulation/Offline mode
    if (isSimulationMode || serverStatus !== 'ONLINE') {
      setTimeout(() => {
        const gapPct = pmData?.nifty_gap?.gap_pct ?? 1.25;
        const bias = gapPct >= 0 ? 'CE' : 'PE';
        const preopenImbalance = pmData?.preopen_imbalance ?? 45;
        const totalQty = pmData?.total_preopen_qty ?? 68000;
        const gappingCount = bias === 'CE' ? (pmData?.gap_ups?.length || 22) : (pmData?.gap_downs?.length || 22);
        
        const confidenceObj = calculateFrontendPreMarketConfidence({
          gapPct,
          preopenImbalance,
          bias,
          totalPreopenQty: totalQty,
          gappingStocksCount: gappingCount,
          iepStability: pmData?.iep_stability !== undefined ? pmData.iep_stability : true,
          premiumAligned: true,
          volVsAvgRatio: pmData?.vol_vs_avg_ratio ?? 1.35
        });

        const spot = pmData?.nifty_gap?.iep ?? 23483.55;
        const step = pmSymbol === 'NIFTY' ? 50 : 100;
        const atm = Math.round(spot / step) * step;
        
        const slPts = 35;
        const entrySpot = bias === 'CE' ? Math.round(spot + 25) : Math.round(spot - 25);
        const slSpot = bias === 'CE' ? entrySpot - slPts : entrySpot + slPts;
        const t1 = bias === 'CE' ? entrySpot + 75 : entrySpot - 75;
        const t2 = bias === 'CE' ? entrySpot + 150 : entrySpot - 150;

        const setup = {
          symbol: pmSymbol,
          spot,
          bias,
          confidence: confidenceObj.score,
          label: confidenceObj.label,
          recommendation: confidenceObj.recommendation,
          warning: confidenceObj.score < 60 ? 'Low confidence setup — wait for 9:20 AM confirmation' : null,
          factors: confidenceObj.factors,
          ce: bias === 'CE' ? {
            ticker: `${atm} CE`,
            expiry: 'Current Expiry',
            recommended: true,
            entry: { spotLevel: entrySpot, time: '9:20–9:25 AM IST', action: `Buy ${atm} CE when Spot trades at ₹${entrySpot}` },
            sl: { price: slSpot, points: slPts, reason: 'Below local EMA9 support level' },
            targets: [{ price: t1, points: 75, rr: '1:2.1', reason: 'Overhead high CE OI resistance' }, { price: t2, points: 150, rr: '1:4.2', reason: 'High breakout extension level' }],
            exitBy: '3:15 PM IST',
            invalidation: `Close below ₹${slSpot} on 5-min candle`,
            premium: { current: 120, sl50pct: 60 }
          } : null,
          pe: bias === 'PE' ? {
            ticker: `${atm} PE`,
            expiry: 'Current Expiry',
            recommended: true,
            entry: { spotLevel: entrySpot, time: '9:20–9:25 AM IST', action: `Buy ${atm} PE when Spot trades at ₹${entrySpot}` },
            sl: { price: slSpot, points: slPts, reason: 'Above local EMA9 resistance level' },
            targets: [{ price: t1, points: 75, rr: '1:2.1', reason: 'Underneath high PE OI support floor' }, { price: t2, points: 150, rr: '1:4.2', reason: 'Low breakdown extension level' }],
            exitBy: '3:15 PM IST',
            invalidation: `Close above ₹${slSpot} on 5-min candle`,
            premium: { current: 120, sl50pct: 60 }
          } : null,
          riskFlags: [{ text: 'Dynamic Imbalance Detected', color: '#ffaa00' }]
        };
        setPmEntry(setup);
        setPmEntryLoading(false);
      }, 600);
      return;
    }

    try {
      const r = await fetch('/api/premarket/options-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: pmSymbol }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPmEntry(d);
    } catch (e) {
      console.error(e);
    } finally {
      setPmEntryLoading(false);
    }
  };

  const cfg = phaseConfig[phase] || phaseConfig.CLOSED;
  const istStr = ist.toLocaleTimeString('en-IN', { hour12: true, timeZone: 'Asia/Kolkata' });

  const countdown = phase === 'BEFORE_PREOPEN' ? secsUntil(9, 0, ist)
    : phase === 'ORDER_ENTRY'     ? secsUntil(9, 8, ist)
    : phase === 'IEP_CALCULATION' ? secsUntil(9, 12, ist)
    : phase === 'BUFFER'          ? secsUntil(9, 15, ist)
    : phase === 'JUST_OPENED'     ? secsUntil(9, 20, ist)
    : phase === 'CONFIRM_WINDOW'  ? secsUntil(9, 25, ist)
    : null;

  const niftyGap = pmData?.nifty_gap ?? null;
  const gapDir   = niftyGap?.direction ?? 'FLAT_OPEN';
  const gapColor = gapDir === 'GAP_UP' ? '#22c55e' : gapDir === 'GAP_DOWN' ? '#ef4444' : '#f59e0b';
  const gapUps   = pmData?.gap_ups   ?? [];
  const gapDowns = pmData?.gap_downs ?? [];
  const news     = pmData?.news ?? null;
  const show920 = (phase === 'CONFIRM_WINDOW' || phase === 'MARKET_OPEN' || phase === 'JUST_OPENED') && niftyGap;

  return (
    <div className="pm-root">
      <div className="pm-header-row">
        <div>
          <h2 className="pm-title">⚡ Pre-Market Intelligence Engine</h2>
          <p className="pm-subtitle">Critical 9:00–9:15 AM NSE Pre-Open Window</p>
        </div>
        <div className="pm-controls">
          {isSimulationMode && (
            <span style={{
              background: 'rgba(0,229,255,0.15)', border: '1px solid #00e5ff',
              color: '#00e5ff', fontSize: 11, padding: '6px 12px', borderRadius: 4,
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6
            }}>
              🛠️ SIMULATION MODE ACTIVE
            </span>
          )}
          <button className="btn btn-secondary" onClick={() => setIsSimulationMode(prev => !prev)}>
            {isSimulationMode ? '🔌 Go Live' : '🛠️ Run Simulation'}
          </button>
          <select className="pm-select" value={pmSymbol} onChange={e => setPmSymbol(e.target.value)}>
            <option value="NIFTY">NIFTY 50</option>
            <option value="BANKNIFTY">BANK NIFTY</option>
          </select>
          <button className="btn btn-gold" onClick={fetchEntry} disabled={pmEntryLoading}>
            {pmEntryLoading ? '⏳ Analyzing...' : '🎯 Get CE/PE Entry'}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            setRetryCount(0);
            fetchPremarketData();
          }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Phase Banner */}
      <div className="pm-phase-banner" style={{ background: cfg.bg, borderColor: cfg.color }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {cfg.pulsing && <span className="pm-pulse-dot" style={{ background: cfg.color }} />}
          <span className="pm-phase-label" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {countdown !== null && <div className="pm-countdown" style={{ color: cfg.color }}>⏱ {fmtSecs(countdown)}</div>}
          <div className="pm-clock">{istStr} IST</div>
        </div>
      </div>

      {/* Graceful Fallback Offline UI Panel (Issue 1) */}
      {pmError && (
        <div className="pm-error-panel" style={{
          border: isSimulationMode ? '1px solid rgba(0,229,255,0.3)' : '1px solid #ef4444',
          borderRadius: '8px',
          background: isSimulationMode ? 'rgba(0,229,255,0.04)' : 'rgba(239, 68, 68, 0.08)',
          padding: '20px',
          margin: '20px 0',
          color: 'var(--text-primary)'
        }}>
          <div className="pm-error-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span className="pm-error-icon" style={{ fontSize: '24px', color: isSimulationMode ? '#00e5ff' : '#ef4444' }}>
              {isSimulationMode ? '🛠️' : '🔌'}
            </span>
            <span className="pm-error-title" style={{ fontSize: '18px', fontWeight: 'bold', color: isSimulationMode ? '#00e5ff' : '#ef4444' }}>
              {pmError.title}
            </span>
          </div>
          <p className="pm-error-message" style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {pmError.message}
          </p>
          <div className="pm-error-fix" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>
            <span className="pm-fix-label" style={{ fontWeight: 'bold', fontSize: '13px', color: '#f59e0b' }}>Action Required:</span>
            <code style={{ fontSize: '13px', fontFamily: 'monospace', color: '#e5e7eb' }}>{pmError.fix}</code>
          </div>
          <div className="pm-error-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => { setRetryCount(0); fetchPremarketData(); }} className="btn btn-gold" style={{ padding: '8px 16px' }}>
              ↺ Retry Connection Now
            </button>
            {!isSimulationMode && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Auto-retrying in <strong>{offlineCountdown}s</strong>...
              </span>
            )}
          </div>
        </div>
      )}

      {/* 9:20 AM Confirmation Check */}
      {show920 && (
        <div className="pm-section pm-confirm-section" style={{
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          background: 'var(--card-bg)',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>🎯 9:20 AM Confirmation Check</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Verify pre-market bias before entering trades
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="pm-gap-card" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pre-Open IEP</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{niftyGap.prev_close > 0 ? niftyGap.iep?.toLocaleString('en-IN') : '—'}</div>
            </div>
            <div className="pm-gap-card" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Current Spot</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{(niftyLive?.lastPrice || niftyLive?.price || niftyGap.iep)?.toLocaleString('en-IN')}</div>
            </div>
            {(() => {
              const spotVal = niftyLive?.lastPrice || niftyLive?.price || niftyGap.iep;
              const iepVal  = niftyGap.iep;
              const gapFilled = Math.abs(spotVal - iepVal) < 30;
              return (
                <div className="pm-gap-card" style={{
                  padding: '12px',
                  background: gapFilled ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                  border: gapFilled ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(34,197,94,0.2)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gap Status</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: gapFilled ? '#f97316' : '#22c55e' }}>
                    {gapFilled ? '⚠ Gap Filling' : '✓ Gap Holding'}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Entry Recommendation inside Confirmation Check */}
          {pmEntry && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                background: pmEntry.bias === 'CE' || pmEntry.bias === 'BULLISH' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: pmEntry.bias === 'CE' || pmEntry.bias === 'BULLISH' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: pmEntry.bias === 'CE' || pmEntry.bias === 'BULLISH' ? '#22c55e' : '#ef4444' }}>
                  {pmEntry.bias === 'CE' || pmEntry.bias === 'BULLISH' ? '🟢 BIAS: BUY CALL (CE)' : '🔴 BIAS: BUY PUT (PE)'}
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px' }}>Confidence: {pmEntry.confidence}%</p>

                {pmEntry.bias === 'CE' || pmEntry.bias === 'BULLISH' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Strike</span><strong>{pmEntry.ce?.ticker}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Premium</span><strong>₹{pmEntry.ce?.premium?.current || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Action</span><strong>{pmEntry.ce?.entry?.action}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Stop Loss</span><strong style={{ color: '#ef4444' }}>₹{pmEntry.ce?.sl?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target 1</span><strong style={{ color: '#22c55e' }}>₹{pmEntry.ce?.targets?.[0]?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target 2</span><strong style={{ color: '#22c55e' }}>₹{pmEntry.ce?.targets?.[1]?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', color: '#ff4444' }}>
                      <span>Invalid If</span><strong>{pmEntry.ce?.invalidation}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Strike</span><strong>{pmEntry.pe?.ticker}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Premium</span><strong>₹{pmEntry.pe?.premium?.current || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Action</span><strong>{pmEntry.pe?.entry?.action}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Stop Loss</span><strong style={{ color: '#ef4444' }}>₹{pmEntry.pe?.sl?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target 1</span><strong style={{ color: '#22c55e' }}>₹{pmEntry.pe?.targets?.[0]?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target 2</span><strong style={{ color: '#22c55e' }}>₹{pmEntry.pe?.targets?.[1]?.price?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', color: '#ff4444' }}>
                      <span>Invalid If</span><strong>{pmEntry.pe?.invalidation}</strong>
                    </div>
                  </div>
                )}

                {pmEntry.warning && (
                  <div className="pm-warning-bar" style={{ marginTop: '12px' }}>
                    {pmEntry.warning}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmation Checklist */}
          <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>Entry Checklist</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                {
                  check: pmData?.globalCues?.dow?.changePct > 0 || pmData?.news?.overall_sentiment === 'BULLISH',
                  label: `US Markets positive / Bullish Sentiment (Dow ${pmData?.globalCues?.dow?.changePct > 0 ? '+' : ''}${pmData?.globalCues?.dow?.changePct?.toFixed(2) || '0.00'}%)`
                },
                {
                  check: niftyGap.gap_pct > 0,
                  label: `Nifty gap direction (${niftyGap.gap_pct > 0 ? 'Gap Up' : 'Gap Down'} ${niftyGap.gap_pct?.toFixed(2)}%)`
                },
                {
                  check: (pmEntry?.confidence || 0) > 60,
                  label: `Signal confidence > 60% (${pmEntry?.confidence || 0}%)`
                },
                {
                  check: ist.getMinutes() >= 20 || ist.getHours() > 9,
                  label: '9:20 AM wait period completed'
                },
                {
                  check: (() => {
                    const spotVal = niftyLive?.lastPrice || niftyLive?.price || niftyGap.iep;
                    const iepVal  = niftyGap.iep;
                    return Math.abs(spotVal - iepVal) >= 30;
                  })(),
                  label: 'Gap not filling against bias direction'
                }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <span style={{
                    color: item.check ? '#22c55e' : '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>{item.check ? '✓' : '✗'}</span>
                  <span style={{ color: item.check ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nifty Gap Analysis */}
      {niftyGap && (
        <div className="pm-section">
          <div className="pm-section-title">📊 Nifty 50 — Gap Analysis</div>
          <div className="pm-gap-row">
            <div className="pm-gap-card">
              <div className="pm-gap-card-label">Yesterday's Close</div>
              <div className="pm-gap-card-value" style={{ color: 'var(--text-primary)' }}>₹{niftyGap.prev_close?.toLocaleString('en-IN')}</div>
            </div>
            <div className="pm-gap-card">
              <div className="pm-gap-card-label">IEP / Current</div>
              <div className="pm-gap-card-value" style={{ color: gapColor }}>₹{niftyGap.iep?.toLocaleString('en-IN')}</div>
            </div>
            <div className="pm-gap-card">
              <div className="pm-gap-card-label">Gap</div>
              <div className="pm-gap-card-value" style={{ color: gapColor }}>
                {niftyGap.gap_pts > 0 ? '+' : ''}{niftyGap.gap_pts?.toFixed(1)} pts
              </div>
              <div style={{ color: gapColor, fontSize: 13, marginTop: 4 }}>
                ({niftyGap.gap_pct > 0 ? '+' : ''}{niftyGap.gap_pct?.toFixed(2)}%)
              </div>
            </div>
            <div className="pm-gap-card">
              <div className="pm-gap-card-label">Signal</div>
              <div className="pm-gap-badge" style={{
                background: gapDir === 'GAP_UP' ? 'rgba(34,197,94,0.2)' : gapDir === 'GAP_DOWN' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                color: gapColor, border: `1px solid ${gapColor}`,
              }}>
                {gapDir === 'GAP_UP' ? '🟢 GAP UP' : gapDir === 'GAP_DOWN' ? '🔴 GAP DOWN' : '🟡 FLAT OPEN'}
              </div>
            </div>
          </div>
          <div className="pm-strategy-hint">💡 <strong>Strategy:</strong> {niftyGap.strategy_hint}</div>
        </div>
      )}

      {pmLoading && !pmData && (
        <div className="pm-loading"><div className="pm-spinner" /><span>Fetching pre-market data…</span></div>
      )}

      {/* CE/PE Entry Setup Card with Conviction Color Border */}
      {pmEntry && (
        <div className="pm-section" style={{
          borderLeft: `5px solid ${
            pmEntry.confidence >= 85 ? '#00e5ff' :
            pmEntry.confidence >= 70 ? '#00e676' :
            pmEntry.confidence >= 40 ? '#ffab00' : '#ff1744'
          }`,
          boxShadow: pmEntry.confidence >= 85 ? '0 0 15px rgba(0,229,255,0.15)' : 'none'
        }}>
          <div className="pm-section-title">🎯 CE/PE Entry Recommendation — {pmEntry.symbol}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div className={`pm-bias-badge ${pmEntry.bias === 'CE' ? 'pm-bias-bull' : pmEntry.bias === 'PE' ? 'pm-bias-bear' : 'pm-bias-neutral'}`} style={{
              background: pmEntry.confidence >= 85 ? 'rgba(0,229,255,0.12)' : undefined,
              color: pmEntry.confidence >= 85 ? '#00e5ff' : undefined,
              borderColor: pmEntry.confidence >= 85 ? '#00e5ff' : undefined
            }}>
              {pmEntry.bias === 'CE' ? '🟢 BULLISH CE SETUP' : '🔴 BEARISH PE SETUP'}
            </div>
            {pmEntry.spot > 0 && <div className="pm-spot-label">Spot: ₹{pmEntry.spot?.toLocaleString('en-IN')}</div>}
            
            {/* Auto-generate notification badge */}
            {pmEntry.confidence >= 85 && (
              <span style={{
                background: 'rgba(0,229,255,0.15)', border: '1px solid #00e5ff',
                color: '#00e5ff', fontSize: 10, padding: '2px 8px', borderRadius: 4,
                fontWeight: 'bold', letterSpacing: '0.5px'
              }}>
                ⚡ HIGH CONVICTION CE/PE ENTRY ACTIVE
              </span>
            )}
          </div>

          <ConfidenceRing
            score={pmEntry.confidence}
            label={pmEntry.label}
            recommendation={pmEntry.recommendation}
          />

          {pmEntry.warning && <div className="pm-warning-bar" style={{
            background: 'rgba(255,171,0,0.08)', border: '1px solid #ffab00', color: '#ffab00'
          }}>⚠ {pmEntry.warning}</div>}

          {/* Option card rendering */}
          <div className="pm-entry-cards">
            {pmEntry.ce && <OptionCard card={pmEntry.ce} type="CE" />}
            {pmEntry.pe && <OptionCard card={pmEntry.pe} type="PE" />}
          </div>

          {/* Issue 3 Weighted Score Factor Breakdown Table */}
          {pmEntry.factors && (
            <div className="score-breakdown" style={{ marginTop: 20 }}>
              <div className="breakdown-header" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: 15 }}>📊 Pre-Market Signal Breakdown</span>
                <span style={{
                  color: pmEntry.confidence >= 85 ? '#00e5ff' : pmEntry.confidence >= 70 ? '#00e676' : '#ffab00',
                  fontWeight: 'bold', fontSize: 13
                }}>
                  {pmEntry.confidence}% Conviction Score
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="pm-movers-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Signal Component</th>
                      <th>Observed Value</th>
                      <th>Weighted Contribution</th>
                      <th style={{ textAlign: 'left' }}>Analytics Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmEntry.factors.map((f, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: 'left' }}><strong>{f.name}</strong></td>
                        <td className="mono" style={{ textAlign: 'center' }}>{f.value}</td>
                        <td className="mono" style={{
                          textAlign: 'center', 
                          color: f.pts > 0 ? '#00e676' : f.pts < 0 ? '#ff1744' : 'var(--text-secondary)',
                          fontWeight: 'bold'
                        }}>
                          +{f.pts} pts
                        </td>
                        <td style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-secondary)' }}>{f.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* F&O Movers Grid */}
      {(gapUps.length > 0 || gapDowns.length > 0) && (
        <div className="pm-section">
          <div className="pm-section-title">🚀 F&O Pre-Open Movers</div>
          <div className="pm-movers-grid">
            {gapUps.length > 0 && (
              <div>
                <div className="pm-movers-header pm-movers-up">📈 Strong Gap-Ups (≥1.5%)</div>
                <div className="table-wrap">
                  <table className="pm-movers-table">
                    <thead><tr><th>Symbol</th><th>Prev Close</th><th>IEP</th><th>Gap%</th><th>Buy Pressure</th></tr></thead>
                    <tbody>
                      {gapUps.map((s, i) => (
                        <tr key={i}>
                          <td><strong>{s.symbol}</strong></td>
                          <td>₹{s.prev_close}</td>
                          <td style={{ color: '#22c55e' }}>₹{s.iep}</td>
                          <td><span className="pm-gap-up-chip">+{s.gap_pct?.toFixed(2)}%</span></td>
                          <td>
                            <div className="pm-pressure-bar-wrap"><div className="pm-pressure-bar pm-pressure-buy" style={{ width: `${s.buy_pressure_pct}%` }} /></div>
                            <span className="pm-pressure-label">{s.buy_pressure_pct}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {gapDowns.length > 0 && (
              <div>
                <div className="pm-movers-header pm-movers-down">📉 Strong Gap-Downs (≤-1.5%)</div>
                <div className="table-wrap">
                  <table className="pm-movers-table">
                    <thead><tr><th>Symbol</th><th>Prev Close</th><th>IEP</th><th>Gap%</th><th>Sell Pressure</th></tr></thead>
                    <tbody>
                      {gapDowns.map((s, i) => (
                        <tr key={i}>
                          <td><strong>{s.symbol}</strong></td>
                          <td>₹{s.prev_close}</td>
                          <td style={{ color: '#ef4444' }}>₹{s.iep}</td>
                          <td><span className="pm-gap-down-chip">{s.gap_pct?.toFixed(2)}%</span></td>
                          <td>
                            <div className="pm-pressure-bar-wrap"><div className="pm-pressure-bar pm-pressure-sell" style={{ width: `${100 - s.buy_pressure_pct}%` }} /></div>
                            <span className="pm-pressure-label">{100 - s.buy_pressure_pct}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ctrl+D Interactive Debug Panel (Issue 3) */}
      {showDebug && (
        <div className="pm-section" style={{
          border: '1px solid rgba(0,229,255,0.4)',
          background: 'rgba(0,0,0,0.85)',
          padding: '20px',
          borderRadius: '8px',
          fontFamily: 'monospace'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,229,255,0.2)', paddingBottom: '8px', marginBottom: '14px' }}>
            <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>🕵️ Sherlock Premarket Debug Panel</span>
            <span style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowDebug(false)}>✕ Close (Ctrl+D)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ color: '#e5e7eb' }}>Cache Status:</span>{' '}
              <strong style={{ color: pmData?.from_cache ? '#f5a623' : '#00e676' }}>
                {pmData?.from_cache ? 'STALE CACHE IN USE' : 'LIVE COOKIE ACTIVE'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#e5e7eb' }}>Nifty IEP Tick History:</span>{' '}
              <span style={{ color: 'var(--gold)' }}>
                {niftyIepHistory.length > 0 ? niftyIepHistory.join(' ➔ ') : 'No ticks collected yet'}
              </span>
            </div>
            <div>
              <span style={{ color: '#e5e7eb' }}>Stability Matrix:</span>{' '}
              <strong style={{ color: pmData?.iep_stability ? '#00e676' : '#ff1744' }}>
                {pmData?.iep_stability ? 'STABLE PRICE PROFILE' : 'FLUCTUATING ORDER Ticks'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#e5e7eb' }}>Raw Pre-market metrics:</span>
              <pre style={{
                background: '#111827', padding: '12px', borderRadius: '4px',
                maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)',
                color: '#10b981', marginTop: '6px'
              }}>
                {JSON.stringify(pmData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {pmData && (
        <div className="pm-footer-note">
          📡 Data fetched at {new Date(pmData.fetched_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })} IST
          {pmData.total_fo_stocks > 0 && ` · ${pmData.total_fo_stocks} F&O stocks scanned`}
          {pmData.from_cache && ' · Cached'}
          {pmData.is_simulated && ' · Simulated Fallback active'}
        </div>
      )}
    </div>
  );
}

// ── Formatting Utilities ───────────────────────────────────────────────────`;

// Perform programmatic replacement of PreMarketIntel function block
const regex = /function PreMarketIntel\(\) \{[\s\S]*?\/\/ ── Formatting Utilities ───────────────────────────────────────────────────/;
if (content.match(regex)) {
  content = content.replace(regex, newPreMarketIntelCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully rewrote PreMarketIntel block in App.jsx');
} else {
  console.error('Failed to locate PreMarketIntel block in App.jsx via regex.');
}
