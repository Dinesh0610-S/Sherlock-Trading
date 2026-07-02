import React from 'react';
import StrategyEngineDashboard from '../../components/StrategyEngineDashboard';
import { usePersistedState } from '../../hooks/usePersistedState';
import { usePMIStream } from '../../hooks/usePMIStream';

// ─────────────────────────────────────────────────────────────────────────────
// PRE-MARKET TIMER (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const getNextMarketOpen = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  let target = new Date(now);
  target.setHours(9, 15, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  while (target.getDay() === 6 || target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }
  return target;
};

const PreMarketTimer = () => {
  const [timeLeft, setTimeLeft] = React.useState('');
  const [isMarketOpen, setIsMarketOpen] = React.useState(false);

  React.useEffect(() => {
    const update = () => {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = now.getDay();
      const isWeekend = day === 0 || day === 6;
      const timeVal = now.getHours() * 100 + now.getMinutes();
      if (!isWeekend && timeVal >= 915 && timeVal < 1530) {
        setIsMarketOpen(true); setTimeLeft('Market is OPEN'); return;
      }
      setIsMarketOpen(false);
      const target = getNextMarketOpen();
      const diffMs = target - now;
      if (diffMs <= 0) { setTimeLeft('00:00:00'); return; }
      const h = Math.floor(diffMs / 3_600_000);
      const m = Math.floor((diffMs % 3_600_000) / 60_000);
      const s = Math.floor((diffMs % 60_000) / 1000);
      const pad = n => String(n).padStart(2, '0');
      setTimeLeft(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: 'rgba(201,168,76,0.06)',
      border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 8, padding: '12px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, marginBottom: 20,
      boxShadow: '0 0 15px rgba(201,168,76,0.05)',
      animation: 'pmi-fade-in 0.3s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⏰</span>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            {isMarketOpen ? 'Live Status' : 'Countdown to Market Open'}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            Standard NSE/BSE Trading hours: 9:15 AM - 3:30 PM IST (Mon-Fri)
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: 'monospace', fontSize: 22, fontWeight: 800,
        color: isMarketOpen ? '#00e676' : 'var(--gold)',
        letterSpacing: '1px',
        textShadow: isMarketOpen ? '0 0 10px rgba(0,230,118,0.2)' : '0 0 10px rgba(201,168,76,0.2)',
        background: 'rgba(0,0,0,0.2)', padding: '6px 14px',
        borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {timeLeft}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REGIME STATUS PILL
// ─────────────────────────────────────────────────────────────────────────────

const RegimePill = ({ regime, regimeWindow, regimeOverride }) => {
  const colors = {
    CE:      { bg: 'rgba(0,230,118,0.12)', border: 'rgba(0,230,118,0.4)', text: '#00e676' },
    PE:      { bg: 'rgba(255,23,68,0.12)',  border: 'rgba(255,23,68,0.4)',  text: '#ff1744' },
    NEUTRAL: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', text: '#94a3b8' },
  };
  const c = colors[regime] ?? colors.NEUTRAL;
  const label =
    regimeWindow === '09:15–09:30' ? `⏱ ${regime} · WINDOW A` :
    regimeWindow === '10:00–10:15' ? `⏱ ${regime} · WINDOW C` :
    `⏱ ${regime === 'NEUTRAL' ? 'ENGINE' : regime} · NORMAL`;

  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '4px 10px',
      borderRadius: 4, background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      letterSpacing: 0.5,
    }}>
      {label}{regimeOverride ? ' ⚡' : ''}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OVERRIDE BANNER
// ─────────────────────────────────────────────────────────────────────────────

const OverrideBanner = ({ visible, reason, regime, windowLabel }) => {
  if (!visible) return null;

  // Determine styles and messages based on windowLabel / regime
  const isHalt = windowLabel === 'VOLATILITY_HALT' || windowLabel === 'CIRCUIT_LIMIT_HALT';
  const displayReason = reason || (windowLabel === '09:15–09:30' ? 'Opening candle low breached + significant PUT OI spike' : '');
  
  const bgColor = isHalt ? 'rgba(255, 171, 0, 0.08)' : 'rgba(255, 23, 68, 0.06)';
  const borderColor = isHalt ? 'rgba(255, 171, 0, 0.4)' : 'rgba(255, 23, 68, 0.4)';
  const textColor = isHalt ? '#ffb300' : '#ff6b6b';
  const badgeColor = isHalt ? '#ffab00' : '#ff1744';
  const badgeText = isHalt ? 'TRADING HALT ACTIVE' : 'REGIME OVERRIDE ACTIVE';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 16, fontSize: 12, color: textColor,
      fontWeight: 600, animation: 'pmi-fade-in 0.3s ease both',
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span>
        <strong style={{ color: badgeColor }}>{badgeText}</strong>
        {displayReason ? ` — ${displayReason}.` : ''}
        {!isHalt && (
          <>
            {' '}Target shifted to <strong style={{ color: regime === 'CE' ? '#00e676' : regime === 'PE' ? '#ff1744' : '#ffab00' }}>
              {regime === 'CE' ? 'CALL (CE)' : regime === 'PE' ? 'PUT (PE)' : 'NEUTRAL (STAND DOWN)'}
            </strong>.
          </>
        )}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE TICK INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

const LiveDot = ({ isLive, latency, dataFreshness }) => {
  const isHeartbeatActive = isLive && dataFreshness !== 'STALE' && dataFreshness !== 'OFFLINE';
  const color = isHeartbeatActive ? '#00e676' : dataFreshness === 'STALE' ? '#ffab00' : '#ff1744';
  const label = isHeartbeatActive 
    ? `SSE ACTIVE · ${latency ? `${latency}ms` : 'sub-second'} lat`
    : dataFreshness === 'STALE' 
    ? 'STREAM DELAYED (Stale Data)' 
    : 'OFFLINE (HTTP Polling fallback)';
    
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 10, color: color,
      fontWeight: 700, letterSpacing: '0.5px',
      background: 'rgba(0,0,0,0.2)', padding: '4px 10px',
      borderRadius: 4, border: `1px solid ${color}33`,
      fontFamily: 'monospace'
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
        display: 'inline-block',
        animation: isHeartbeatActive ? 'pmi-blink 1.2s ease-in-out infinite' : 'none'
      }} />
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SMC PANEL
// ─────────────────────────────────────────────────────────────────────────────

const SMCPanel = ({ smc }) => {
  if (!smc || smc.grade === 'AVOID') return null;
  
  const isCE = smc.finalSignal === 'CE';
  const sigColor = isCE ? '#00e676' : '#ff1744';
  const sigBg = isCE ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)';
  const sigBorder = isCE ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)';

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(26,26,26,0.6)',
      backdropFilter: 'blur(10px)',
      padding: '16px',
      marginTop: '16px',
      marginBottom: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', margin: 0 }}>
          <span style={{ marginRight: '8px', color: '#a855f7' }}>⚡</span>
          SMC Detection Engine
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '4px',
            background: 'rgba(168,85,247,0.15)',
            color: '#c084fc',
            border: '1px solid rgba(168,85,247,0.3)'
          }}>
            Grade: {smc.grade}
          </span>
          <span style={{
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '4px',
            background: sigBg,
            color: sigColor,
            border: `1px solid ${sigBorder}`
          }}>
            Signal: {smc.finalSignal}
          </span>
        </div>
      </div>
      
      {/* Active Setups */}
      {smc.activeSetups && smc.activeSetups.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            Active Confluences
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {smc.activeSetups.map((setup, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: '#cbd5e1',
                background: 'rgba(255,255,255,0.02)',
                padding: '8px 12px',
                borderLeft: '3px solid #a855f7',
                borderRadius: '0 4px 4px 0'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7', marginRight: '8px' }}></span>
                {setup}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry Zone */}
      {smc.entryZone && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px'
        }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.5px' }}>
              High Probability Entry Zone
            </div>
            <div style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px' }}>
              ₹{smc.entryZone.bottom.toFixed(0)} - ₹{smc.entryZone.top.toFixed(0)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.5px' }}>
              Invalidation (SL)
            </div>
            <div style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px' }}>
              ₹{smc.invalidation.toFixed(0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PreMarketIntel({ selectedAsset: propSelectedAsset }) {
  const [persistedSymbol] = usePersistedState('symbol', '^NSEI');
  const selectedAsset = propSelectedAsset || persistedSymbol;
  const [activePanel, setActivePanel] = React.useState('decision');
  const [capitalAtRisk, setCapitalAtRisk] = React.useState(5000);

  // ── Clean symbol ──────────────────────────────────────────────────────────
  const cleanSym = React.useMemo(() => {
    if (!selectedAsset) return 'NIFTY';
    const s = selectedAsset.toUpperCase();
    if (s.includes('NIFTY 50') || s.includes('^NSEI') || s === 'NIFTY') return 'NIFTY';
    if (s.includes('NIFTY BANK') || s.includes('^NSEBANK') || s === 'BANKNIFTY') return 'BANKNIFTY';
    if (s.includes('SENSEX') || s.includes('BSESN') || s === '^BSESN') return 'SENSEX';
    if (s.includes('NIFTY FIN') || s.includes('FINNIFTY') || s.includes('NIFTY_FIN_SERVICE')) return 'FINNIFTY';
    if (s.includes('MIDCAP') || s.includes('MIDCPNIFTY') || s.includes('NSEMDCP50')) return 'MIDCPNIFTY';
    return s.replace('.NS', '').replace('.BO', '').replace('^', '');
  }, [selectedAsset]);

  // ── Unified live data pipeline ─────────────────────────────────────────────
  const {
    tick, isLive, lastHeartbeat, latency, dataFreshness,
    scanData, entryData,
    loading, error, lastFetched, countdown,
    regime, regimeWindow, regimeOverride, activeBias,
    intradayShift, openingRangeLow,
    refresh,
  } = usePMIStream(cleanSym);

  // Merge live spot price: SSE tick takes precedence over REST entryData
  const liveSpot  = tick?.quote?.lastPrice ?? entryData?.spot ?? 0;
  const livePCR   = tick?.pcr              ?? entryData?.pcr  ?? null;

  // ── Chart focus pulse animation ref ──────────────────────────────────────
  const biasPanelRef   = React.useRef(null);
  const focusTimerRef  = React.useRef(null);

  /** Trigger 1.5s pulse-glow on the bias card (no canvas lag risk) */
  const triggerFocusPulse = React.useCallback(() => {
    const el = biasPanelRef.current;
    if (!el) return;
    el.classList.remove('pmi-chart-focus');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('pmi-chart-focus');
    clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      el?.classList.remove('pmi-chart-focus');
    }, 1500);
  }, []);

  /** Repeat pulse on touch-hold (fires every 1.5s while touch is held) */
  const touchHoldRef = React.useRef(null);
  const startTouchHold = React.useCallback(() => {
    triggerFocusPulse();
    touchHoldRef.current = setInterval(triggerFocusPulse, 1500);
  }, [triggerFocusPulse]);
  const stopTouchHold = React.useCallback(() => {
    clearInterval(touchHoldRef.current);
    touchHoldRef.current = null;
  }, []);

  // Cleanup on unmount
  React.useEffect(() => () => {
    clearTimeout(focusTimerRef.current);
    clearInterval(touchHoldRef.current);
  }, []);

  // ── Inject CSS styles ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const styleId = 'pmi-engine-styles-v4';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pmi-spin      { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes pmi-pulse-green { 0%,100% { opacity:.8;box-shadow:0 0 10px rgba(0,230,118,.3); } 50% { opacity:1;box-shadow:0 0 30px rgba(0,230,118,.65); } }
        @keyframes pmi-pulse-red   { 0%,100% { opacity:.8;box-shadow:0 0 10px rgba(255,23,68,.3); }  50% { opacity:1;box-shadow:0 0 30px rgba(255,23,68,.65); } }
        @keyframes pmi-fade-in   { from { opacity:0;transform:translateY(8px); } to { opacity:1;transform:translateY(0); } }
        @keyframes pmi-shimmer   { 0% { transform:translateX(-100%); } 100% { transform:translateX(100%); } }

        /* ── Chart focus pulse glow ── */
        @keyframes pmi-pulse-glow {
          0%   { box-shadow: 0 0 0   0   rgba(0,255,209,0),   border-color: transparent; }
          30%  { box-shadow: 0 0 18px 4px rgba(0,255,209,0.45), border-color: rgba(0,255,209,0.6); }
          70%  { box-shadow: 0 0 22px 6px rgba(0,255,209,0.35), border-color: rgba(0,255,209,0.5); }
          100% { box-shadow: 0 0 0   0   rgba(0,255,209,0),   border-color: transparent; }
        }
        .pmi-chart-focus {
          animation: pmi-pulse-glow 1.5s ease-out forwards !important;
          outline: none;
        }

        .pmi-card    { animation: pmi-fade-in 0.3s ease both; }
        .pmi-opt-card { transition: transform 0.2s ease; }
        .pmi-opt-card:hover { transform: translateY(-2px); }
        .pmi-mrow:hover { background: rgba(255,255,255,0.03) !important; }
        .pmi-nav-btn  { transition: all 0.2s ease; }
        .pmi-sector-scroll::-webkit-scrollbar { display: none; }
        .pmi-sector-pill:hover { transform: scale(1.04); box-shadow: 0 0 8px rgba(255,255,255,0.02); }
        @keyframes pmi-blink     { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .pmi-iep-live { animation: pmi-blink 1.2s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ── Phase / Bias helpers ──────────────────────────────────────────────────
  const phaseInfo = (ph) => ({
    BEFORE_PREOPEN: { label: 'Pre-Open Not Started',   color: '#64748b' },
    ORDER_ENTRY:    { label: '⚡ ORDER ENTRY WINDOW',  color: '#ffab00' },
    IEP_CALCULATION:{ label: '🔢 IEP CALCULATING',     color: '#f59e0b' },
    BUFFER:         { label: '⏳ OPENING BUFFER',       color: '#00bcd4' },
    JUST_OPENED:    { label: '🔔 JUST OPENED',          color: '#00e676' },
    MARKET_OPEN:    { label: '✅ MARKET OPEN',          color: '#00e676' },
    CLOSED:         { label: '🌙 MARKET CLOSED',        color: '#475569' },
  }[ph] || { label: ph || '—', color: '#94a3b8' });

  const biasC = (bias) => ({
    CE: { bg:'rgba(0,230,118,0.07)',  border:'rgba(0,230,118,0.3)',  text:'#00e676', glow:'0 0 32px rgba(0,230,118,0.18)',  anim:'pmi-pulse-green 2s infinite' },
    PE: { bg:'rgba(255,23,68,0.07)', border:'rgba(255,23,68,0.3)',  text:'#ff1744', glow:'0 0 32px rgba(255,23,68,0.18)',  anim:'pmi-pulse-red 2s infinite' },
  }[bias] || { bg:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.1)', text:'#94a3b8', glow:'none', anim:'none' });

  const confClr = s => s >= 85 ? '#00e5ff' : s >= 70 ? '#00e676' : s >= 40 ? '#ffab00' : '#ff1744';

  const fp  = v => (!v && v !== 0) ? '—' : '₹' + Number(v).toLocaleString('en-IN');
  const fpct = v => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%';
  const fpts = v => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(1) + ' pts';

  const renderSkel = (h = 80) => (
    <div style={{ height: h, background: 'rgba(255,255,255,0.03)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', animation: 'pmi-shimmer 1.5s infinite' }} />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE SPOT PRICE & MAX PAIN GRAVITY BAR
  // ─────────────────────────────────────────────────────────────────────────

  const renderLiveSpotBar = () => {
    if (liveSpot <= 0) return null;
    const maxPainVal = entryData?.keyOILevels?.maxPain || entryData?.maxPain || 0;
    const currentSpot = liveSpot;
    
    let maxPainElement = null;
    if (maxPainVal > 0) {
      const distVal = maxPainVal - currentSpot;
      const absDist = Math.abs(distVal);
      const gravityDir = distVal > 0 ? '↑' : distVal < 0 ? '↓' : '•';
      const sign = distVal > 0 ? '+' : '';
      
      let color = '#00e676'; // green (>150 pts)
      let gravityLabel = 'clear direction possible';
      if (absDist <= 50) {
        color = '#ff1744'; // red (strong gravity)
        gravityLabel = 'strong gravity (avoid directional bets)';
      } else if (absDist <= 150) {
        color = '#ffab00'; // gold (moderate)
        gravityLabel = 'moderate gravity';
      }
      
      maxPainElement = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ color: '#94a3b8' }}>Max Pain: <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>₹{maxPainVal.toLocaleString('en-IN')}</strong></span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ color: '#94a3b8' }}>Distance: <strong style={{ color: color, fontFamily: 'monospace' }}>{sign}{distVal.toFixed(0)} pts</strong></span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ color: '#94a3b8' }}>Gravity: <strong style={{ color: color, fontSize: 13, fontFamily: 'monospace' }}>{gravityDir}</strong> <span style={{ fontSize: 9.5, color: '#64748b', marginLeft: 4 }}>({gravityLabel})</span></span>
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6, padding: '8px 16px', fontSize: 12,
        flexWrap: 'wrap', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveDot isLive={isLive} latency={latency} dataFreshness={dataFreshness} />
          <span style={{ color: '#64748b' }}>{cleanSym} LIVE SPOT:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: '#f1f5f9' }}>
            {fp(liveSpot)}
          </span>
        </div>
        {livePCR != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
            <span style={{ color: '#64748b', fontSize: 11 }}>
              PCR: <strong style={{ color: livePCR > 1.2 ? '#00e676' : livePCR < 0.8 ? '#ff1744' : '#ffab00' }}>
                {Number(livePCR).toFixed(2)}
              </strong>
            </span>
          </div>
        )}
        {maxPainElement}
      </div>
    );
  };

  const getLotSize = (sym) => {
    const s = String(sym || 'NIFTY').toUpperCase();
    if (s.includes('BANKNIFTY') || s.includes('NIFTY BANK') || s.includes('BANK')) return 15;
    if (s.includes('FINNIFTY') || s.includes('NIFTY FIN') || s.includes('FIN')) return 40;
    if (s.includes('MIDCPNIFTY') || s.includes('MIDCAP') || s.includes('MID')) return 75;
    return 50; // Nifty default
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPTION CARD RENDERER
  // ─────────────────────────────────────────────────────────────────────────

  const renderOCard = (card) => {
    if (!card) return null;
    const isC = card.type === 'CALL';
    const ac = isC ? '#00e676' : '#ff1744';
    return (
      <div className="pmi-opt-card" style={{ background: isC ? 'rgba(0,230,118,0.04)' : 'rgba(255,23,68,0.04)', border: `1px solid ${ac}33`, borderRadius: 10, padding: '20px', boxShadow: card.recommended ? `0 0 20px ${ac}18` : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, borderBottom: `1px solid ${ac}22`, paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ac, fontFamily: 'monospace' }}>{card.ticker}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{card.expiry}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: card.recommended ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)', color: card.recommended ? 'var(--gold)' : '#475569', border: `1px solid ${card.recommended ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}` }}>
              {card.recommended ? '⭐ RECOMMENDED' : 'ALTERNATIVE'}
            </span>
            <div style={{ fontSize: 11, color: '#64748b' }}>Conf: <strong style={{ color: confClr(card.confidence) }}>{card.confidence}%</strong></div>
          </div>
        </div>

        {/* Elevated Invalidation Warning Box */}
        <div style={{
          background: 'rgba(255,23,68,0.08)',
          border: '1px solid rgba(255,23,68,0.25)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 12,
          color: '#ff1744',
          fontWeight: 800,
          fontSize: 19,
          textAlign: 'center',
          letterSpacing: 0.5
        }}>
          ⚠️ IF {cleanSym} BREAKS {card.type === 'CALL' ? 'BELOW' : 'ABOVE'} ₹{card.sl?.price?.toLocaleString('en-IN')} → EXIT IMMEDIATELY
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>📍 ENTRY SPOT</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{fp(card.entry?.spotLevel)}</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>⏱ {card.entry?.time}</div>
          </div>
          {card.premium?.current ? (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>💰 OPTION PREMIUM</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: ac }}>₹{card.premium.current}</div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>SL @50%: ₹{card.premium.sl50pct}</div>
            </div>
          ) : <div />}
        </div>
        {(card.iv !== undefined || card.greeks !== undefined) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, background: 'rgba(0,0,0,0.18)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 11, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ color: '#cbd5e1' }}>
              IV: <span style={{ color: '#00e676', fontWeight: 700, fontFamily: 'monospace' }}>{card.iv?.toFixed(1)}%</span>
            </div>
            <div style={{ color: '#cbd5e1', textAlign: 'right' }}>
              Greeks: <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>Δ {card.greeks?.delta !== undefined ? card.greeks.delta.toFixed(2) : '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 6px' }}>|</span>
              <span style={{ color: '#ff1744', fontWeight: 700, fontFamily: 'monospace' }}>θ {card.greeks?.theta !== undefined ? (card.greeks.theta < 0 ? '-' : '') + '₹' + Math.abs(card.greeks.theta).toFixed(1) + '/day' : '—'}</span>
            </div>
          </div>
        )}

        {/* Position Sizing Calculator */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 12,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 800, color: 'var(--gold)' }}>🧮 POSITION SIZER</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Capital at Risk:</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 6, color: 'var(--gold)', fontSize: 10, fontWeight: 700 }}>₹</span>
                <input
                  type="number"
                  value={capitalAtRisk}
                  onChange={(e) => setCapitalAtRisk(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{
                    width: 75,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    color: 'var(--gold)',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    padding: '2px 4px 2px 14px',
                    textAlign: 'right',
                    fontSize: 11
                  }}
                />
              </div>
            </div>
          </div>
          {(() => {
            const prem = parseFloat(card.premium?.current || 0);
            if (!prem) return <div style={{ color: '#64748b', fontSize: 11 }}>Calculations pending...</div>;
            
            const lotSize = getLotSize(cleanSym);
            const riskPerUnit = prem * 0.5;
            const riskPerLot = lotSize * riskPerUnit;
            const maxLots = Math.floor(capitalAtRisk / riskPerLot);
            const totalUnits = maxLots * lotSize;
            const totalCost = totalUnits * prem;
            const actualRisk = totalUnits * riskPerUnit;
            const slTarget = prem - riskPerUnit;
            
            if (maxLots <= 0) {
              return (
                <div style={{ color: '#ff1744', fontSize: 11, fontWeight: 700 }}>
                  ⚠️ Risk budget too low. Min risk for 1 lot: ₹{riskPerLot.toFixed(0)}
                </div>
              );
            }
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#cbd5e1' }}>
                  Buy <strong style={{ color: '#00e676' }}>{maxLots} lot{maxLots > 1 ? 's' : ''} ({totalUnits} units)</strong> of {card.ticker} @ ₹{prem.toFixed(2)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 2 }}>
                  <span>Cost: <strong style={{ color: '#f1f5f9' }}>₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                  <span>SL Value: <strong style={{ color: '#ff1744' }}>₹{actualRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                  <span>SL Target: <strong style={{ color: '#ff1744' }}>₹{slTarget.toFixed(2)}</strong></span>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'rgba(255,23,68,0.05)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#ff4444', marginBottom: 3 }}>🛑 STOP LOSS</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#ff4444' }}>{fp(card.sl?.price)}</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>{card.sl?.reason}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(card.targets || []).map((t, ti) => (
              <div key={ti} style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.12)', borderRadius: 6, padding: '8px 10px', flex: 1 }}>
                <div style={{ fontSize: 9, color: '#00e676', marginBottom: 2 }}>🎯 T{ti + 1} ({t.rr})</div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#00e676' }}>{fp(t.price)}</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{t.reason}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', marginBottom: 10 }}>📌 {card.entry?.action}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 10 }}>
          <div style={{ color: '#64748b' }}>⏰ Exit by: <span style={{ color: '#ffab00' }}>{card.exitBy}</span></div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DECISION PANEL (live-connected, regime-driven, pulse-animated)
  // ─────────────────────────────────────────────────────────────────────────

    const renderPanelDecision = () => {
    // activeBias is regime-overridden during Windows A and C
    const bias  = activeBias;
    const score = entryData?.confidence ?? 0;
    const rec   = entryData?.recommendation || '';
    const bc    = biasC(bias);
    const cc    = bias === 'AVOID' ? '#94a3b8' : confClr(score);
    const spinnerOnly = loading && !entryData;

    const probEngine = entryData?.probabilityEngine || {};
    const prob = probEngine.probability ?? entryData?.probability ?? score;
    const isHighProb = probEngine.isHighProbSetup ?? false;
    const setup = probEngine.setup || null;

    const theme = bias === 'CE' 
      ? { color: '#00e676', bg: 'rgba(0,230,118,0.04)', border: 'rgba(0,230,118,0.25)', glow: '0 0 25px rgba(0,230,118,0.15)' }
      : bias === 'PE'
      ? { color: '#ff1744', bg: 'rgba(255,23,68,0.04)', border: 'rgba(255,23,68,0.25)', glow: '0 0 25px rgba(255,23,68,0.15)' }
      : { color: '#ffab00', bg: 'rgba(255,171,0,0.03)', border: 'rgba(255,171,0,0.15)', glow: 'none' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Live spot ticker bar ── */}
        {renderLiveSpotBar()}

        {/* ── Bias decision card (pulse animation target) ── */}
        <div
          ref={biasPanelRef}
          className="pmi-card"
          style={{
            background: bc.bg, border: `2px solid ${bc.border}`, borderRadius: 12,
            padding: '32px 24px', textAlign: 'center', boxShadow: bc.glow,
            position: 'relative', overflow: 'hidden', minHeight: 220,
            cursor: 'pointer', transition: 'border-color 0.15s ease',
          }}
          onMouseDown={triggerFocusPulse}
          onTouchStart={startTouchHold}
          onTouchEnd={stopTouchHold}
          onTouchCancel={stopTouchHold}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .04, fontSize: 220, fontWeight: 900, color: bc.text, userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>
            {bias || '?'}
          </div>
          {spinnerOnly ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(201,168,76,0.15)', borderTop: '3px solid var(--gold)', borderRadius: '50%', animation: 'pmi-spin 1s linear infinite' }} />
              <span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>COMPUTING BIAS SIGNAL...</span>
            </div>
          ) : error && !entryData ? (
            <div style={{ color: '#fca5a5' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <strong>Engine Error</strong><br />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{error}</span>
              <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>Available from 8:15 AM IST. Refresh to retry.</div>
            </div>
          ) : (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, color: bc.text, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 14 }}>⚡ PRE-TRADE DECISION</div>
              <div style={{ fontSize: 68, fontWeight: 900, color: bc.text, lineHeight: 1, marginBottom: 10, letterSpacing: -1 }}>
                {bias === 'CE' ? 'BUY CE' : bias === 'PE' ? 'BUY PE' : 'AVOID'}
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 22 }}>
                {bias === 'CE' ? '🟢 Bullish Bias — Call Option Strategy' 
                 : bias === 'PE' ? '🔴 Bearish Bias — Put Option Strategy' 
                 : rec ? `⚠️ ${rec}` : '⚠️ Stand Down — No clear directional edge'}
              </div>
              <div style={{ maxWidth: 420, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Confidence Score</span>
                  <span style={{ color: cc, fontWeight: 800 }}>{score}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg,${cc}99,${cc})`, borderRadius: 5, transition: 'width 1s ease' }} />
                </div>
              </div>
              {rec && <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: '#f1f5f9', background: 'rgba(255,255,255,0.05)', padding: '9px 18px', borderRadius: 6, display: 'inline-block' }}>{rec}</div>}
              {liveSpot > 0 && <div style={{ marginTop: 14, fontSize: 12, color: '#64748b' }}>{cleanSym} Spot: <strong style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{fp(liveSpot)}</strong></div>}
              {/* Click/Touch hint */}
              <div style={{ marginTop: 12, fontSize: 9, color: '#334155', letterSpacing: 1 }}>CLICK / TOUCH TO FOCUS</div>
            </div>
          )}
        </div>

        {/* ── Real-Time Probability Gauge & Setup Ticket Card ── */}
        {!spinnerOnly && !error && entryData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Circular Gauge Card */}
            <div style={{
              background: 'rgba(10,15,30,0.4)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                🧠 Real-Time Directional Probability
              </div>
              
              {/* SVG Circular Gauge */}
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 12 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background Circle */}
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    fill="none"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="8"
                  />
                  {/* Glowing Indicator Arc */}
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    fill="none"
                    stroke={theme.color}
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 58}`}
                    strokeDashoffset={`${2 * Math.PI * 58 * (1 - prob / 100)}`}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 1s ease-out',
                      filter: `drop-shadow(0 0 6px ${theme.color}aa)`,
                    }}
                  />
                </svg>
                {/* Centered Percentage Text */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: -1, textShadow: `0 0 8px ${theme.color}55` }}>
                    {prob}%
                  </span>
                  <span style={{ fontSize: 9, color: theme.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginTop: -2 }}>
                    {bias === 'AVOID' ? 'AVOID' : `${bias} Prob`}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 380, lineHeight: 1.4 }}>
                {bias === 'CE' && `🟢 The market shows a strong ${prob}% Bullish probability. Looking for Call buying setups.`}
                {bias === 'PE' && `🔴 The market shows a strong ${prob}% Bearish probability. Looking for Put buying setups.`}
                {bias === 'AVOID' && `⚠️ The probability of a successful directional trade is too low (${prob}%). Standing down to protect capital.`}
              </div>
            </div>

            {/* Execution Setup Ticket */}
            {isHighProb && setup ? (
              <div style={{
                background: theme.bg,
                border: `2px dashed ${theme.color}`,
                borderRadius: 12,
                padding: '20px',
                boxShadow: theme.glow,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 20, animation: prob >= 85 ? 'pmi-pulse-green 1.5s infinite' : 'pmi-spin 3s linear infinite' }}>
                    {prob >= 85 ? '🔥' : '🚀'}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: theme.color, letterSpacing: 0.5 }}>
                      {prob >= 85 ? 'EXECUTE — FULL POSITION SIZE AUTHORIZED' : 'EXECUTE — STANDARD POSITION SIZE AUTHORIZED'} ({prob}%)
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                      {prob >= 85 ? 'Maximum institutional confluences aligned. High-conviction entry authorized.' : 'Institutional confluences aligned. Safe standard-size entry authorized.'}
                    </div>
                  </div>
                </div>

                {/* Broker style trade ticket */}
                <div style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Option Contract</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                      {setup.optionName}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
                      <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Stop Loss</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ff1744', fontFamily: 'monospace' }}>
                        {fp(setup.stopLoss)}
                      </div>
                      <div style={{ fontSize: 8, color: '#ef4444', marginTop: 1 }}>-15% SL</div>
                    </div>
                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
                      <div style={{ fontSize: 9, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 2 }}>Entry Range</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', fontFamily: 'monospace' }}>
                        ₹{setup.entryRangeMin} - ₹{setup.entryRangeMax}
                      </div>
                      <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>LTP: {fp(setup.entryPrice)}</div>
                    </div>
                    <div style={{ padding: '2px 0' }}>
                      <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Target 1 / 2</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#00e676', fontFamily: 'monospace' }}>
                        ₹{setup.target1} / ₹{setup.target2}
                      </div>
                      <div style={{ fontSize: 8, color: '#10b981', marginTop: 1 }}>+20% / +40%</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                    <span>Risk-Reward: <strong style={{ color: '#cbd5e1' }}>{setup.rrRatio}</strong></span>
                    <span>Expiry: <strong style={{ color: '#cbd5e1' }}>{entryData.expiry || 'Current Expiry'}</strong></span>
                  </div>
                </div>
              </div>
            ) : prob >= 65 ? (
              <div style={{
                background: 'rgba(255,171,0,0.04)',
                border: '1px solid rgba(255,171,0,0.2)',
                borderRadius: 12,
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>👀</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5, marginBottom: 4 }}>
                  MONITOR SETUP — WAITING FOR CONFLUENCE ({prob}%)
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', maxWidth: 360, margin: '0 auto', lineHeight: 1.4 }}>
                  The current directional probability is **{prob}%**. Daily bias is established, but critical live execution triggers (such as VWAP cross or 5m trend confirmation) are still pending. Monitor the checklist below.
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🛡️</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.5, marginBottom: 4 }}>
                  STAND DOWN — NO DIRECTIONAL EDGE ({prob}%)
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 360, margin: '0 auto', lineHeight: 1.4 }}>
                  The current directional probability is **{prob}%**. There is no viable trade setup with a positive mathematical expectation. Stand down to preserve capital.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SMC Confluence Panel ── */}
        {!spinnerOnly && !error && entryData && <SMCPanel smc={entryData.smc} />}

        {/* ── Confluences Checklist Column Layout ── */}
        {!spinnerOnly && !error && entryData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Aligning Factors */}
            <div style={{
              background: 'rgba(0,230,118,0.01)',
              border: '1px solid rgba(0,230,118,0.08)',
              borderRadius: 10,
              padding: '12px 16px',
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 800, color: '#00e676', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                ✅ Aligning Confluences ({probEngine.aligningFactors?.length || 0})
              </h4>
              {probEngine.aligningFactors && probEngine.aligningFactors.length > 0 ? (
                probEngine.aligningFactors.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', fontSize: 11, color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ color: '#00e676' }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', padding: '8px 0' }}>No active confluences at this moment.</div>
              )}
            </div>

            {/* Missing / Blocker Factors */}
            <div style={{
              background: 'rgba(255,171,0,0.01)',
              border: '1px solid rgba(255,171,0,0.08)',
              borderRadius: 10,
              padding: '12px 16px',
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                ⚠️ Missing / Blocked Factors ({probEngine.missingConfluences?.length || 0})
              </h4>
              {probEngine.missingConfluences && probEngine.missingConfluences.length > 0 ? (
                probEngine.missingConfluences.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', fontSize: 11, color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ color: 'var(--gold)' }}>⚠</span>
                    <span>{f}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', padding: '8px 0' }}>No active blockers or missing factors detected.</div>
              )}
            </div>
          </div>
        )}

        {/* FII Segment Divergence Warning Badge */}
        {entryData?.fiiDivergence && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'pmi-fade-in 0.3s ease both'
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 13, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5 }}>FII Segment Divergence Detected</strong>
              <span style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
                {entryData.fiiDivergence.text}
              </span>
            </div>
          </div>
        )}

        {/* FII Segment Flow & Derivatives Positioning Card */}
        {entryData?.fiiDerivatives && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '16px 20px',
            animation: 'pmi-fade-in 0.3s ease both'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                FII Segment Flow & Derivatives Positioning
              </h3>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                background: entryData.fiiDerivatives.derivativesBias?.includes('BULLISH') ? 'rgba(0,230,118,0.1)' : entryData.fiiDerivatives.derivativesBias?.includes('BEARISH') ? 'rgba(255,23,68,0.1)' : 'rgba(255,255,255,0.06)',
                color: entryData.fiiDerivatives.derivativesBias?.includes('BULLISH') ? '#00e676' : entryData.fiiDerivatives.derivativesBias?.includes('BEARISH') ? '#ff1744' : '#94a3b8',
                border: `1px solid ${entryData.fiiDerivatives.derivativesBias?.includes('BULLISH') ? 'rgba(0,230,118,0.2)' : entryData.fiiDerivatives.derivativesBias?.includes('BEARISH') ? 'rgba(255,23,68,0.2)' : 'rgba(255,255,255,0.1)'}`
              }}>
                DERIVATIVES BIAS: {entryData.fiiDerivatives.derivativesBias}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {/* Cash Flow */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Cash Net Flow</div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: (entryData.fiiCashNet ?? 0) > 0 ? '#00e676' : (entryData.fiiCashNet ?? 0) < 0 ? '#ff1744' : '#f1f5f9'
                }}>
                  {(entryData.fiiCashNet ?? 0) > 0 ? '+' : ''}{(entryData.fiiCashNet ?? 0).toLocaleString('en-IN')} Cr
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>DII: {(entryData.diiCashNet ?? 0) > 0 ? '+' : ''}{(entryData.diiCashNet ?? 0).toLocaleString('en-IN')} Cr</div>
              </div>

              {/* Index Futures */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Index Futures Ratio</div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: entryData.fiiDerivatives.idxFutRatio > 1.1 ? '#00e676' : entryData.fiiDerivatives.idxFutRatio < 0.9 ? '#ff1744' : '#ffab00'
                }}>
                  {entryData.fiiDerivatives.idxFutRatio.toFixed(2)} x
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                  L/S: {entryData.fiiDerivatives.idxFutLong.toLocaleString()} / {entryData.fiiDerivatives.idxFutShort.toLocaleString()}
                </div>
              </div>

              {/* Stock Futures */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Stock Futures Net</div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: entryData.fiiDerivatives.stockFutNet > 0 ? '#00e676' : entryData.fiiDerivatives.stockFutNet < 0 ? '#ff1744' : '#f1f5f9'
                }}>
                  {entryData.fiiDerivatives.stockFutNet > 0 ? '+' : ''}{entryData.fiiDerivatives.stockFutNet.toLocaleString()} OI
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                  L/S: {entryData.fiiDerivatives.stockFutLong.toLocaleString()} / {entryData.fiiDerivatives.stockFutShort.toLocaleString()}
                </div>
              </div>

              {/* Index Options */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Index Options Net</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    color: entryData.fiiDerivatives.netCallOI > 0 ? '#00e676' : entryData.fiiDerivatives.netCallOI < 0 ? '#ff1744' : '#f1f5f9'
                  }}>
                    Calls: {entryData.fiiDerivatives.netCallOI > 0 ? '+' : ''}{entryData.fiiDerivatives.netCallOI.toLocaleString()}
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    color: entryData.fiiDerivatives.netPutOI > 0 ? '#ff1744' : entryData.fiiDerivatives.netPutOI < 0 ? '#00e676' : '#f1f5f9'
                  }}>
                    Puts: {entryData.fiiDerivatives.netPutOI > 0 ? '+' : ''}{entryData.fiiDerivatives.netPutOI.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7-Factor breakdown (21-Factor) */}
        {entryData?.factors?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>21-Factor Confidence Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entryData.factors.map((f, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div><div style={{ fontWeight: 600, color: '#e2e8f0' }}>{f.name}</div><div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{f.note}</div></div>
                  {(() => {
                    const maxPoints = parseInt(f.value.split('/')[1]) || 25;
                    const pct = (f.pts / maxPoints) * 100;
                    const scoreVal = f.score !== undefined ? f.score : parseFloat(f.value.split('/')[0]);
                    const barColor = scoreVal < 0 ? '#ff1744' : scoreVal > 0 ? '#00e676' : 'var(--gold)';
                    return (
                      <div style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute',
                          left: scoreVal >= 0 ? 0 : 'auto',
                          right: scoreVal < 0 ? 0 : 'auto',
                          width: `${Math.min(100, pct)}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: 3
                        }} />
                      </div>
                    );
                  })()}
                  {(() => {
                    const scoreVal = f.score !== undefined ? f.score : parseFloat(f.value.split('/')[0]);
                    const barColor = scoreVal < 0 ? '#ff1744' : scoreVal > 0 ? '#00e676' : 'var(--gold)';
                    return (
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', color: barColor, fontWeight: 700, fontSize: 12 }}>{f.value}</div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk flags */}
        {entryData?.riskFlags?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>⚠️ Risk Flags</h3>
            {entryData.riskFlags.map((flag, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 12px', background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${flag.color}`, borderRadius: '0 4px 4px 0', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: flag.color, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>[{flag.severity}]</span>
                <span style={{ color: '#cbd5e1' }}>{flag.text}</span>
              </div>
            ))}
          </div>
        )}
        {entryData?.warning && (
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#fbbf24', display: 'flex', gap: 10, alignItems: 'center' }}>
            ⚠ {entryData.warning}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
  // KEY OI STRIKE LEVELS PANEL
  // ─────────────────────────────────────────────────────────────────────────

  const renderPanelOIStrikeLevels = () => {
    if (loading && !entryData) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderSkel(200)}
          {renderSkel(150)}
        </div>
      );
    }
    if (error && !entryData) {
      return <div style={{ color: '#fca5a5', padding: 20, textAlign: 'center' }}>⚠️ {error}</div>;
    }
    
    const keyOI = entryData?.keyOILevels;
    if (!keyOI) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
          No options chain data available to build OI Strike levels.
        </div>
      );
    }

    const formatOI = val => {
      if (!val && val !== 0) return '—';
      if (val >= 100000) {
        return (val / 100000).toFixed(1) + ' L';
      }
      return val.toLocaleString('en-IN');
    };

    // Calculate maximum OI to scale bars defensively
    const maxCeOi = Math.max(...(keyOI.top3CallWall || []).map(w => w.ce_oi), 1);
    const maxPeOi = Math.max(...(keyOI.top3PutWall || []).map(w => w.pe_oi), 1);

    // Gathering levels for Left (Calls), Right (Puts), and Center (Spot/Max Pain)
    const leftLevels = [];
    const rightLevels = [];
    const centerLevels = [];

    const maxPainVal = keyOI.maxPain || entryData?.maxPain || 0;

    if (liveSpot > 0) {
      centerLevels.push({
        type: 'spot',
        price: liveSpot,
        label: '⚡ SPOT',
        color: '#ffffff',
        lineStyle: 'solid',
        lineWidth: 2.5,
        isSpot: true,
        labelY: 0,
        y: 0
      });
    }

    if (maxPainVal > 0) {
      centerLevels.push({
        type: 'maxpain',
        price: maxPainVal,
        label: '🟡 MAX PAIN',
        color: '#ffab00',
        lineStyle: 'dashed',
        lineWidth: 1.5,
        labelY: 0,
        y: 0
      });
    }

    (keyOI.top3CallWall || []).forEach((w, idx) => {
      leftLevels.push({
        type: 'call',
        price: w.strike,
        label: `🛑 Call Wall #${idx + 1}${idx === 0 ? ' (Resist)' : ''}`,
        color: idx === 0 ? '#ef4444' : idx === 1 ? '#f87171' : '#fca5a5',
        lineStyle: 'solid',
        lineWidth: idx === 0 ? 2 : 1,
        labelY: 0,
        y: 0
      });
    });

    (keyOI.top3PutWall || []).forEach((w, idx) => {
      rightLevels.push({
        type: 'put',
        price: w.strike,
        label: `🛡️ Put Wall #${idx + 1}${idx === 0 ? ' (Support)' : ''}`,
        color: idx === 0 ? '#22c55e' : idx === 1 ? '#4ade80' : '#86efac',
        lineStyle: 'solid',
        lineWidth: idx === 0 ? 2 : 1,
        labelY: 0,
        y: 0
      });
    });

    // We must find the absolute min and max prices to establish the Y scale
    const allPrices = [
      ...(liveSpot > 0 ? [liveSpot] : []),
      ...(maxPainVal > 0 ? [maxPainVal] : []),
      ...(keyOI.top3CallWall || []).map(w => w.strike),
      ...(keyOI.top3PutWall || []).map(w => w.strike)
    ];

    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const priceRange = maxP - minP || 100;
    const minPrice = minP - priceRange * 0.15;
    const maxPrice = maxP + priceRange * 0.15;

    const chartHeight = 360;
    const chartPadding = 35;

    const getP = (p) => chartPadding + (1 - (p - minPrice) / (maxPrice - minPrice)) * (chartHeight - 2 * chartPadding);

    // Initial label positions
    leftLevels.forEach(lvl => { lvl.y = getP(lvl.price); lvl.labelY = lvl.y; });
    rightLevels.forEach(lvl => { lvl.y = getP(lvl.price); lvl.labelY = lvl.y; });
    centerLevels.forEach(lvl => { lvl.y = getP(lvl.price); lvl.labelY = lvl.y; });

    // Spacing adjustment algorithm to prevent vertical overlap
    const adjustSpacing = (lvlList, minSpacing = 24) => {
      lvlList.sort((a, b) => a.y - b.y); // top to bottom
      for (let i = 1; i < lvlList.length; i++) {
        if (lvlList[i].labelY - lvlList[i-1].labelY < minSpacing) {
          lvlList[i].labelY = lvlList[i-1].labelY + minSpacing;
        }
      }
      for (let i = lvlList.length - 2; i >= 0; i--) {
        if (lvlList[i+1].labelY - lvlList[i].labelY < minSpacing) {
          lvlList[i].labelY = lvlList[i+1].labelY - minSpacing;
        }
      }
    };

    adjustSpacing(leftLevels, 24);
    adjustSpacing(rightLevels, 24);
    adjustSpacing(centerLevels, 28);

    const visualOIChart = (
      <div style={{
        background: 'rgba(15, 23, 42, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5 }}>⚡ VISUAL OI STRIKE LADDER</span>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>UPDATING LIVE</span>
        </div>
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg width="100%" height={chartHeight} viewBox={`0 0 800 ${chartHeight}`} style={{ minWidth: 600, display: 'block' }}>
            <defs>
              <filter id="spot-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="axis-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.01)" />
                <stop offset="20%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="80%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
              </linearGradient>
            </defs>

            {/* Central Ruler Axis */}
            <line x1={400} y1={chartPadding - 10} x2={400} y2={chartHeight - chartPadding + 10} stroke="url(#axis-gradient)" strokeWidth={2.5} />

            {/* Price Ruler ticks on the central line */}
            {Array.from({ length: 11 }).map((_, i) => {
              const yTick = chartPadding + (i / 10) * (chartHeight - 2 * chartPadding);
              return (
                <line key={i} x1={396} y1={yTick} x2={404} y2={yTick} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              );
            })}

            {/* Render CALL Walls (Left Column) */}
            {leftLevels.map((lvl, idx) => {
              const hasShift = Math.abs(lvl.labelY - lvl.y) > 1;
              return (
                <g key={`left-${idx}`}>
                  {/* Left horizontal indicator level line */}
                  <line
                    x1={100}
                    y1={lvl.y}
                    x2={400}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeWidth={lvl.lineWidth}
                    opacity={0.35}
                  />
                  {/* Diagonal / horizontal connection to shifted label badge */}
                  <line
                    x1={340}
                    y1={lvl.labelY}
                    x2={400}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeWidth={1}
                    strokeDasharray="2,2"
                    opacity={hasShift ? 0.6 : 0}
                  />
                  {/* Axis level tick pointer */}
                  <circle cx={400} cy={lvl.y} r={3.5} fill={lvl.color} />

                  {/* Left Column Label Badge */}
                  <g>
                    <rect
                      x={80}
                      y={lvl.labelY - 10}
                      width={260}
                      height={20}
                      rx={5}
                      fill="rgba(239, 68, 68, 0.05)"
                      stroke={lvl.color}
                      strokeWidth={1}
                      opacity={0.8}
                    />
                    <text
                      x={90}
                      y={lvl.labelY + 1}
                      fill="#cbd5e1"
                      fontSize={9.5}
                      fontWeight={600}
                      textAnchor="start"
                      alignmentBaseline="middle"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      {lvl.label}
                    </text>
                    <text
                      x={330}
                      y={lvl.labelY + 1}
                      fill={lvl.color}
                      fontSize={11}
                      fontWeight={800}
                      textAnchor="end"
                      alignmentBaseline="middle"
                      style={{ fontFamily: 'monospace' }}
                    >
                      ₹{lvl.price.toLocaleString('en-IN')}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Render PUT Walls (Right Column) */}
            {rightLevels.map((lvl, idx) => {
              const hasShift = Math.abs(lvl.labelY - lvl.y) > 1;
              return (
                <g key={`right-${idx}`}>
                  {/* Right horizontal indicator level line */}
                  <line
                    x1={400}
                    y1={lvl.y}
                    x2={700}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeWidth={lvl.lineWidth}
                    opacity={0.35}
                  />
                  {/* Diagonal / horizontal connection to shifted label badge */}
                  <line
                    x1={460}
                    y1={lvl.labelY}
                    x2={400}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeWidth={1}
                    strokeDasharray="2,2"
                    opacity={hasShift ? 0.6 : 0}
                  />
                  {/* Axis level tick pointer */}
                  <circle cx={400} cy={lvl.y} r={3.5} fill={lvl.color} />

                  {/* Right Column Label Badge */}
                  <g>
                    <rect
                      x={460}
                      y={lvl.labelY - 10}
                      width={260}
                      height={20}
                      rx={5}
                      fill="rgba(34, 197, 94, 0.05)"
                      stroke={lvl.color}
                      strokeWidth={1}
                      opacity={0.8}
                    />
                    <text
                      x={470}
                      y={lvl.labelY + 1}
                      fill="#cbd5e1"
                      fontSize={9.5}
                      fontWeight={600}
                      textAnchor="start"
                      alignmentBaseline="middle"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      {lvl.label}
                    </text>
                    <text
                      x={710}
                      y={lvl.labelY + 1}
                      fill={lvl.color}
                      fontSize={11}
                      fontWeight={800}
                      textAnchor="end"
                      alignmentBaseline="middle"
                      style={{ fontFamily: 'monospace' }}
                    >
                      ₹{lvl.price.toLocaleString('en-IN')}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Render Center Levels (Live Spot, Max Pain) */}
            {centerLevels.map((lvl, idx) => {
              const hasShift = Math.abs(lvl.labelY - lvl.y) > 1;
              if (lvl.isSpot) {
                return (
                  <g key={`center-${idx}`}>
                    {/* Live Spot Horizontal full-width glowing line */}
                    <line
                      x1={100}
                      y1={lvl.y}
                      x2={700}
                      y2={lvl.y}
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      opacity={0.9}
                      filter="url(#spot-glow)"
                    />
                    <line
                      x1={100}
                      y1={lvl.y}
                      x2={700}
                      y2={lvl.y}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />

                    {/* Central Glowing Pulsing Ring */}
                    <circle cx={400} cy={lvl.y} r={8} fill="rgba(255,255,255,0.3)" />
                    <circle cx={400} cy={lvl.y} r={4} fill="#ffffff" />

                    {/* Diagonal connections from left/right axis endpoints if shifted */}
                    {hasShift && (
                      <line x1={400} y1={lvl.labelY} x2={400} y2={lvl.y} stroke="#ffffff" strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />
                    )}

                    {/* Styled Center Spot Badge */}
                    <g>
                      <rect
                        x={290}
                        y={lvl.labelY - 13}
                        width={220}
                        height={26}
                        rx={13}
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        filter="url(#spot-glow)"
                      />
                      <rect
                        x={290}
                        y={lvl.labelY - 13}
                        width={220}
                        height={26}
                        rx={13}
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={400}
                        y={lvl.labelY + 1}
                        fill="#ffffff"
                        fontSize={11}
                        fontWeight={900}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        style={{ fontFamily: 'sans-serif', letterSpacing: '0.5px' }}
                      >
                        ⚡ SPOT: ₹{lvl.price.toLocaleString('en-IN')}
                      </text>
                    </g>
                  </g>
                );
              } else {
                // Max Pain Center Level
                return (
                  <g key={`center-${idx}`}>
                    {/* Max Pain full-width dotted line */}
                    <line
                      x1={120}
                      y1={lvl.y}
                      x2={680}
                      y2={lvl.y}
                      stroke={lvl.color}
                      strokeWidth={lvl.lineWidth}
                      strokeDasharray="4,4"
                      opacity={0.7}
                    />
                    <circle cx={400} cy={lvl.y} r={4} fill={lvl.color} />

                    {hasShift && (
                      <line x1={400} y1={lvl.labelY} x2={400} y2={lvl.y} stroke={lvl.color} strokeWidth={1} strokeDasharray="2,2" opacity={0.4} />
                    )}

                    {/* Styled Center Max Pain Badge */}
                    <g>
                      <rect
                        x={310}
                        y={lvl.labelY - 10}
                        width={180}
                        height={20}
                        rx={10}
                        fill="rgba(15, 23, 42, 0.9)"
                        stroke={lvl.color}
                        strokeWidth={1}
                        opacity={0.9}
                      />
                      <text
                        x={400}
                        y={lvl.labelY + 1}
                        fill={lvl.color}
                        fontSize={10}
                        fontWeight={800}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        style={{ fontFamily: 'sans-serif', letterSpacing: '0.5px' }}
                      >
                        🟡 MAX PAIN: ₹{lvl.price.toLocaleString('en-IN')}
                      </text>
                    </g>
                  </g>
                );
              }
            })}
          </svg>
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {renderLiveSpotBar()}
        {visualOIChart}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* CE Resistance Wall (Call Wall) */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(255,23,68,0.04)', borderBottom: '1px solid rgba(255,23,68,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ff1744' }}>🛑 CE Call Wall (Resistance)</span>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>CALL OI BUILDUP</span>
            </div>
            <div style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                    <th style={{ padding: '6px 0', fontWeight: 700 }}>STRIKE</th>
                    <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>CE OI</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, width: 100 }}>VOL WEIGHT</th>
                    <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>DISTANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {(keyOI.top3CallWall || []).map((w, idx) => {
                    const dist = w.strike - liveSpot;
                    const pct = (w.ce_oi / maxCeOi) * 100;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: idx === 0 ? '#ff1744' : '#cbd5e1' }}>
                        <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: idx === 0 ? 800 : 500 }}>
                          ₹{w.strike.toLocaleString('en-IN')}{idx === 0 ? ' (WALL)' : ''}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: idx === 0 ? 700 : 500 }}>
                          {formatOI(w.ce_oi)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ background: 'rgba(255,23,68,0.08)', height: 6, borderRadius: 3, width: '100%', overflow: 'hidden', display: 'inline-block' }}>
                            <div style={{ background: '#ff1744', height: '100%', width: `${pct}%`, borderRadius: 3 }} />
                          </div>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', color: dist >= 0 ? '#ff1744' : '#00e676' }}>
                          {dist >= 0 ? '+' : ''}{dist.toFixed(0)} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PE Support Wall (Put Wall) */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(0,230,118,0.04)', borderBottom: '1px solid rgba(0,230,118,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#00e676' }}>🛡️ PE Put Wall (Support)</span>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>PUT OI BUILDUP</span>
            </div>
            <div style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                    <th style={{ padding: '6px 0', fontWeight: 700 }}>STRIKE</th>
                    <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>PE OI</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, width: 100 }}>VOL WEIGHT</th>
                    <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>DISTANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {(keyOI.top3PutWall || []).map((w, idx) => {
                    const dist = w.strike - liveSpot;
                    const pct = (w.pe_oi / maxPeOi) * 100;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: idx === 0 ? '#00e676' : '#cbd5e1' }}>
                        <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: idx === 0 ? 800 : 500 }}>
                          ₹{w.strike.toLocaleString('en-IN')}{idx === 0 ? ' (WALL)' : ''}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: idx === 0 ? 700 : 500 }}>
                          {formatOI(w.pe_oi)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ background: 'rgba(0,230,118,0.08)', height: 6, borderRadius: 3, width: '100%', overflow: 'hidden', display: 'inline-block' }}>
                            <div style={{ background: '#00e676', height: '100%', width: `${pct}%`, borderRadius: 3 }} />
                          </div>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', color: dist >= 0 ? '#ff1744' : '#00e676' }}>
                          {dist >= 0 ? '+' : ''}{dist.toFixed(0)} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ATM Strike Level & PCR */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>ATM STRIKE LEVEL</span>
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc' }}>
              ₹{(keyOI.atmStrike || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>ATM CE OI</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#ff1744' }}>
                {formatOI(keyOI.atmCeOi)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>ATM PE OI</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#00e676' }}>
                {formatOI(keyOI.atmPeOi)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>ATM STRIKE PCR</span>
              <span style={{
                fontSize: 16,
                fontWeight: 900,
                fontFamily: 'monospace',
                color: keyOI.atmPcr > 1.2 ? '#00e676' : keyOI.atmPcr < 0.8 ? '#ff1744' : '#ffab00'
              }}>
                {keyOI.atmPcr}
              </span>
            </div>
          </div>
        </div>

        {/* Tactical Interpretation Card */}
        <div style={{
          background: 'rgba(201,168,76,0.05)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 12,
          padding: '20px',
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5 }}>
            💡 Institutional Tactical Interpretation
          </h4>
          <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>
            {(() => {
              const bias = activeBias;
              const atmPcr = keyOI.atmPcr;
              const topCall = keyOI.top3CallWall[0]?.strike;
              const topPut = keyOI.top3PutWall[0]?.strike;
              
              if (bias === 'CE') {
                return `The option chain demonstrates structural bullish strength. The Put Wall at ₹${topPut?.toLocaleString('en-IN')} acts as a solid institutional base. With ATM PCR at ${atmPcr}, puts are being aggressively written. If the spot pushes past the Call Wall at ₹${topCall?.toLocaleString('en-IN')}, a short-covering rally (gamma squeeze) is highly probable.`;
              } else if (bias === 'PE') {
                return `The option chain exhibits heavy bearish distribution. The Call Wall at ₹${topCall?.toLocaleString('en-IN')} stands as a major institutional ceiling. With ATM PCR at ${atmPcr}, call writing is dominant. A breakdown below the Put Wall at ₹${topPut?.toLocaleString('en-IN')} will trigger long-unwinding and accelerate the slide.`;
              } else {
                return `The options buildup is balanced and lacks clear directional conviction. The index is bounded between the Call Wall at ₹${topCall?.toLocaleString('en-IN')} (Resistance) and Put Wall at ₹${topPut?.toLocaleString('en-IN')} (Support). Stand down or trade range-bound strategies until PCR diverges.`;
              }
            })()}
          </p>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────────────────────────────────
  // GAP PANEL (live scan data)
  // ─────────────────────────────────────────────────────────────────────────

    const renderPanelGap = () => {
    if (loading && !scanData) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{renderSkel(130)}{renderSkel(90)}{renderSkel(90)}</div>;
    if (error && !scanData)   return <div style={{ color: '#fca5a5', padding: 20, textAlign: 'center' }}>⚠️ {error}</div>;
    if (!scanData) return null;
    const gap = scanData.nifty_gap;
    const dir = gap?.direction || 'FLAT_OPEN';
    const gc = dir === 'GAP_UP' ? '#00e676' : dir === 'GAP_DOWN' ? '#ff1744' : '#ffab00';
    const pl = phaseInfo(scanData.phase);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {renderLiveSpotBar()}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${pl.color}44`, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pl.color }}>{pl.label}</span>
            <span style={{ marginLeft: 12, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{scanData.ist_time} · {scanData.ist_date}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b', alignItems: 'center' }}>
            <LiveDot isLive={isLive} latency={latency} dataFreshness={dataFreshness} />
            {scanData.from_cache && <span style={{ color: '#ffab00' }}>📦 Cached</span>}
            {!scanData.iep_stability && <span style={{ color: '#ff1744' }}>⚡ IEP Fluctuating</span>}
            <span>{scanData.total_fo_stocks} F&O stocks</span>
          </div>
        </div>

        {/* Sector Pulse Horizontal Scroll Bar */}
        <div style={{
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--gold)',
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            paddingRight: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ fontSize: 11 }}>⚡</span> SECTOR PULSE
          </div>
          <div className="pmi-sector-scroll" style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            width: '100%',
            padding: '2px 0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {(() => {
              const friendlyName = {
                'BANK': 'Bank Nifty',
                'IT': 'Nifty IT',
                'FMCG': 'FMCG',
                'PHARMA': 'Pharma',
                'AUTO': 'Auto',
                'METAL': 'Metal',
                'ENERGY': 'Energy',
                'INFRA': 'Infra',
                'REALTY': 'Realty',
                'FINANCE': 'Fin Services'
              };

              const pulse = scanData.sectorPulse;
              if (!pulse || pulse.length === 0) {
                return Array(6).fill(0).map((_, i) => (
                  <div key={i} style={{
                    minWidth: 90,
                    height: 24,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)',
                      animation: 'pmi-shimmer 1.5s infinite'
                    }} />
                  </div>
                ));
              }

              return pulse.map((sec, idx) => {
                const isPos = sec.change_pct > 0.1;
                const isNeg = sec.change_pct < -0.1;
                const color = isPos ? '#00e676' : isNeg ? '#ff1744' : '#ffab00';
                const bg = isPos ? 'rgba(0,230,118,0.06)' : isNeg ? 'rgba(255,23,68,0.06)' : 'rgba(255,171,0,0.06)';
                const border = isPos ? 'rgba(0,230,118,0.2)' : isNeg ? 'rgba(255,23,68,0.2)' : 'rgba(255,171,0,0.2)';
                const arrow = isPos ? '▲' : isNeg ? '▼' : '▶';

                return (
                  <div
                    key={idx}
                    className="pmi-sector-pill"
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: 16,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    <span style={{ color: '#fff', opacity: 0.85 }}>{friendlyName[sec.sector] || sec.sector}</span>
                    <span style={{ fontSize: 9 }}>{arrow}</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {sec.change_pct > 0 ? '+' : ''}{sec.change_pct.toFixed(2)}%
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="pmi-card" style={{ background: `${gc}0D`, border: `1px solid ${gc}44`, borderRadius: 12, padding: '24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                {dir === 'GAP_UP' ? '📈' : dir === 'GAP_DOWN' ? '📉' : '➡️'} NIFTY OPENING GAP
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: gc, lineHeight: 1, fontFamily: 'monospace' }}>{fpct(gap?.gap_pct)}</div>
              <div style={{ fontSize: 18, color: '#94a3b8', fontFamily: 'monospace', marginTop: 4 }}>{fpts(gap?.gap_pts)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Direction</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: gc }}>{dir.replace(/_/g, ' ')}</div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>Prev Close: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{fp(gap?.prev_close)}</span></div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                IEP / LTP: <span style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>
                  {liveSpot > 0 ? fp(liveSpot) : fp(gap?.iep)}
                </span>
                {liveSpot > 0 && <span style={{ fontSize: 9, color: '#00e676', marginLeft: 4 }}>●LIVE</span>}
              </div>
            </div>
          </div>
          {gap?.strategy_hint && <div style={{ marginTop: 16, padding: '11px 14px', background: 'rgba(0,0,0,0.25)', borderLeft: `3px solid ${gc}`, borderRadius: '0 6px 6px 0', fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>💡 {gap.strategy_hint}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {[
            { label: 'Pre-Open Imbalance', value: `${scanData.preopen_imbalance > 0 ? '+' : ''}${scanData.preopen_imbalance}%`, color: scanData.preopen_imbalance > 0 ? '#00e676' : scanData.preopen_imbalance < 0 ? '#ff1744' : '#ffab00', desc: 'Buy vs Sell pressure' },
            { label: 'IEP Tick History', value: (scanData.niftyIepHistory || []).slice(-3).map(v => v?.toFixed(0)).join(' → ') || '—', color: '#94a3b8', desc: 'Last 3 IEP ticks' },
            { label: 'Vol vs 5D Avg', value: `${((scanData.vol_vs_avg_ratio || 1) * 100).toFixed(0)}%`, color: (scanData.vol_vs_avg_ratio || 1) >= 1 ? '#00e676' : '#ff1744', desc: 'Pre-open volume' },
            { label: 'IEP Stability', value: scanData.iep_stability ? '✅ Stable' : '⚡ Fluctuating', color: scanData.iep_stability ? '#00e676' : '#ff1744', desc: 'Last 3 ticks direction' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ENTRY PANEL (regime-aware card ordering)
  // ─────────────────────────────────────────────────────────────────────────

  const renderPanelEntry = () => {
    if (loading && !entryData) return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{renderSkel(250)}{renderSkel(250)}</div>;
    if (error && !entryData)   return <div style={{ color: '#fca5a5', padding: '24px 20px', textAlign: 'center', background: 'rgba(255,23,68,0.04)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: 8 }}>⚠️ {error}<br /><span style={{ fontSize: 12, color: '#64748b', display: 'block', marginTop: 8 }}>Options entry available from 8:15 AM IST</span></div>;
    if (!entryData) return null;
    const { ce, pe } = entryData;

    // Regime controls card display order
    const regimeBias = activeBias;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {renderLiveSpotBar()}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'AI Recommended', value: regimeBias === 'CE' ? '🟢 BUY CE' : regimeBias === 'PE' ? '🔴 BUY PE' : '⚠️ STAND DOWN', color: regimeBias === 'CE' ? '#00e676' : regimeBias === 'PE' ? '#ff1744' : '#ffab00' },
            { label: 'Live Spot', value: liveSpot > 0 ? fp(liveSpot) : '—', color: '#f8fafc' },
            { label: 'PCR (OI)', value: livePCR ? Number(livePCR).toFixed(2) : '—', color: livePCR > 1.2 ? '#00e676' : livePCR < 0.8 ? '#ff1744' : '#ffab00' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 16px' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
          <LiveDot isLive={isLive} latency={latency} dataFreshness={dataFreshness} />
        </div>

        {(regimeBias !== 'CE' && regimeBias !== 'PE') && (
          <div style={{ padding: '20px 24px', background: 'rgba(255,171,0,0.06)', border: '1px dashed rgba(255,171,0,0.3)', borderRadius: 10, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: '#ffab00', fontWeight: 700, display: 'block', marginBottom: 8 }}>⚠️ Stand Down. Capital preservation active.</span>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              Pre-market composite confidence score is below threshold or event risk is active. AVOID entry at open.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
          {/* Regime-aware ordering: PE first when regime=PE, CE first when regime=CE */}
          {regimeBias === 'PE' ? (
            <>{renderOCard(pe)}{renderOCard(ce)}</>
          ) : (
            <>{renderOCard(ce)}{renderOCard(pe)}</>
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MOVERS PANEL
  // ─────────────────────────────────────────────────────────────────────────

  const renderPanelMovers = () => {
    if (loading && !scanData) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{renderSkel(220)}{renderSkel(220)}</div>;
    if (error && !scanData)   return <div style={{ color: '#fca5a5', padding: 20, textAlign: 'center' }}>⚠️ {error}</div>;
    if (!scanData) return null;
    const ups = scanData.gap_ups || [];
    const downs = scanData.gap_downs || [];

    const renderMRow = (m, isUp, key) => {
      const ac = isUp ? '#00e676' : '#ff1744';
      return (
        <div key={key} className="pmi-mrow" style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 80px', gap: 8, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12, cursor: 'default' }}>
          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{m.symbol}</span>
          <div>
            <div style={{ background: 'rgba(255,255,255,0.05)', height: 5, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${m.buy_pressure_pct}%`, height: '100%', background: ac, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Buy {m.buy_pressure_pct}%</div>
          </div>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: ac }}>{fpct(m.gap_pct)}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{fp(m.iep)}</span>
        </div>
      );
    };

    const renderColHeader = (label, count, color) => (
      <div style={{ padding: '13px 16px', background: `${color}0A`, borderBottom: `1px solid ${color}22` }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color, textTransform: 'uppercase' }}>{label} ({count})</h3>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>IEP gap {label.includes('Up') ? '≥ +1.5%' : '≤ -1.5%'} vs prev close</div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {renderLiveSpotBar()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            {renderColHeader('📈 Gap Up Stocks', ups.length, '#00e676')}
            {ups.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No significant gap-ups</div>
              : <><div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 80px', gap: 8, padding: '5px 14px', fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span>Symbol</span><span>Order Book</span><span style={{ textAlign: 'right' }}>Gap %</span><span style={{ textAlign: 'right' }}>IEP</span></div>{ups.slice(0, 15).map((m, i) => renderMRow(m, true, i))}</>
            }
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            {renderColHeader('📉 Gap Down Stocks', downs.length, '#ff1744')}
            {downs.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No significant gap-downs</div>
              : <><div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 80px', gap: 8, padding: '5px 14px', fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span>Symbol</span><span>Order Book</span><span style={{ textAlign: 'right' }}>Gap %</span><span style={{ textAlign: 'right' }}>IEP</span></div>{downs.slice(0, 15).map((m, i) => renderMRow(m, false, i))}</>
            }
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const phase = scanData?.phase;
  const pl = phaseInfo(phase);

  return (
    <div id="pre-market-intel-engine" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', padding: '20px 16px', fontFamily: 'var(--font-mono)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20, borderBottom: '2px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Pre-Market Intel
            <span style={{ fontSize: 10, background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--gold)', fontWeight: 700, letterSpacing: 1 }}>DECISION ENGINE</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
            Answers: <strong style={{ color: '#94a3b8' }}>Should I buy CE or PE today — and exactly how?</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Regime Status Pill */}
          <RegimePill regime={regime} regimeWindow={regimeWindow} regimeOverride={regimeOverride} />
          {phase && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: `${pl.color}15`, color: pl.color, border: `1px solid ${pl.color}44` }}>{pl.label}</span>}
          {['ORDER_ENTRY', 'IEP_CALCULATION'].includes(phase) && (
            <span
              className="pmi-iep-live"
              style={{
                fontSize: 10,
                fontWeight: 900,
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(0, 230, 118, 0.1)',
                color: '#00e676',
                border: '1px solid rgba(0, 230, 118, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', display: 'inline-block' }} />
              IEP LIVE (5s)
            </span>
          )}
          <LiveDot isLive={isLive} latency={latency} dataFreshness={dataFreshness} />
          {countdown != null && <span style={{ fontSize: 11, color: '#475569' }}>Auto-refresh: <strong style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{countdown}s</strong></span>}
          {lastFetched && <span style={{ fontSize: 11, color: '#475569' }}>{lastFetched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          <button
            id="pmi-refresh-btn"
            onClick={refresh}
            disabled={loading}
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.5 : 1, transition: 'all 0.2s' }}
          >
            {loading ? <span style={{ width: 12, height: 12, border: '2px solid rgba(201,168,76,0.3)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'pmi-spin 0.8s linear infinite', display: 'inline-block' }} /> : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Regime Override Banner — appears automatically when bearish breakdown or intraday shift detected */}
      <OverrideBanner
        visible={regimeOverride || (intradayShift?.active === true)}
        reason={intradayShift?.reason}
        regime={activeBias}
        windowLabel={regimeWindow}
      />

            <PreMarketTimer />

      {/* 9:20 AM Confirmation Check & Checklist */}
      {(() => {
        const phase = scanData?.phase;
        const niftyGap = scanData?.nifty_gap;
        const show920 = (phase === 'JUST_OPENED' || phase === 'MARKET_OPEN') && niftyGap;
        if (!show920) return null;

        const spotVal = liveSpot || niftyGap.iep;
        const iepVal  = niftyGap.iep;
        const gapFilled = Math.abs(spotVal - iepVal) < 30;

        const vixVal = entryData?.vix ?? (() => {
          const f = entryData?.factors?.find(fact => fact.name === 'India VIX');
          return f ? parseFloat(f.note.replace(/[^\d.]/g, '')) : 15.0;
        })();

        const vwapPos = entryData?.vwapPosition ?? (() => {
          const f = entryData?.factors?.find(fact => fact.name === 'VWAP Position');
          return f?.note?.includes('Above') ? 'above' : f?.note?.includes('Below') ? 'below' : 'near';
        })();

        const trendConfirmed = entryData?.trend15m?.confirmed ?? false;
        const isGapAligned = activeBias === 'CE' ? niftyGap.gap_pct >= 0.3 : activeBias === 'PE' ? niftyGap.gap_pct <= -0.3 : false;
        const isPcrAligned = activeBias === 'CE' ? (livePCR != null && livePCR >= 0.95) : activeBias === 'PE' ? (livePCR != null && livePCR <= 1.05) : false;
        const isVwapAligned = activeBias === 'CE' ? (vwapPos === 'above') : activeBias === 'PE' ? (vwapPos === 'below') : false;

        return (
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '24px',
            marginBottom: '20px',
            animation: 'pmi-fade-in 0.3s ease both'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5 }}>🎯 9:20 AM Confirmation Check</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 12, color: '#94a3b8' }}>
              Verify pre-market daily bias before entering opening trades
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Pre-Open IEP</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
                  ₹{niftyGap.prev_close > 0 ? Math.round(niftyGap.iep).toLocaleString('en-IN') : '—'}
                </div>
              </div>
              <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Current Spot</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
                  ₹{Math.round(liveSpot).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{
                padding: '14px 16px',
                background: gapFilled ? 'rgba(249,115,22,0.04)' : 'rgba(0,230,118,0.04)',
                border: gapFilled ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(0,230,118,0.2)',
                borderRadius: 8
              }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Gap Status</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: gapFilled ? '#ff9100' : '#00e676' }}>
                  {gapFilled ? '⚠️ Gap Filling' : '✓ Gap Holding'}
                </div>
              </div>
            </div>

            {/* Trade Checklist */}
            <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '18px 20px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>✅ Entry Checklist</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  {
                    check: isGapAligned,
                    label: `Gap ≥ 0.3% in direction of bias (Current: ${niftyGap.gap_pct > 0 ? '+' : ''}${niftyGap.gap_pct.toFixed(2)}% vs ${activeBias} Bias)`
                  },
                  {
                    check: vixVal < 18,
                    label: `India VIX < 18 for safe option buying (Current VIX: ${vixVal.toFixed(1)})`
                  },
                  {
                    check: isPcrAligned,
                    label: `PCR aligns with bias (Current PCR: ${livePCR != null ? livePCR.toFixed(2) : '—'} vs ${activeBias} Bias)`
                  },
                  {
                    check: isVwapAligned,
                    label: `Spot price position vs VWAP (Current: Spot is ${vwapPos.toUpperCase()} VWAP)`
                  },
                  {
                    check: trendConfirmed,
                    label: `First 15m candle / trend direction confirmed (Current: ${entryData?.trend15m?.label || 'Sideways'} / ${trendConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'})`
                  }
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                    <span style={{
                      color: item.check ? '#00e676' : '#ff1744',
                      fontWeight: 'bold',
                      fontSize: '15px'
                    }}>{item.check ? '✓' : '✗'}</span>
                    <span style={{ color: item.check ? '#cbd5e1' : '#64748b' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { id: 'decision',       label: '🎯 CE/PE Decision' },
          { id: 'oiStrikeLevels', label: '🔑 OI Wall Panel' },
          { id: 'strategyEngine', label: '⏱ 15-Min Strategy Engine' },
          { id: 'gap',            label: '📊 Global Cues / IN India Pulse' },
          { id: 'entry',          label: '⚡ AI Trading Plan' },
          { id: 'movers',         label: '🚀 Pre-Open Movers' },
        ].map(p => (
          <button
            key={p.id}
            id={`pmi-panel-${p.id}`}
            className="pmi-nav-btn"
            onClick={() => setActivePanel(p.id)}
            style={{
              background: activePanel === p.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${activePanel === p.id ? 'var(--gold)' : 'rgba(255,255,255,0.06)'}`,
              color: activePanel === p.id ? 'var(--gold)' : '#94a3b8',
              padding: '9px 16px', borderRadius: 6, cursor: 'pointer',
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ minHeight: 400 }}>
        {activePanel === 'decision'       && renderPanelDecision()}
        {activePanel === 'oiStrikeLevels' && renderPanelOIStrikeLevels()}
        {activePanel === 'strategyEngine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {renderLiveSpotBar()}
            <StrategyEngineDashboard
              spotPrice={liveSpot || entryData?.spot || 24200}
              activeBias={activeBias}
              regimeWindow={regimeWindow}
              regimeOverride={regimeOverride}
              intradayShift={intradayShift}
            />
          </div>
        )}
        {activePanel === 'gap'            && renderPanelGap()}
        {activePanel === 'entry'          && renderPanelEntry()}
        {activePanel === 'movers'         && renderPanelMovers()}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 40, paddingTop: 14, fontSize: 10, color: '#334155', flexWrap: 'wrap', gap: 6 }}>
        <span>Pre-Market Decision Engine v4.0 · Live SSE Stream · Regime Switcher Active</span>
        <span>SEBI compliance · For educational purposes only</span>
      </div>
    </div>
  );
}
