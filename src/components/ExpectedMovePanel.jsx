import React, { useState, useEffect } from 'react';

const ExpectedMovePanel = ({ symbol, expiry }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    const sym = cleanSymbol === '^NSEI' ? 'NIFTY' : cleanSymbol === '^NSEBANK' ? 'BANKNIFTY' : cleanSymbol;

    const url = `/api/nse/option-chain/expected-move?symbol=${sym}&expiry=${expiry || ''}`;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Expected Move:', err);
        setLoading(false);
      });
  }, [symbol, expiry]);

  if (loading) {
    return (
      <div className="expected-move-panel loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-muted)' }}>
        <span>Calculating Expected Move Boundaries...</span>
      </div>
    );
  }

  if (!data || data.error || !data.expectedMove) {
    return (
      <div className="expected-move-panel error-state" style={{ padding: 20, color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, background: 'rgba(239,68,68,0.02)' }}>
        <span>Expected Move calculation unavailable for {symbol}</span>
      </div>
    );
  }

  const { spot, dte, atmIV, expectedMove, straddlePrice, implication } = data;
  const em = expectedMove;

  return (
    <div className="expected-move-panel">
      <h4 className="panel-title">📐 Expected Move — {data.expiry}</h4>

      <div className="em-summary-cards">
        <div className="em-card">
          <label>ATM IV</label>
          <span className="value">{atmIV}%</span>
        </div>
        <div className="em-card">
          <label>DTE</label>
          <span className="value">{dte} days</span>
        </div>
        <div className="em-card">
          <label>ATM Straddle</label>
          <span className="value">₹{straddlePrice}</span>
        </div>
        <div className="em-card">
          <label>Daily EM</label>
          <span className="value">±{em.daily.points} pts</span>
          <sub>({em.daily.pct}%)</sub>
        </div>
      </div>

      {/* Visual expected move range */}
      <div className="em-range-visual">
        <div className="em-range-title">Expected Range by Expiry</div>

        {/* Range bar visual */}
        <div className="em-range-bar-container" style={{ margin: '14px 0', padding: '0 10px' }}>
          <div className="em-range-zones" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>-2σ</span>
            <span>-1σ</span>
            <span style={{ color: 'var(--gold)' }}>Spot</span>
            <span>+1σ</span>
            <span>+2σ</span>
          </div>
          <div className="em-range-track" style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative' }}>
            {/* 2SD highlight */}
            <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, bottom: 0, background: 'rgba(239,68,68,0.15)', borderRadius: 4 }} />
            {/* 1SD highlight */}
            <div style={{ position: 'absolute', left: '30%', right: '30%', top: 0, bottom: 0, background: 'rgba(34,197,94,0.18)', borderRadius: 4 }} />
            {/* Spot marker */}
            <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, background: 'var(--gold)', transform: 'translateX(-50%)' }} />
          </div>
        </div>

        {/* Level display */}
        <div className="em-levels-grid">
          <div className="em-level">
            <label>2σ Upper (95%)</label>
            <span className="value green">
              ₹{em.twoSD.upper.toLocaleString('en-IN')}
            </span>
            <sub>+{em.twoSD.points} pts</sub>
          </div>
          <div className="em-level">
            <label>1σ Upper (68%)</label>
            <span className="value green">
              ₹{em.oneSD.upper.toLocaleString('en-IN')}
            </span>
            <sub>+{em.oneSD.points} pts</sub>
          </div>
          <div className="em-level current">
            <label>SPOT</label>
            <span className="value amber" style={{ color: 'var(--gold)' }}>
              ₹{spot.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="em-level">
            <label>1σ Lower (68%)</label>
            <span className="value red">
              ₹{em.oneSD.lower.toLocaleString('en-IN')}
            </span>
            <sub>-{em.oneSD.points} pts</sub>
          </div>
          <div className="em-level">
            <label>2σ Lower (95%)</label>
            <span className="value red">
              ₹{em.twoSD.lower.toLocaleString('en-IN')}
            </span>
            <sub>-{em.twoSD.points} pts</sub>
          </div>
        </div>
      </div>

      {/* Straddle pricing */}
      <div className={`straddle-pricing ${implication.includes('OVERPRICED') ? 'overpriced' : 'fair'}`}>
        <span>💡 {implication}</span>
      </div>
    </div>
  );
};

export default ExpectedMovePanel;
