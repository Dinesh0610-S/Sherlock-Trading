import React, { useState, useEffect, useRef } from 'react';

// Memoized individual metric card component
const MetricCard = React.memo(({
  label,
  value,
  subRowLeft,
  lastUpdated,
  isStaleThreshold = 3000,
  flashClass = '',
  infoTooltip = ''
}) => {
  const [age, setAge] = useState(lastUpdated ? Date.now() - lastUpdated : 999999);

  // Recalculate age every 100ms
  useEffect(() => {
    const updateAge = () => {
      setAge(lastUpdated ? Date.now() - lastUpdated : 999999);
    };
    updateAge();
    const timer = setInterval(updateAge, 100);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const isStale = age >= isStaleThreshold;
  const dot = age < 1000 ? '🟢'   // fresh
            : age < 3000 ? '🟡'   // aging  
            : '🔴';                // stale

  const agoText = lastUpdated && lastUpdated > 0
    ? `Updated: ${(age / 1000).toFixed(1)}s ago`
    : 'Waiting...';

  return (
    <div className={`m-card ${flashClass}`} title={infoTooltip} style={{ position: 'relative' }}>
      <div className="m-label-row">
        <span>{label}</span>
        <span style={{ cursor: 'help' }} title={lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Never updated'}>
          {dot}
        </span>
      </div>
      <div className="m-value font-mono">
        {value}
      </div>
      <div className="m-sub-row">
        {subRowLeft}
        <span className="time-stamp" style={{ fontSize: 9.5, opacity: 0.8 }}>{agoText}</span>
      </div>
      {isStale && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: '#ef4444',
          color: '#fff',
          fontSize: 8,
          padding: '1px 3px',
          borderRadius: 2,
          fontWeight: 700
        }}>
          STALE
        </span>
      )}
    </div>
  );
});

function PriceDisplay({ value, prefix = '₹', minimumFractionDigits = 2 }) {
  if (value === null || value === undefined) {
    return <span className="skeleton-pulse" style={{ display: 'inline-block', width: '80px', height: '1.1em', verticalAlign: 'middle' }} />;
  }
  return (
    <span>
      {prefix}{value.toLocaleString('en-IN', { minimumFractionDigits, maximumFractionDigits: minimumFractionDigits })}
    </span>
  );
}

