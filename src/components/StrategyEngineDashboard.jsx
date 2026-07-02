import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import InstitutionalPatternEnginePanel from './clueboard/InstitutionalPatternEnginePanel';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  detectPattern,
  buildStrategyTimeline,
  getISTMinutes,
  getISTDate,
  WINDOW_TIMES
} from '../utils/sharedHelpers';

export default function StrategyEngineDashboard({
  spotPrice,
  mini = false,
  activeBias = null,
  regimeWindow = null,
  regimeOverride = false,
  intradayShift = null,  // { active: bool, reason: string, triggeredAt: string }
}) {
  const [activeWindowIdx, setActiveWindowIdx] = useState(0);
  const [news, setNews] = useState(null);
  const [newsCountdown, setNewsCountdown] = useState(900); // 15 min
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertsLog, setAlertsLog] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [loggedTrades, setLoggedTrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedHistIdx, setSelectedHistIdx] = useState(null);
  const [tradeModal, setTradeModal] = useState(null); // { strategy, lotSize }
  const [isHolidayOrWeekend, setIsHolidayOrWeekend] = useState(false);
  
  const [persistedTimeline, setPersistedTimeline] = usePersistedState('timelineSlots', { date: '', slots: [] });
  const slotsState = persistedTimeline.slots || [];
  
  const alertedCandlesRef = useRef(new Set());
  // FIX 1.3: aliveRef prevents setState calls after the component unmounts
  // (can happen when the user rapidly switches sub-tabs during async fetch).
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const [candles5m, setCandles5m] = useState([]);
  const [candles15m, setCandles15m] = useState([]);
  const [preMarketMetrics, setPreMarketMetrics] = useState({
    giftNiftyPremium: 0,
    usFuturesChange: 0,
    indiaVix: 15,
    pcr: 1.0,
    fiiNetCrore: 0,
    optionData: null
  });

  // FIX 1.2: Wrap fetchTimelineData in useCallback with [] deps so the
  // setInterval below captures a stable function reference rather than a
  // stale closure that is silently recreated on every render pass.
  const fetchTimelineData = useCallback(async () => {
    try {
      const resStatus = await fetch('/api/nse/market-status');
      const dStatus = resStatus.ok ? await resStatus.json() : {};
      console.log('[StrategyDashboard] Market Status:', dStatus);
      const isClosedHoliday = dStatus.status === 'CLOSED' && 
        (dStatus.reason?.includes('Weekend') || dStatus.reason?.includes('Holiday'));
      console.log('[StrategyDashboard] isClosedHoliday:', isClosedHoliday);
      if (aliveRef.current) setIsHolidayOrWeekend(isClosedHoliday);

      const res5m = await fetch('/api/candles?symbol=NIFTY&interval=5m');
      const d5m = res5m.ok ? await res5m.json() : {};
      const c5m = d5m.candles || [];
      if (aliveRef.current) setCandles5m(c5m);

      const res15m = await fetch('/api/candles?symbol=NIFTY&interval=15m');
      const d15m = res15m.ok ? await res15m.json() : {};
      const c15m = d15m.candles || [];
      if (aliveRef.current) setCandles15m(c15m);

      const resVix = await fetch('/api/nse/india-vix');
      const dVix = resVix.ok ? await resVix.json() : {};
      const vixVal = dVix.price || 15;

      const resFii = await fetch('/api/fiidii/today');
      const dFii = resFii.ok ? await resFii.json() : {};
      const fiiVal = dFii.fiiNetCrore || dFii.fii_net || 0;

      const resOpt = await fetch('/api/nse/option-chain?symbol=NIFTY');
      const dOpt = resOpt.ok ? await resOpt.json() : null;
      const pcrVal = dOpt?.pcr || 1.0;

      const resScan = await fetch('/api/premarket/scan');
      const dScan = resScan.ok ? await resScan.json() : {};
      const giftPremium = dScan.nifty_gap?.gap_pts || dScan._raw?.sgx_gap || 0;

      const resCues = await fetch('/api/nse/global-cues');
      const dCues = resCues.ok ? await resCues.json() : {};
      const usChange = dCues.nasdaq?.changePct || dCues.dow?.changePct || 0;

      if (aliveRef.current) {
        setPreMarketMetrics({
          giftNiftyPremium: giftPremium,
          usFuturesChange: usChange,
          indiaVix: vixVal,
          pcr: pcrVal,
          fiiNetCrore: fiiVal,
          optionData: dOpt
        });
      }
    } catch (err) {
      console.warn("Failed to fetch timeline data:", err);
    }
  }, []);

  useEffect(() => {
    fetchTimelineData();
    const interval = setInterval(fetchTimelineData, 60000);
    return () => clearInterval(interval);
  }, [fetchTimelineData]);

  useEffect(() => {
    const rebuildTimeline = async () => {
      const built = await buildStrategyTimeline(
        preMarketMetrics.giftNiftyPremium,
        preMarketMetrics.usFuturesChange,
        preMarketMetrics.indiaVix,
        preMarketMetrics.pcr,
        preMarketMetrics.fiiNetCrore,
        candles5m,
        candles15m,
        preMarketMetrics.optionData,
        spotPrice,
        news?.score || 0,
        activeBias
      );
      setHistory(built);

      const nowMinutes = getISTMinutes();
      let activeIdx = 0;
      built.forEach((w, idx) => {
        if (nowMinutes >= w.timeMinutes) {
          activeIdx = idx;
        }
      });
      setActiveWindowIdx(activeIdx);
    };

    if (spotPrice > 1000) {
      rebuildTimeline();
    }
  }, [spotPrice, candles5m, candles15m, preMarketMetrics, news]);

  // Sync history and activeBias to persisted slotsState
  useEffect(() => {
    if (!history || history.length === 0) return;

    // Get IST date string (YYYY-MM-DD)
    const istDate = getISTDate();
    const todayStr = istDate.toISOString().split('T')[0];

    setPersistedTimeline(prev => {
      const isNewDay = prev.date !== todayStr;
      const prevSlots = isNewDay ? [] : (prev.slots || []);
      const prevMap = new Map(prevSlots.map(s => [s.slot, s]));

      const nextSlots = history.map(w => {
        const slotName = w.slot || w.time;
        const prevSlot = prevMap.get(slotName);

        let status = 'FUTURE';
        if (w.isPast) status = 'COMPLETED';
        else if (w.isCurrent) status = 'ACTIVE';

        const isLocked = status === 'COMPLETED' || status === 'FUTURE';
        const defaultType = w.recommendation;

        let currentType = defaultType;

        // FIX 6.1: Record a lockedAt timestamp the moment a slot transitions
        // from ACTIVE → COMPLETED. This fingerprints exactly when the signal
        // was live, preventing retroactive re-labelling in the persisted store.
        let lockedAt = prevSlot?.lockedAt ?? null;

        if (status === 'COMPLETED') {
          if (prevSlot && prevSlot.status === 'COMPLETED') {
            // Already locked — preserve the saved currentType and lockedAt
            currentType = prevSlot.currentType;
          } else {
            // Transitioning to COMPLETED: lock in whatever currentType it had
            // while active (or defaultType if it was never active)
            currentType = prevSlot ? prevSlot.currentType : defaultType;
            // Record the lock timestamp only on the first transition
            if (!lockedAt) lockedAt = Date.now();
          }
        } else if (status === 'ACTIVE') {
          // Active slot always reflects the live candle trend (defaultType)
          currentType = defaultType;
          lockedAt    = null; // clear any stale lockedAt from a previous run
        } else {
          // FUTURE
          currentType = defaultType;
          lockedAt    = null;
        }

        return {
          slot: slotName,
          defaultType,
          currentType,
          isLocked,
          status,
          lockedAt,             // FIX 6.1: immutable lock timestamp
          computedAt: w.computedAt ?? null, // FIX 6.1: propagate from window obj
        };
      });

      const hasChanged = isNewDay || JSON.stringify(prev.slots) !== JSON.stringify(nextSlots) || prev.date !== todayStr;
      return hasChanged ? { date: todayStr, slots: nextSlots } : prev;
    });
  }, [history, activeBias]);

  // Scrape news every 15 minutes
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/premarket/news-sentiment');
      if (res.ok) {
        const data = await res.json();
        if (aliveRef.current) setNews(data);
        // FIX 1.4: Reset the countdown AFTER a successful fetch
        if (aliveRef.current) setNewsCountdown(900);
      } else {
        // FIX 1.4: Also reset on HTTP-error responses so the countdown
        // doesn't silently misrepresent a stale last-known refresh time.
        if (aliveRef.current) setNewsCountdown(900);
      }
    } catch (err) {
      console.warn("Failed to fetch news sentiment:", err);
      // FIX 1.4: Reset countdown even on network failure so the UI does
      // not show a countdown ticking down to stale data that never refreshed.
      if (aliveRef.current) setNewsCountdown(900);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // News countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNewsCountdown(prev => prev > 0 ? prev - 1 : 900);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // FIX 1.3: Pattern candle poll now guards all setState calls with aliveRef
  // so they are never dispatched after the component unmounts (which happens
  // when the user rapidly switches between sub-tabs).
  useEffect(() => {
    const pollCandles = async () => {
      try {
        const res5m = await fetch('/api/candles?symbol=NIFTY&interval=5m');
        if (!res5m.ok) return;
        const d5m = await res5m.json();
        const candles5 = d5m.candles || [];

        if (candles5.length < 3) return;

        const latest5 = candles5[candles5.length - 1];
        const vwapVal = d5m.overlays?.vwap?.[d5m.overlays.vwap.length - 1]?.value || latest5.close;

        // Detect patterns
        const patterns5 = detectPattern(candles5, vwapVal);

        // Check for new high-strength pattern alerts
        patterns5.forEach(p => {
          if (p.strength === 'HIGH') {
            const alertKey = latest5.time + "_" + p.name;
            if (!alertedCandlesRef.current.has(alertKey)) {
              alertedCandlesRef.current.add(alertKey);

              const newAlert = {
                id: Date.now() + Math.random(),
                type: p.signal === 'CE' ? 'bullish' : p.signal === 'PE' ? 'bearish' : 'neutral',
                title: `⚡ ${p.name} Detected`,
                message: p.description,
                action: `Consider ${p.signal} — confirm on 15-min before entry`,
                timestamp: new Date().toLocaleTimeString('en-IN')
              };

              // Guard: only setState if component is still mounted
              if (!aliveRef.current) return;
              setActiveAlerts(prev => [...prev, newAlert]);
              setAlertsLog(prev => [newAlert, ...prev]);

              setTimeout(() => {
                if (!aliveRef.current) return;
                setActiveAlerts(prev => prev.filter(a => a.id !== newAlert.id));
              }, 5000);
            }
          }
        });
      } catch (err) {
        console.warn("Failed polling candles for patterns:", err);
      }
    };

    pollCandles();
    const interval = setInterval(pollCandles, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update live P&L in tick loop (simulated delta)
  useEffect(() => {
    if (loggedTrades.length === 0) return;
    
    setLoggedTrades(prevTrades => {
      let updated = false;
      const nextTrades = prevTrades.map(t => {
        if (t.status !== 'OPEN') return t;
        
        updated = true;
        const priceDiff = spotPrice - t.entrySpot;
        const delta = 0.55;
        let currentPrem = t.entry;
        
        if (t.type === 'CE') {
          currentPrem = Math.round(t.entry + priceDiff * delta);
        } else {
          currentPrem = Math.round(t.entry - priceDiff * delta);
        }
        
        currentPrem = Math.max(5, currentPrem); // premium floor
        const pnl = (currentPrem - t.entry) * t.qty;
        
        let status = 'OPEN';
        if (currentPrem <= t.sl) status = 'STOPPED';
        else if (currentPrem >= t.t2) status = 'TARGET_HIT';
        
        return {
          ...t,
          currentPrice: currentPrem,
          pnl,
          status
        };
      });
      
      return updated ? nextTrades : prevTrades;
    });
  }, [spotPrice, loggedTrades.length]);

  const handleLogTrade = (strategy) => {
    setTradeModal({
      strategy,
      lotSize: 1,
      entrySpot: spotPrice
    });
  };

  const confirmLogTrade = () => {
    if (!tradeModal) return;
    const { strategy, lotSize, entrySpot } = tradeModal;
    const entryVal = strategy.entryVal || 90;
    const isCE = strategy.recommendation.includes('CE');
    
    const newTrade = {
      id: Date.now(),
      time: strategy.time || '10:15 AM',
      type: isCE ? 'CE' : 'PE',
      strike: strategy.strike,
      entrySpot: entrySpot,
      entry: entryVal,
      sl: strategy.slVal || (entryVal - 30),
      t1: strategy.t1Val || (entryVal + 35),
      t2: strategy.t2Val || (entryVal + 70),
      qty: 25 * lotSize,
      currentPrice: entryVal,
      pnl: 0,
      status: 'OPEN'
    };
    
    setLoggedTrades(prev => [newTrade, ...prev]);
    setTradeModal(null);
  };

  const activeStrategyRaw = selectedHistIdx !== null ? history[selectedHistIdx] : history[activeWindowIdx];
  const currentStrategyRaw = history[activeWindowIdx];

  const activeStrategy = useMemo(() => {
    if (!activeStrategyRaw) return null;
    const slotState = slotsState.find(s => s.slot === activeStrategyRaw.time);
    if (!slotState) return activeStrategyRaw;

    if (slotState.currentType !== slotState.defaultType) {
      const recommendation = slotState.currentType;
      
      let strike = activeStrategyRaw.strike;
      if (strike && strike !== '—') {
        if (recommendation === 'PE') {
          strike = strike.replace(/CE$/, 'PE');
        } else if (recommendation === 'CE') {
          strike = strike.replace(/PE$/, 'CE');
        }
      }

      const isHigh = activeStrategyRaw.conviction === 'HIGH' || (parseInt(activeStrategyRaw.conviction) >= 80);
      const isMedium = activeStrategyRaw.conviction === 'MEDIUM' || (parseInt(activeStrategyRaw.conviction) >= 60);
      const entryMid = activeStrategyRaw.entryVal || (isHigh ? 95 : isMedium ? 75 : 60);
      const slVal = Math.round(entryMid * 0.68);
      const t1Val = Math.round(entryMid * 1.38);
      const t2Val = Math.round(entryMid * 1.76);
      const rrVal = entryMid > 0 ? ((t2Val - entryMid) / (entryMid - slVal)).toFixed(1) + ':1' : '—';
      const maxRisk = entryMid > 0 ? `₹${(entryMid - slVal) * 25}` : '—';

      return {
        ...activeStrategyRaw,
        recommendation,
        strike,
        entryVal: entryMid,
        slVal,
        t1Val,
        t2Val,
        sl: recommendation !== 'AVOID' ? `₹${slVal}` : '—',
        t1: recommendation !== 'AVOID' ? `₹${t1Val}` : '—',
        t2: recommendation !== 'AVOID' ? `₹${t2Val}` : '—',
        rr: rrVal,
        maxRisk
      };
    }
    return activeStrategyRaw;
  }, [activeStrategyRaw, slotsState]);

  const currentStrategy = useMemo(() => {
    if (!currentStrategyRaw) return null;
    const slotState = slotsState.find(s => s.slot === currentStrategyRaw.time);
    if (!slotState) return currentStrategyRaw;

    if (slotState.currentType !== slotState.defaultType) {
      const recommendation = slotState.currentType;
      
      let strike = currentStrategyRaw.strike;
      if (strike && strike !== '—') {
        if (recommendation === 'PE') {
          strike = strike.replace(/CE$/, 'PE');
        } else if (recommendation === 'CE') {
          strike = strike.replace(/PE$/, 'CE');
        }
      }

      const isHigh = currentStrategyRaw.conviction === 'HIGH' || (parseInt(currentStrategyRaw.conviction) >= 80);
      const isMedium = currentStrategyRaw.conviction === 'MEDIUM' || (parseInt(currentStrategyRaw.conviction) >= 60);
      const entryMid = currentStrategyRaw.entryVal || (isHigh ? 95 : isMedium ? 75 : 60);
      const slVal = Math.round(entryMid * 0.68);
      const t1Val = Math.round(entryMid * 1.38);
      const t2Val = Math.round(entryMid * 1.76);
      const rrVal = entryMid > 0 ? ((t2Val - entryMid) / (entryMid - slVal)).toFixed(1) + ':1' : '—';
      const maxRisk = entryMid > 0 ? `₹${(entryMid - slVal) * 25}` : '—';

      return {
        ...currentStrategyRaw,
        recommendation,
        strike,
        entryVal: entryMid,
        slVal,
        t1Val,
        t2Val,
        sl: recommendation !== 'AVOID' ? `₹${slVal}` : '—',
        t1: recommendation !== 'AVOID' ? `₹${t1Val}` : '—',
        t2: recommendation !== 'AVOID' ? `₹${t2Val}` : '—',
        rr: rrVal,
        maxRisk
      };
    }
    return currentStrategyRaw;
  }, [currentStrategyRaw, slotsState]);

  const totalPnL = loggedTrades.reduce((acc, t) => acc + t.pnl, 0);
  const winRateNum = loggedTrades.filter(t => t.status === 'TARGET_HIT').length;
  const closedTradesCount = loggedTrades.filter(t => t.status !== 'OPEN').length;
  const winRate = closedTradesCount > 0 ? ((winRateNum / closedTradesCount) * 100).toFixed(0) + '%' : '—';

  // Inject Styles dynamically
  useEffect(() => {
    const styleId = 'strategy-engine-dashboard-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .strategy-engine-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 20px;
        }
        @media(max-width: 900px) {
          .strategy-engine-grid {
            grid-template-columns: 1fr;
          }
        }
        .strategy-glow-CE {
          box-shadow: 0 0 25px rgba(0, 230, 118, 0.18);
          border: 1px solid rgba(0, 230, 118, 0.4) !important;
        }
        .strategy-glow-PE {
          box-shadow: 0 0 25px rgba(255, 23, 68, 0.18);
          border: 1px solid rgba(255, 23, 68, 0.4) !important;
        }
        .strategy-glow-AVOID {
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
        }
        .alert-overlay-container {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .alert-card {
          width: 320px;
          background: #0b0f19;
          border-left: 4px solid #00e676;
          border-radius: 6px;
          padding: 12px 16px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          pointer-events: auto;
          animation: alert-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .alert-card.bearish {
          border-left-color: #ff1744;
        }
        @keyframes alert-slide {
          from { opacity: 0; transform: translateX(80px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .history-pill {
          padding: 8px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          font-family: monospace;
          font-size: 11px;
        }
        .history-pill.active {
          border-color: var(--gold);
          background: rgba(201, 168, 76, 0.12);
          box-shadow: 0 0 10px rgba(201, 168, 76, 0.2);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (mini) {
    if (isHolidayOrWeekend) {
      return (
        <div style={{
          background: 'rgba(11,15,25,0.4)',
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '12px 16px',
          margin: '12px 0 16px',
          textAlign: 'center',
          fontSize: 11,
          color: '#64748b'
        }}>
          🔒 Strategy Engine Locked (Market Holiday)
        </div>
      );
    }
    if (!currentStrategy) return null;
    const isCE = currentStrategy.recommendation.includes('CE');
    const isAvoid = currentStrategy.recommendation === 'AVOID';
    const borderCl = isAvoid ? 'rgba(255,255,255,0.15)' : isCE ? '#00e676' : '#ff1744';
    return (
      <div style={{
        background: 'rgba(11,15,25,0.6)',
        border: `1px solid ${borderCl}44`,
        borderRadius: 8,
        padding: '16px',
        margin: '12px 0 16px',
        boxShadow: isAvoid ? 'none' : `0 0 16px ${borderCl}10`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
          <span>⏱ ACTIVE 15-MIN STRATEGY WINDOW</span>
          <span style={{ color: borderCl }}>{currentStrategy.time}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: borderCl }}>
              {currentStrategy.recommendation} {!isAvoid && `[${currentStrategy.conviction}]`}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {!isAvoid ? `Strike: ${currentStrategy.strike} | Entry: ${currentStrategy.entry}` : 'Market cues conflict. Stand down.'}
            </div>
          </div>
          <button 
            className="btn btn-gold btn-sm"
            onClick={() => {
              const pTab = document.getElementById('pre-market-tab');
              if (pTab) pTab.click();
              setTimeout(() => {
                const sTab = document.getElementById('pmi-panel-strategyEngine');
                if (sTab) sTab.click();
              }, 150);
            }}
          >
            Open Engine ⏱
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Active Alerts Overlay */}
      <div className="alert-overlay-container">
        {activeAlerts.map(alert => (
          <div key={alert.id} className={`alert-card ${alert.type === 'bearish' ? 'bearish' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <strong style={{ color: alert.type === 'bullish' ? '#00e676' : '#ff1744', fontSize: 12 }}>{alert.title}</strong>
              <button 
                onClick={() => setActiveAlerts(prev => prev.filter(a => a.id !== alert.id))}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>{alert.message}</p>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>{alert.action}</span>
              <span>{alert.timestamp}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Intraday P&L Tracker */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {[
          { label: "TODAY'S WINDOWS", value: `${history.filter(h => h.isPast).length} / ${history.length}`, color: 'var(--gold)' },
          { label: "TRADES TAKEN", value: loggedTrades.length, color: '#94a3b8' },
          { 
            label: "LIVE P&L", 
            value: totalPnL >= 0 ? `+₹${totalPnL.toLocaleString('en-IN')}` : `-₹${Math.abs(totalPnL).toLocaleString('en-IN')}`, 
            color: totalPnL >= 0 ? '#00e676' : '#ff1744',
            pulse: loggedTrades.some(t => t.status === 'OPEN') 
          },
          { label: "WIN RATE TODAY", value: winRate, color: '#a855f7' }
        ].map((item, i) => (
          <div key={i} style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 9, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
            <div style={{ 
              fontSize: 22, 
              fontWeight: 900, 
              color: item.color, 
              fontFamily: 'monospace',
              animation: item.pulse ? 'pmi-pulse-green 2s infinite' : 'none'
            }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="strategy-engine-grid">
        {/* Left Column: Active Strategy Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isHolidayOrWeekend ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '40px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <strong style={{ display: 'block', color: '#cbd5e1', fontSize: 14, marginBottom: 6 }}>Strategy Engine Locked</strong>
              <span style={{ fontSize: 11 }}>No active windows. Market is closed for holiday/weekend.</span>
            </div>
          ) : activeStrategy ? (() => {
            const isCE = activeStrategy.recommendation.includes('CE');
            const isAvoid = activeStrategy.recommendation === 'AVOID';
            const bcClass = isAvoid ? 'strategy-glow-AVOID' : isCE ? 'strategy-glow-CE' : 'strategy-glow-PE';
            const brandColor = isAvoid ? '#94a3b8' : isCE ? '#00e676' : '#ff1744';
            
            return (
              <div className={`pmi-card ${bcClass}`} style={{
                background: isAvoid ? 'rgba(255,255,255,0.02)' : isCE ? 'rgba(0,230,118,0.04)' : 'rgba(255,23,68,0.04)',
                borderRadius: 12,
                padding: '24px 20px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏱ {activeStrategy.time} WINDOW {selectedHistIdx !== null && '(HISTORICAL VIEW)'}
                    {activeStrategy.confirmed !== undefined && !isAvoid && (
                      <span style={{ color: activeStrategy.confirmed ? '#00e676' : '#ff1744', border: `1px solid ${activeStrategy.confirmed ? '#00e67644' : '#ff174444'}`, background: activeStrategy.confirmed ? '#00e67610' : '#ff174410', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                        {activeStrategy.confirmed ? 'CONFIRMED ✓' : 'UNCONFIRMED ⚠'}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: brandColor, fontWeight: 'bold', border: `1px solid ${brandColor}44`, background: `${brandColor}10`, padding: '2px 8px', borderRadius: 4 }}>
                    {isAvoid ? 'AVOID SETUP' : activeStrategy.conviction} CONVICTION
                  </span>
                </div>

                <div style={{ fontSize: 44, fontWeight: 900, color: brandColor, marginBottom: 8, letterSpacing: -1 }}>
                  {activeStrategy.recommendation}
                </div>
                <p style={{ margin: '0 0 20px 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                  {isAvoid ? 'Market parameters are conflicting. Standard rules mandate standing down to protect capital.' : `High conviction setup based on multi-timeframe chart pattern alignment.`}
                </p>

                {!isAvoid && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12, marginBottom: 20 }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px' }}>
                        <span style={{ fontSize: 9, color: '#64748b', display: 'block', marginBottom: 4 }}>STRIKE OPTION</span>
                        <strong style={{ fontSize: 18, color: '#f8fafc', fontFamily: 'monospace' }}>{activeStrategy.strike}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px' }}>
                        <span style={{ fontSize: 9, color: '#64748b', display: 'block', marginBottom: 4 }}>ENTRY RANGE (₹)</span>
                        <strong style={{ fontSize: 18, color: '#ffab00', fontFamily: 'monospace' }}>{activeStrategy.entry}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                      <div style={{ background: 'rgba(255,23,68,0.05)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: 8, padding: '12px 14px' }}>
                        <span style={{ fontSize: 9, color: '#ff4444', display: 'block', marginBottom: 4 }}>STOP LOSS (₹)</span>
                        <strong style={{ fontSize: 15, color: '#ff4444', fontFamily: 'monospace' }}>{activeStrategy.sl}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 6, padding: '8px 12px' }}>
                          <span style={{ fontSize: 8, color: '#00e676', display: 'block', marginBottom: 2 }}>TARGET 1</span>
                          <strong style={{ fontSize: 13, color: '#00e676', fontFamily: 'monospace' }}>{activeStrategy.t1}</strong>
                        </div>
                        <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 6, padding: '8px 12px' }}>
                          <span style={{ fontSize: 8, color: '#00e676', display: 'block', marginBottom: 2 }}>TARGET 2</span>
                          <strong style={{ fontSize: 13, color: '#00e676', fontFamily: 'monospace' }}>{activeStrategy.t2}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 8, fontSize: 11, color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.03)', marginBottom: 20 }}>
                      <span>Max Risk: <strong style={{ color: '#ff1744' }}>{activeStrategy.maxRisk}</strong></span>
                      <span>R:R: <strong style={{ color: '#00e676' }}>{activeStrategy.rr}</strong></span>
                    </div>

                    {/* Trade logging section */}
                    {selectedHistIdx === null && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, display: 'flex', gap: 10 }}>
                        <button 
                          className="btn btn-gold" 
                          style={{ flex: 1, padding: '8px 0', fontSize: 12 }}
                          onClick={() => handleLogTrade(activeStrategy)}
                        >
                          📥 Log This Trade
                        </button>
                      </div>
                    )}
                  </>
                )}

                {isAvoid && activeStrategy.vetoed && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#f87171' }}>
                    ⚠️ {activeStrategy.vetoReason}
                  </div>
                )}
                
                {/* Supporting factors */}
                <div style={{ marginTop: 20 }}>
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Supporting Metrics</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeStrategy.supportingFactors?.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: brandColor }}>•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })() : <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, padding: 30, textAlign: 'center', color: '#475569' }}>Loading Strategy Engine...</div>}

          {/* Collapsible Alerts Log */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
            <div 
              onClick={() => setIsAlertsOpen(!isAlertsOpen)} 
              style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: isAlertsOpen ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <strong style={{ fontSize: 12, color: '#94a3b8' }}>⚡ Today's Alerts Log ({alertsLog.length})</strong>
              <span>{isAlertsOpen ? '▲' : '▼'}</span>
            </div>
            {isAlertsOpen && (
              <div style={{ maxHeight: 200, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alertsLog.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: '#475569', fontSize: 11 }}>No high-reliability pattern alerts yet today.</div>
                ) : (
                  alertsLog.map((alert, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderLeft: `3px solid ${alert.type === 'bullish' ? '#00e676' : '#ff1744'}`, borderRadius: '0 4px 4px 0', fontSize: 11 }}>
                      <div>
                        <strong style={{ color: '#cbd5e1' }}>{alert.title}</strong>
                        <span style={{ marginLeft: 8, color: '#64748b', fontSize: 9 }}>{alert.timestamp}</span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: 9 }}>{alert.action}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Global News Sentiment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {news ? (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '20px 18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 14 }}>
                <strong style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 0.5 }}>🌐 GLOBAL CUES & NEWS SENTIMENT</strong>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  Next refresh: {Math.floor(newsCountdown / 60)}:{(newsCountdown % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* Sentiment score bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Sentiment Bias</span>
                  <strong style={{ color: news.score >= 3 ? '#00e676' : news.score <= -3 ? '#ff1744' : '#ffab00' }}>
                    {news.sentiment.toUpperCase()} [{news.score > 0 ? '+' : ''}{news.score}]
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', height: 10, borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: '100%', background: 'rgba(255,255,255,0.15)', zIndex: 1 }} />
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: news.score >= 0 ? '50%' : `${50 + (news.score / 10) * 50}%`,
                    width: `${Math.abs(news.score) / 10 * 50}%`,
                    height: '100%',
                    background: news.score >= 3 ? '#00e676' : news.score <= -3 ? '#ff1744' : '#ffab00',
                    transition: 'all 0.5s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginTop: 4 }}>
                  <span>Bearish (-10)</span>
                  <span>Neutral (0)</span>
                  <span>Bullish (+10)</span>
                </div>
              </div>

              {/* Headlines list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Market Headlines</span>
                {news.headlines?.map((h, i) => {
                  const tagClr = h.sentiment === 'bullish' ? '#00e676' : h.sentiment === 'bearish' ? '#ff1744' : '#64748b';
                  return (
                    <div key={i} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: 6, fontSize: 11, borderLeft: `2px solid ${tagClr}` }}>
                      <p style={{ margin: '0 0 4px 0', color: '#cbd5e1', lineHeight: 1.4 }}>{h.title}</p>
                      <span style={{ fontSize: 8, color: tagClr, fontWeight: 'bold', textTransform: 'uppercase' }}>{h.sentiment}</span>
                    </div>
                  );
                })}
              </div>

              {/* Key opp and risks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: '#00e676', fontWeight: 'bold' }}>🟢 Opportunity:</span>{' '}
                  <span style={{ color: '#cbd5e1' }}>{news.keyOpportunity}</span>
                </div>
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: '#ff1744', fontWeight: 'bold' }}>🔴 Risk:</span>{' '}
                  <span style={{ color: '#cbd5e1' }}>{news.keyRisk}</span>
                </div>
              </div>
            </div>
          ) : <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, padding: 30, textAlign: 'center', color: '#475569' }}>Connecting Global News Feed...</div>}

          {/* Active Trades Panel */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '20px 18px',
            flex: 1
          }}>
            <strong style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 0.5, display: 'block', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 14 }}>
              📁 TRADES LOGGED TODAY ({loggedTrades.length})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {loggedTrades.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 11 }}>No logged trades. Click "Log This Trade" on active windows to track.</div>
              ) : (
                loggedTrades.map(trade => {
                  const isClosed = trade.status !== 'OPEN';
                  const clr = trade.pnl >= 0 ? '#00e676' : '#ff1744';
                  return (
                    <div key={trade.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <strong style={{ color: trade.type === 'CE' ? '#00e676' : '#ff1744', fontSize: 13 }}>{trade.strike}</strong>
                          <span style={{ fontSize: 9, color: '#64748b', marginLeft: 8 }}>{trade.time} window</span>
                        </div>
                        <span style={{ 
                          fontSize: 9, 
                          fontWeight: 'bold', 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          background: isClosed ? 'rgba(255,255,255,0.05)' : 'rgba(0,230,118,0.1)', 
                          color: isClosed ? '#64748b' : '#00e676',
                          border: `1px solid ${isClosed ? 'rgba(255,255,255,0.1)' : 'rgba(0,230,118,0.2)'}`
                        }}>
                          {trade.status}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10, color: '#94a3b8' }}>
                        <div>Entry: ₹{trade.entry}</div>
                        <div>SL: ₹{trade.sl}</div>
                        <div>Qty: {trade.qty} ({trade.qty/25} lot)</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', marginTop: 8, paddingTop: 6, fontSize: 11 }}>
                        <span style={{ color: '#64748b' }}>Premium: ₹{trade.currentPrice}</span>
                        <strong style={{ color: clr }}>
                          {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Institutional-Grade Candlestick Pattern Engine Standalone Module */}
      <InstitutionalPatternEnginePanel
        activeSymbol="NIFTY"
        spotPrice={spotPrice}
        iv={0.145}
        dte={3}
        newsScore={news?.score || 0}
        isHolidayOrWeekend={isHolidayOrWeekend}
      />

      {/* Strategy History timeline strip */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '16px 20px'
      }}>
        <strong style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 0.5, display: 'block', marginBottom: 14 }}>
          ⏱ 15-MIN STRATEGY WINDOW TIMELINE
        </strong>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {history.map((w, idx) => {
            const slotState = slotsState.find(s => s.slot === w.time) || {
              defaultType: w.recommendation,
              currentType: w.recommendation,
              isLocked: w.isPast || w.isFuture || isHolidayOrWeekend,
              status: isHolidayOrWeekend ? 'FUTURE' : (w.isPast ? 'COMPLETED' : w.isCurrent ? 'ACTIVE' : 'FUTURE')
            };

            const isActive = isHolidayOrWeekend ? false : w.isCurrent;
            const isSelected = isHolidayOrWeekend ? false : (idx === selectedHistIdx);

            const rec = isHolidayOrWeekend ? 'AVOID' : slotState.currentType;
            const isAvoid = isHolidayOrWeekend || rec === 'AVOID';
            const isWatch = !isHolidayOrWeekend && rec === 'WATCH';
            const isCE = !isHolidayOrWeekend && rec.includes('CE');
            const isPE = !isHolidayOrWeekend && rec.includes('PE');
            const isFuture = isHolidayOrWeekend || slotState.status === 'FUTURE';
            const isPast = !isHolidayOrWeekend && slotState.status === 'COMPLETED';

            const borderColor = isActive  ? '#FFB800'   // amber — current
              : isCE   ? '#00FF88'
              : isPE   ? '#FF4444'
              : isAvoid ? '#888888'
              : isFuture ? '#333333'
              : '#555555';

            const signalColor = isCE    ? '#00FF88'
              : isPE   ? '#FF4444'
              : isAvoid ? '#888888'
              : isFuture ? '#444444'
              : '#FFB800';

            const confidence = parseInt(w.conviction) || 0;
            const isOverridden = slotState.defaultType !== slotState.currentType;
            const overrideText = isOverridden ? ` (Overridden from ${slotState.defaultType})` : '';

            return (
              <button
                key={idx}
                disabled={isFuture}
                onClick={() => setSelectedHistIdx(isSelected ? null : idx)}
                className={`history-pill ${isSelected || (isActive && selectedHistIdx === null) ? 'active' : ''}`}
                title={
                  isFuture 
                    ? 'Window not yet open'
                    : `${rec}${overrideText} | Score: ${Number(w.score || 0).toFixed(1)} | ${w.why}`
                }
                style={{ 
                  flex: '0 0 85px', 
                  border: `1px solid ${borderColor}`,
                  opacity: isPast && !isActive ? 0.65 : 1,
                  boxShadow: isActive ? `0 0 8px rgba(255,184,0,0.4)` : 'none',
                  cursor: isFuture ? 'not-allowed' : 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                <div style={{ color: '#64748b', fontSize: 9, marginBottom: 4 }}>{w.time}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: signalColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {isFuture 
                    ? '🔒' 
                    : isAvoid 
                      ? 'AVOID' 
                      : isWatch 
                        ? 'WATCH' 
                        : (isCE ? 'CE' : 'PE')
                  }
                  {!isFuture && !isAvoid && !isWatch && w.confirmed !== undefined && (
                    <span style={{ fontSize: 10, color: w.confirmed ? '#00e676' : '#ff1744' }} title={w.confirmed ? 'Confirmed by 5-min slope' : 'No 5-min slope confirmation'}>
                      {w.confirmed ? '✓' : '⚠'}
                    </span>
                  )}
                </div>
                {!isFuture && !isAvoid && !isWatch && (
                  <div style={{
                    height: '2px',
                    background: `linear-gradient(90deg, ${signalColor} ${confidence}%, transparent ${confidence}%)`,
                    borderRadius: '1px',
                    marginTop: '3px',
                  }} />
                )}
              </button>
            );
          })}
        </div>
        {selectedHistIdx !== null && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedHistIdx(null)}
              style={{ fontSize: 10, padding: '4px 10px' }}
            >
              Reset to Active Window ✕
            </button>
          </div>
        )}
      </div>

      {/* Log Trade Modal */}
      {tradeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000
        }}>
          <div style={{
            width: 360,
            background: '#0f172a',
            border: '1px solid var(--gold)',
            borderRadius: 10,
            padding: 24,
            boxShadow: '0 0 30px rgba(255,200,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--gold)', fontSize: 16 }}>📥 Log Trade to Intraday Tracker</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Window: <strong>{tradeModal.strategy.time}</strong><br/>
                Strategy: <strong style={{ color: tradeModal.strategy.recommendation.includes('CE') ? '#00e676' : '#ff1744' }}>{tradeModal.strategy.recommendation}</strong><br/>
                Strike Option: <strong>{tradeModal.strategy.strike}</strong>
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, color: '#64748b' }}>Number of Lots (1 Lot = 25 Qty)</label>
                <select 
                  value={tradeModal.lotSize}
                  onChange={(e) => setTradeModal(prev => ({ ...prev, lotSize: parseInt(e.target.value) }))}
                  style={{ width: '100%' }}
                >
                  {[1, 2, 4, 6, 8, 10, 20].map(l => (
                    <option key={l} value={l}>{l} Lot{l > 1 ? 's' : ''} ({l * 25} Qty)</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 12, color: '#cbd5e1', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
                Recommended Entry: <strong>{tradeModal.strategy.entry}</strong><br/>
                Actual Entry Premium: <strong>₹{tradeModal.strategy.entryVal}</strong><br/>
                Initial Stop Loss: <strong>₹{tradeModal.strategy.slVal}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setTradeModal(null)}>Cancel</button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={confirmLogTrade}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
