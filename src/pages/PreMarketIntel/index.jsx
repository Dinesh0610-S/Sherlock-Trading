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

const OverrideBanner = ({ visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      background: 'rgba(255,23,68,0.06)',
      border: '1px solid rgba(255,23,68,0.4)',
      borderRadius: 6, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 16, fontSize: 12, color: '#ff6b6b',
      fontWeight: 600, animation: 'pmi-fade-in 0.3s ease both',
    }}>
      <span style={{ fontSize: 16 }}>⚡</span>
      <span>
        <strong style={{ color: '#ff1744' }}>REGIME OVERRIDE ACTIVE</strong>
        {' '}— Bearish Breakdown Detected during 09:15–09:30 window.
        Target automatically shifted to <strong>PUT (PE)</strong>.
        Opening candle low breached + significant PUT OI spike.
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE TICK INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

const LiveDot = ({ isLive }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 10, color: isLive ? '#00e676' : '#475569',
    fontWeight: 700, letterSpacing: 1,
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: isLive ? '#00e676' : '#475569',
      boxShadow: isLive ? '0 0 8px #00e676' : 'none',
      display: 'inline-block',
    }} />
    {isLive ? 'LIVE' : 'CONNECTING'}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PreMarketIntel({ selectedAsset: propSelectedAsset }) {
  const [persistedSymbol] = usePersistedState('symbol', '^NSEI');
  const selectedAsset = propSelectedAsset || persistedSymbol;
  const [activePanel, setActivePanel] = React.useState('decision');

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
    tick, isLive,
    scanData, entryData,
    loading, error, lastFetched, countdown,
    regime, regimeWindow, regimeOverride, activeBias,
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
  // OPTION CARD RENDERER
  // ─────────────────────────────────────────────────────────────────────────

  const renderOCard = (card) => {
    if (!card) return null;
    const isC = card.type === 'CALL';
    const ac = isC ? '#00e676' : '#ff1744';
    return (
      <div className="pmi-opt-card" style={{ background: isC ? 'rgba(0,230,118,0.04)' : 'rgba(255,23,68,0.04)', border: `1px solid ${ac}33`, borderRadius: 10, padding: '20px', boxShadow: card.recommended ? `0 0 20px ${ac}18` : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: `1px solid ${ac}22`, paddingBottom: 12 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
          <div style={{ color: '#64748b' }}>🔴 Invalidate: <span style={{ color: '#fca5a5' }}>{card.invalidation}</span></div>
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
    const cc    = confClr(score);
    const spinnerOnly = loading && !entryData;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Live spot ticker bar ── */}
        {liveSpot > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, padding: '8px 16px', fontSize: 12,
          }}>
            <LiveDot isLive={isLive} />
            <span style={{ color: '#64748b' }}>{cleanSym} LIVE SPOT:</span>
            <span style={{
              fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
              color: '#f1f5f9',
            }}>
              {fp(liveSpot)}
            </span>
            {livePCR != null && (
              <span style={{ color: '#64748b', fontSize: 11 }}>
                PCR: <strong style={{ color: livePCR > 1.2 ? '#00e676' : livePCR < 0.8 ? '#ff1744' : '#ffab00' }}>
                  {Number(livePCR).toFixed(2)}
                </strong>
              </span>
            )}
          </div>
        )}

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
                {bias === 'CE' ? 'BUY CE' : bias === 'PE' ? 'BUY PE' : '—'}
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 22 }}>
                {bias === 'CE' ? '🟢 Bullish Bias — Call Option Strategy' : bias === 'PE' ? '🔴 Bearish Bias — Put Option Strategy' : 'Computing directional signal...'}
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

        {/* Recommended option card — regime-aware */}
        {entryData && (bias === 'CE' || bias === 'PE') && (
          <div style={{ maxWidth: 500, margin: '0 auto', width: '100%', animation: 'pmi-fade-in 0.3s ease both' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, textAlign: 'center' }}>
              ⭐ RECOMMENDED OPTION {regimeWindow !== 'NORMAL' ? `[REGIME: ${bias} · ${regimeWindow}]` : ''}
            </div>
            {renderOCard(bias === 'CE' ? entryData.ce : entryData.pe)}
          </div>
        )}

        {/* 7-Factor breakdown */}
        {entryData?.factors?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>7-Factor Confidence Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entryData.factors.map((f, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div><div style={{ fontWeight: 600, color: '#e2e8f0' }}>{f.name}</div><div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{f.note}</div></div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (f.pts / 25) * 100)}%`, height: '100%', background: 'var(--gold)', borderRadius: 3 }} />
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>{f.value}</div>
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
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${pl.color}44`, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pl.color }}>{pl.label}</span>
            <span style={{ marginLeft: 12, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{scanData.ist_time} · {scanData.ist_date}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b', alignItems: 'center' }}>
            <LiveDot isLive={isLive} />
            {scanData.from_cache && <span style={{ color: '#ffab00' }}>📦 Cached</span>}
            {!scanData.iep_stability && <span style={{ color: '#ff1744' }}>⚡ IEP Fluctuating</span>}
            <span>{scanData.total_fo_stocks} F&O stocks</span>
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
          <LiveDot isLive={isLive} />
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
          <LiveDot isLive={isLive} />
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

      {/* Regime Override Banner — appears automatically when bearish breakdown detected */}
      <OverrideBanner visible={regimeOverride} />

      <PreMarketTimer />

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { id: 'decision',       label: '🎯 CE/PE Decision' },
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
        {activePanel === 'strategyEngine' && (
          <StrategyEngineDashboard
            spotPrice={liveSpot || entryData?.spot || 24200}
            activeBias={activeBias}
            regimeWindow={regimeWindow}
            regimeOverride={regimeOverride}
          />
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
