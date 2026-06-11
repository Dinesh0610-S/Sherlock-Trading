import React, { useState, useEffect } from 'react';

const IVRankPanel = ({ symbol }) => {
  const [ivData, setIvData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Convert symbol format to clean index name
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    const sym = cleanSymbol === '^NSEI' ? 'NIFTY' : cleanSymbol === '^NSEBANK' ? 'BANKNIFTY' : cleanSymbol;

    fetch(`/api/nse/option-chain/iv-rank?symbol=${sym}`)
      .then(r => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then(data => {
        setIvData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching IV Rank:', err);
        setLoading(false);
      });
  }, [symbol]);

  if (loading) {
    return (
      <div className="iv-rank-panel loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-muted)' }}>
        <span>Loading Volatility Analytics...</span>
      </div>
    );
  }

  if (!ivData || ivData.error) {
    return (
      <div className="iv-rank-panel error-state" style={{ padding: 20, color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, background: 'rgba(239,68,68,0.02)' }}>
        <span>Volatility data unavailable for {symbol}</span>
      </div>
    );
  }

  const { currentIV, ivRank, ivPercentile, yearHigh, yearLow, interpretation } = ivData;

  return (
    <div className="iv-rank-panel">
      <h4 className="panel-title">📊 IV Rank & Percentile</h4>

      <div className="iv-cards">
        <div className="iv-card">
          <label>CURRENT IV</label>
          <span className="value" style={{ color: interpretation.color }}>
            {currentIV}%
          </span>
        </div>
        <div className="iv-card highlight">
          <label>IV RANK</label>
          <span className="value" style={{ color: interpretation.color }}>
            {ivRank}%
          </span>
          <sub>52-week range</sub>
        </div>
        <div className="iv-card">
          <label>IV PERCENTILE</label>
          <span className="value" style={{ color: interpretation.color }}>
            {ivPercentile}%
          </span>
          <sub>of days below</sub>
        </div>
        <div className="iv-card">
          <label>52W RANGE</label>
          <span className="value">{yearLow}% — {yearHigh}%</span>
        </div>
      </div>

      {/* IV Rank gauge */}
      <div className="iv-gauge-wrapper">
        <div className="iv-gauge-track">
          <div className="iv-gauge-zones">
            <span className="zone cheap">Cheap</span>
            <span className="zone neutral">Neutral</span>
            <span className="zone expensive">Expensive</span>
          </div>
          <div className="iv-gauge-bar">
            <div
              className="iv-gauge-fill"
              style={{
                width: `${Math.min(ivRank, 100)}%`,
                background: interpretation.color
              }}
            />
            <div
              className="iv-gauge-marker"
              style={{ left: `${Math.min(ivRank, 100)}%` }}
            />
          </div>
          <div className="iv-gauge-labels">
            <span>0</span>
            <span>20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Trading implication */}
      <div className="iv-interpretation" style={{ borderColor: interpretation.color }}>
        <span className="iv-label" style={{ color: interpretation.color }}>
          {interpretation.label}
        </span>
        <p className="iv-action">{interpretation.action}</p>
        <p className="iv-strategy">
          💡 Strategy: {interpretation.strategy}
        </p>
      </div>
    </div>
  );
};

export default IVRankPanel;
