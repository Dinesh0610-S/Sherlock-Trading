import React, { useState, useEffect } from 'react';

const MultiExpiryComparison = ({ symbol, selectedExpiry, setSelectedExpiry }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    const sym = cleanSymbol === '^NSEI' ? 'NIFTY' : cleanSymbol === '^NSEBANK' ? 'BANKNIFTY' : cleanSymbol;

    fetch(`/api/nse/option-chain/multi-expiry?symbol=${sym}`)
      .then(r => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Multi-Expiry Comparison:', err);
        setLoading(false);
      });
  }, [symbol]);

  if (loading) {
    return (
      <div className="multi-expiry-panel loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-muted)' }}>
        <span>Analyzing multiple expiry dates...</span>
      </div>
    );
  }

  if (!data || data.error || !data.comparison || data.comparison.length === 0) {
    return (
      <div className="multi-expiry-panel error-state" style={{ padding: 20, color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, background: 'rgba(239,68,68,0.02)' }}>
        <span>Multi-expiry data unavailable for {symbol}</span>
      </div>
    );
  }

  return (
    <div className="multi-expiry-panel">
      <h4 className="panel-title">📅 Multi-Expiry Comparison</h4>

      <div style={{ overflowX: 'auto' }}>
        <table className="multi-expiry-table">
          <thead>
            <tr>
              <th>EXPIRY</th>
              <th>DTE</th>
              <th>PCR</th>
              <th>MAX PAIN</th>
              <th>ATM IV</th>
              <th>STRADDLE</th>
              <th>EXP MOVE</th>
              <th>TOTAL OI</th>
              <th>ROLLOVER</th>
            </tr>
          </thead>
          <tbody>
            {data.comparison.map((exp, i) => {
              // Rollover % = this expiry OI / total OI
              const totalAllOI = data.comparison.reduce((s, e) => s + e.totalOI, 0);
              const rolloverPct = totalAllOI > 0 ? (exp.totalOI / totalAllOI * 100).toFixed(1) : 0;
              const isCurrentSelected = selectedExpiry === exp.expiry || (!selectedExpiry && i === 0);

              return (
                <tr
                  key={exp.expiry}
                  className={`${i === 0 ? 'current-expiry' : ''} ${isCurrentSelected ? 'selected-row' : ''}`}
                  onClick={() => setSelectedExpiry(exp.expiry)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="expiry-cell">
                    {exp.expiry}
                    {i === 0 && (
                      <span className="current-tag" style={{ marginLeft: 6, fontSize: 8, background: 'rgba(245,166,35,0.15)', color: '#f5a623', padding: '1px 4px', borderRadius: 2 }}>
                        FRONT
                      </span>
                    )}
                  </td>
                  <td className="mono">{exp.dte}d</td>
                  <td className={exp.pcr > 1.2 ? 'green' : exp.pcr < 0.8 ? 'red' : 'amber'}>
                    {exp.pcr}
                  </td>
                  <td className="amber mono">₹{exp.maxPain.toLocaleString('en-IN')}</td>
                  <td className={exp.atmIV > 20 ? 'red' : exp.atmIV < 12 ? 'green' : 'amber'}>
                    {exp.atmIV}%
                  </td>
                  <td className="mono">₹{exp.straddlePrice}</td>
                  <td className="mono">±{exp.expectedMove} pts</td>
                  <td className="mono">{(exp.totalOI / 1000).toFixed(0)}K</td>
                  <td>
                    <div className="rollover-bar-mini" style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, display: 'inline-flex', verticalAlign: 'middle', marginRight: 6, overflow: 'hidden' }}>
                      <div
                        className="rollover-fill"
                        style={{ width: `${rolloverPct}%`, height: '100%', background: 'var(--gold)' }}
                      />
                    </div>
                    <span className="rollover-pct" style={{ fontSize: 10 }}>{rolloverPct}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Term structure chart */}
      <div className="term-structure">
        <h5>IV Term Structure</h5>
        <div className="term-bars">
          {data.comparison.map((exp, i) => (
            <div key={exp.expiry} className="term-bar-item">
              <div
                className="term-bar"
                style={{
                  height: `${Math.min(exp.atmIV * 3, 100)}px`,
                  background: i === 0 ? '#f5a623' : exp.atmIV > data.comparison[0].atmIV ? '#ff4444' : '#00ff88'
                }}
                title={`${exp.expiry}: ${exp.atmIV}% IV`}
              />
              <span className="term-label">{exp.dte}d</span>
              <span className="term-iv">{exp.atmIV}%</span>
            </div>
          ))}
        </div>
        <div className="term-note" style={{ marginTop: 10, fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)' }}>
          {data.comparison[0]?.atmIV > (data.comparison[1]?.atmIV || 0)
            ? '⚠ Inverted term structure — near expiry IV higher than far (risk of short-term volatility spike)'
            : '✅ Normal term structure — near expiry IV lower than far (stable volatility conditions)'}
        </div>
      </div>
    </div>
  );
};

export default MultiExpiryComparison;
