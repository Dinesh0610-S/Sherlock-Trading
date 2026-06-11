import React, { useState, useEffect } from 'react';

const UnusualOIDetector = ({ symbol }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    const sym = cleanSymbol === '^NSEI' ? 'NIFTY' : cleanSymbol === '^NSEBANK' ? 'BANKNIFTY' : cleanSymbol;

    fetch(`/api/nse/option-chain/unusual-oi?symbol=${sym}`)
      .then(r => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Unusual OI:', err);
        setLoading(false);
      });
  }, [symbol]);

  if (loading) {
    return (
      <div className="unusual-oi-panel loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, color: 'var(--text-muted)' }}>
        <span>Scanning option chain for unusual activity...</span>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="unusual-oi-panel error-state" style={{ padding: 20, color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, background: 'rgba(239,68,68,0.02)' }}>
        <span>Unusual OI scanner unavailable for {symbol}</span>
      </div>
    );
  }

  return (
    <div className="unusual-oi-panel">
      <div className="unusual-header">
        <h4 className="panel-title">🔥 Unusual OI Activity</h4>
        <span className="unusual-count">
          {data.unusualCount} unusual out of {data.totalScanned} scanned
        </span>
      </div>

      {data.unusual.length === 0 ? (
        <div className="no-unusual">
          ✅ No unusual OI activity detected. All strikes within normal range.
        </div>
      ) : (
        <div className="unusual-list" style={{ maxHeight: 290, overflowY: 'auto' }}>
          {data.unusual.map((item, i) => (
            <div key={i} className={`unusual-item ${item.significance.toLowerCase()} ${item.type.toLowerCase()}`}>
              <div className="unusual-top">
                <span className={`type-badge ${item.type.toLowerCase()}`}>
                  {item.type}
                </span>
                <span className="unusual-strike">
                  ₹{item.strike.toLocaleString('en-IN')}
                </span>
                <span className={`significance-badge ${item.significance.toLowerCase()}`}>
                  {item.significance}
                </span>
                <span className="z-score">
                  Z: {item.zScore}σ
                </span>
              </div>
              <div className="unusual-stats">
                <span>
                  OI Change:{' '}
                  <strong className={item.oiChange > 0 ? 'green' : 'red'}>
                    {item.oiChange > 0 ? '+' : ''}
                    {(item.oiChange / 1000).toFixed(0)}K
                  </strong>
                </span>
                <span>LTP: ₹{item.ltp}</span>
                <span>IV: {item.iv?.toFixed(1)}%</span>
                <span>Vol: {(item.volume / 1000).toFixed(0)}K</span>
              </div>
              <div className={`buildup-tag ${item.buildupType.toLowerCase().replace('_', '-')}`}>
                {item.buildupType.replace(/_/g, ' ')}
              </div>
              <p className="unusual-interpretation">
                {item.interpretation}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UnusualOIDetector;