export default function MetricGrid({
  ltp,
  prevClose,
  dayHigh,
  dayLow,
  pcrOi,
  pcrVol,
  vwap,
  vwapValid,
  fairValue,
  dte,
  riskFreeRate,
  maxPain,
  timestamps = {}, // object holding lastUpdated timestamps for each metric from LiveDataEngine
  activeSymbol = 'NIFTY', // default
}) {
  // Flash animation trigger via useRef comparison
  const prevLtpRef = useRef(ltp);
  const flashClass = ltp > prevLtpRef.current ? 'flash-green' 
                   : ltp < prevLtpRef.current ? 'flash-red' : '';
  if (ltp !== prevLtpRef.current) {
    prevLtpRef.current = ltp;
  }

  const changeVal = (ltp !== null && prevClose !== null) ? ltp - prevClose : null;
  const changePct = (prevClose !== null && prevClose > 0 && changeVal !== null) ? (changeVal / prevClose) * 100 : null;

  const isSensex = activeSymbol === 'SENSEX';

  // PCR logic tags
  const getPcrOiTag = () => {
    if (!pcrOi) return { text: 'NO DATA', color: '#94a3b8' };
    if (pcrOi > 1.3) return { text: 'OVERSOLD — Contrarian Bullish', color: '#10b981' };
    if (pcrOi >= 0.8) return { text: 'NEUTRAL ZONE', color: '#94a3b8' };
    return { text: 'OVERBOUGHT — Contrarian Bearish', color: '#ef4444' };
  };

  const getPcrVolTag = () => {
    if (!pcrVol) return { text: 'NO DATA', color: '#94a3b8' };
    if (pcrVol > 1.3) return { text: 'Volume Oversold (Bullish)', color: '#10b981' };
    if (pcrVol >= 0.8) return { text: 'Volume Neutral', color: '#94a3b8' };
    return { text: 'Volume Overbought (Bearish)', color: '#ef4444' };
  };

  const pcrOiTag = getPcrOiTag();
  const pcrVolTag = getPcrVolTag();

  // Extreme alert class helpers
  const getPcrAlertClass = (pcr) => {
    if (pcr === null || pcr === undefined) return '';
    if (pcr > 1.3) return 'extreme-alert-green';
    if (pcr < 0.6) return 'extreme-alert-red';
    return '';
  };

  return (
    <div className="metric-row">
      {/* 1. LTP */}
      <MetricCard
        label={isSensex ? 'BSE Sensex LTP' : 'LTP'}
        value={<PriceDisplay value={ltp} />}
        subRowLeft={
          changeVal !== null && changePct !== null ? (
            <span style={{ color: changeVal >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
              {changeVal >= 0 ? '▲' : '▼'} {changeVal >= 0 ? '+' : ''}{changeVal.toFixed(2)} ({changePct.toFixed(2)}%)
            </span>
          ) : (
            <span className="skeleton-pulse" style={{ display: 'inline-block', width: '50px', height: '1em' }} />
          )
        }
        lastUpdated={timestamps.ltp}
        flashClass={flashClass}
        isStaleThreshold={30000}
      />

      {/* 2. PCR (OI) */}
      <MetricCard
        label={isSensex ? 'BSE Sensex PCR (OI)' : 'PCR (OI)'}
        value={
          pcrOi !== null ? (
            <span className={isSensex ? '' : getPcrAlertClass(pcrOi)}>
              {pcrOi.toFixed(2)}
              {!isSensex && pcrOi > 1.3 && <span style={{ fontSize: 9, marginLeft: 4 }}>🟢</span>}
              {!isSensex && pcrOi < 0.6 && <span style={{ fontSize: 9, marginLeft: 4 }}>🔴</span>}
            </span>
          ) : <PriceDisplay value={pcrOi} prefix="" />
        }
        subRowLeft={
          pcrOi !== null ? (
            <span style={{ color: isSensex ? '#cbd5e1' : pcrOiTag.color, fontSize: 9, fontWeight: 700 }}>
              {isSensex ? 'BSE Sensex Options' : pcrOiTag.text}
            </span>
          ) : (
            <span className="skeleton-pulse" style={{ display: 'inline-block', width: '50px', height: '1em' }} />
          )
        }
        lastUpdated={timestamps.oi}
        isStaleThreshold={30000}
      />

      {/* 3. PCR (VOL) */}
      <MetricCard
        label={isSensex ? 'BSE Sensex PCR (Vol)' : 'PCR (Vol)'}
        value={
          pcrVol !== null ? (
            <span className={isSensex ? '' : getPcrAlertClass(pcrVol)}>
              {pcrVol.toFixed(2)}
              {!isSensex && pcrVol > 1.3 && <span style={{ fontSize: 9, marginLeft: 4 }}>🟢</span>}
              {!isSensex && pcrVol < 0.6 && <span style={{ fontSize: 9, marginLeft: 4 }}>🔴</span>}
            </span>
          ) : <PriceDisplay value={pcrVol} prefix="" />
        }
        subRowLeft={
          pcrVol !== null ? (
            <span style={{ color: isSensex ? '#cbd5e1' : pcrVolTag.color, fontSize: 9, fontWeight: 700 }}>
              {isSensex ? 'BSE Sensex Options' : pcrVolTag.text}
            </span>
          ) : (
            <span className="skeleton-pulse" style={{ display: 'inline-block', width: '50px', height: '1em' }} />
          )
        }
        lastUpdated={timestamps.pcr}
        isStaleThreshold={30000}
      />

      {/* 4. VWAP */}
      <MetricCard
        label={isSensex ? 'BSE Sensex VWAP' : 'VWAP'}
        value={<PriceDisplay value={vwapValid && vwap ? vwap : null} />}
        subRowLeft={
          vwapValid && vwap !== null ? (
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: 9.5 }}>
              ✓ LIVE VWAP
            </span>
          ) : (
            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 9.5 }}>
              {vwapValid ? 'Calculating...' : 'Insufficient tick data'}
            </span>
          )
        }
        lastUpdated={timestamps.vwap}
        isStaleThreshold={30000}
      />

      {/* 5. Fair Value */}
      <MetricCard
        label={isSensex ? 'BSE Sensex Fair Value' : 'Fair Value'}
        value={<PriceDisplay value={fairValue} />}
        subRowLeft={
          dte !== null ? (
            <span style={{ color: '#94a3b8', display: 'inline-block', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              DTE: {dte} | R: ${(riskFreeRate * 100).toFixed(1)}%
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>[missing: DTE]</span>
          )
        }
        lastUpdated={timestamps.checklist} // derived/reference update timeline
        isStaleThreshold={30000} // reference updates every 30s
        infoTooltip="Formula: Spot + (Spot * Rate * DTE/365) - Div"
      />

      {/* 6. Max Pain Strike */}
      <MetricCard
        label={isSensex ? 'BSE Sensex Max Pain' : 'Max Pain Strike'}
        value={<PriceDisplay value={maxPain} minimumFractionDigits={0} />}
        subRowLeft={
          ltp && maxPain ? (
            <span style={{ color: '#cbd5e1' }}>
              Diff: {(maxPain - ltp) > 0 ? '+' : ''}${(maxPain - ltp).toFixed(0)}
            </span>
          ) : ''
        }
        lastUpdated={timestamps.pcr}
        isStaleThreshold={30000}
      />
    </div>
  );
}
