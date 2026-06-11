import React from 'react';

const GreeksDisplay = ({ strikewise, spot, expiry }) => {
  // Find ATM and nearby strikes
  if (!strikewise || strikewise.length === 0) return null;
  const atm = strikewise.find(s => s.isATM);
  const spotPrice = spot || atm?.strike || 24000;

  // Check if Greeks available from NSE
  const hasGreeks = atm && (atm.ce.delta !== null || atm.pe.delta !== null);

  // If NSE doesn't provide Greeks, calculate approximations
  const calculateApproxGreeks = (strike, type, ltp, iv, currentSpot, dte) => {
    // Basic defaults if parameters are missing or zero
    const impliedIv = iv && iv > 0 ? iv : 15;
    const daysToExpiry = dte && dte > 0 ? dte : 7;
    const S = currentSpot || strike;
    const K = strike;

    const T = Math.max(daysToExpiry, 1) / 365;
    const r = 0.065; // RBI repo rate
    const sigma = impliedIv / 100;

    // Black-Scholes d1 and d2
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    // Normal CDF approximation
    const N = (x) => {
      const t = 1 / (1 + 0.2316419 * Math.abs(x));
      const d = 0.3989423 * Math.exp((-x * x) / 2);
      let n = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
      return x > 0 ? 1 - n : n;
    };

    const delta = type === 'CE' ? N(d1) : N(d1) - 1;
    const gamma = Math.exp((-d1 * d1) / 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
    const theta = (-(S * sigma * Math.exp((-d1 * d1) / 2)) / (2 * Math.sqrt(T) * Math.sqrt(2 * Math.PI)) - r * K * Math.exp(-r * T) * (type === 'CE' ? N(d2) : -N(-d2))) / 365;
    const vega = (S * Math.sqrt(T) * Math.exp((-d1 * d1) / 2)) / Math.sqrt(2 * Math.PI) / 100;

    return {
      delta: +delta.toFixed(4),
      gamma: +gamma.toFixed(6),
      theta: +theta.toFixed(4),
      vega: +vega.toFixed(4)
    };
  };

  // Calculate DTE from expiry string
  const getDTE = (expiryStr) => {
    try {
      if (!expiryStr) return 7;
      const exp = new Date(expiryStr);
      const now = new Date();
      // Set hours to zero for accurate day difference
      exp.setHours(0,0,0,0);
      now.setHours(0,0,0,0);
      const diff = (exp - now) / (1000 * 60 * 60 * 24);
      return Math.max(1, Math.round(diff));
    } catch { return 7; }
  };

  const dte = getDTE(expiry);

  // Show top 5 strikes centered on ATM
  const atmIdx = strikewise.findIndex(s => s.isATM);
  const centerIdx = atmIdx >= 0 ? atmIdx : Math.floor(strikewise.length / 2);
  const displayStrikes = strikewise.slice(
    Math.max(0, centerIdx - 2),
    Math.min(strikewise.length, centerIdx + 3)
  );

  return (
    <div className="greeks-panel">
      <div className="greeks-header">
        <h4 className="panel-title">Δ Greeks Dashboard</h4>
        <span className="dte-badge">
          {dte} days to expiry
        </span>
        {!hasGreeks && (
          <span className="approx-badge">
            ~ Calculated (NSE not providing)
          </span>
        )}
      </div>

      <table className="greeks-table">
        <thead>
          <tr>
            <th>STRIKE</th>
            <th colSpan={4} className="ce-header">— CALL (CE) —</th>
            <th colSpan={4} className="pe-header">— PUT (PE) —</th>
          </tr>
          <tr>
            <th></th>
            <th>Δ Delta</th>
            <th>Γ Gamma</th>
            <th>Θ Theta</th>
            <th>ν Vega</th>
            <th>Δ Delta</th>
            <th>Γ Gamma</th>
            <th>Θ Theta</th>
            <th>ν Vega</th>
          </tr>
        </thead>
        <tbody>
          {displayStrikes.map(s => {
            const ceGreeks = (s.ce.delta !== null && s.ce.delta !== undefined)
              ? s.ce
              : calculateApproxGreeks(
                  s.strike, 'CE', s.ce.ltp,
                  s.ce.iv || 15, spotPrice, dte
                ) || s.ce;
            const peGreeks = (s.pe.delta !== null && s.pe.delta !== undefined)
              ? s.pe
              : calculateApproxGreeks(
                  s.strike, 'PE', s.pe.ltp,
                  s.pe.iv || 15, spotPrice, dte
                ) || s.pe;

            return (
              <tr key={s.strike} className={s.isATM ? 'atm-row' : ''}>
                <td className="strike-cell">
                  {s.strike.toLocaleString('en-IN')}
                  {s.isATM && <span className="atm-tag">ATM</span>}
                </td>
                {/* CE Greeks */}
                <td className={`delta ${(ceGreeks.delta || 0) > 0.5 ? 'high' : ''}`}>
                  {ceGreeks.delta?.toFixed(3) ?? '—'}
                </td>
                <td>{ceGreeks.gamma?.toFixed(5) ?? '—'}</td>
                <td className="theta red">
                  {ceGreeks.theta?.toFixed(3) ?? '—'}
                </td>
                <td className="vega">
                  {ceGreeks.vega?.toFixed(3) ?? '—'}
                </td>
                {/* PE Greeks */}
                <td className={`delta ${Math.abs(peGreeks.delta || 0) > 0.5 ? 'high' : ''}`}>
                  {peGreeks.delta?.toFixed(3) ?? '—'}
                </td>
                <td>{peGreeks.gamma?.toFixed(5) ?? '—'}</td>
                <td className="theta red">
                  {peGreeks.theta?.toFixed(3) ?? '—'}
                </td>
                <td className="vega">
                  {peGreeks.vega?.toFixed(3) ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Greeks explanation */}
      <div className="greeks-legend">
        {[
          { symbol: 'Δ', name: 'Delta', desc: 'Price sensitivity — change in premium per ₹1 spot change' },
          { symbol: 'Γ', name: 'Gamma', desc: 'Delta sensitivity — acceleration/rate of delta change' },
          { symbol: 'Θ', name: 'Theta', desc: 'Time decay — premium lost per day held' },
          { symbol: 'ν', name: 'Vega', desc: 'IV sensitivity — change in premium per 1% change in IV' }
        ].map(g => (
          <div key={g.symbol} className="greek-legend-item">
            <span className="greek-sym">{g.symbol} {g.name}</span>
            <span className="greek-desc">{g.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GreeksDisplay;
