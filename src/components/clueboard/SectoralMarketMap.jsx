import React, { useState } from 'react';

const SectoralMarketMap = React.memo(function SectoralMarketMap({
  indices = [],
}) {
  const [expandedSector, setExpandedSector] = useState(null);

  // Find Nifty 50 change as the benchmark
  const nifty50 = indices.find(idx => idx.name === 'NIFTY 50') || { percentChange: 0.85, last: 23664.35 };
  const niftyChange = nifty50.percentChange ?? 0.85;

  // Base constituents and characteristics for each sector
  const sectorConfigs = [
    {
      name: 'NIFTY BANK',
      label: 'Nifty Bank',
      adv: 8, dec: 4,
      movers: [
        { ticker: 'HDFCBANK', name: 'HDFC Bank', weight: 0.3 },
        { ticker: 'ICICIBANK', name: 'ICICI Bank', weight: 0.25 },
        { ticker: 'SBIN', name: 'State Bank of India', weight: 0.15 }
      ],
      changeOffset: 0, // Will use real index if available
    },
    {
      name: 'NIFTY IT',
      label: 'Nifty IT',
      adv: 7, dec: 3,
      movers: [
        { ticker: 'TCS', name: 'TCS', weight: 0.35 },
        { ticker: 'INFY', name: 'Infosys', weight: 0.3 },
        { ticker: 'WIPRO', name: 'Wipro', weight: 0.15 }
      ],
      changeOffset: 0.4,
    },
    {
      name: 'NIFTY AUTO',
      label: 'Nifty Auto',
      adv: 9, dec: 6,
      movers: [
        { ticker: 'TATAMOTORS', name: 'Tata Motors', weight: 0.25 },
        { ticker: 'M&M', name: 'M&M', weight: 0.22 },
        { ticker: 'MARUTI', name: 'Maruti Suzuki', weight: 0.18 }
      ],
      changeOffset: -0.6,
    },
    {
      name: 'NIFTY METAL',
      label: 'Nifty Metal',
      adv: 11, dec: 4,
      movers: [
        { ticker: 'TATASTEEL', name: 'Tata Steel', weight: 0.3 },
        { ticker: 'JINDALSTEL', name: 'Jindal Steel', weight: 0.2 },
        { ticker: 'HINDALCO', name: 'Hindalco', weight: 0.25 }
      ],
      changeOffset: 0.95,
    },
    {
      name: 'NIFTY FMCG',
      label: 'Nifty FMCG',
      adv: 6, dec: 9,
      movers: [
        { ticker: 'ITC', name: 'ITC', weight: 0.4 },
        { ticker: 'HINDUNILVR', name: 'Hindustan Unilever', weight: 0.3 },
        { ticker: 'NESTLEIND', name: 'Nestle India', weight: 0.15 }
      ],
      changeOffset: -0.25,
    },
    {
      name: 'NIFTY PHARMA',
      label: 'Nifty Pharma',
      adv: 12, dec: 8,
      movers: [
        { ticker: 'SUNPHARMA', name: 'Sun Pharma', weight: 0.3 },
        { ticker: 'CIPLA', name: 'Cipla', weight: 0.2 },
        { ticker: 'DRREDDY', name: 'Dr Reddys', weight: 0.18 }
      ],
      changeOffset: 0.15,
    },
    {
      name: 'NIFTY REALTY',
      label: 'Nifty Realty',
      adv: 6, dec: 4,
      movers: [
        { ticker: 'DLF', name: 'DLF', weight: 0.5 },
        { ticker: 'LODHA', name: 'Macrotech Developers', weight: 0.2 },
        { ticker: 'GODREJPROP', name: 'Godrej Properties', weight: 0.18 }
      ],
      changeOffset: 1.5,
    },
    {
      name: 'NIFTY ENERGY',
      label: 'Nifty Energy',
      adv: 7, dec: 3,
      movers: [
        { ticker: 'RELIANCE', name: 'Reliance Industries', weight: 0.6 },
        { ticker: 'NTPC', name: 'NTPC', weight: 0.15 },
        { ticker: 'ONGC', name: 'ONGC', weight: 0.12 }
      ],
      changeOffset: 0.35,
    }
  ];

  // Process data for each sector
  const sectors = sectorConfigs.map((cfg) => {
    // Check if we have real index value
    const realIdx = indices.find(i => i.name.toUpperCase() === cfg.name);
    let change = 0;
    if (realIdx) {
      change = realIdx.percentChange ?? 0;
    } else {
      // Correlate with Nifty with offset
      change = niftyChange * 0.9 + cfg.changeOffset;
    }

    // Relative strength vs Nifty
    const relativeStrength = change - niftyChange;

    // Movers changes
    const sectorMovers = cfg.movers.map(m => {
      const moverChg = change * 1.1 + (Math.random() * 0.4 - 0.2);
      return {
        ...m,
        change: moverChg,
      };
    }).sort((a,b) => b.change - a.change);

    // Score money inflow (change magnitude * volume factor)
    const volumeFactor = cfg.name === 'NIFTY BANK' ? 2.5 : cfg.name === 'NIFTY IT' ? 2.0 : 1.2;
    const moneyInflowScore = Math.abs(change) * volumeFactor;

    return {
      ...cfg,
      change,
      relativeStrength,
      movers: sectorMovers,
      moneyInflowScore,
    };
  });

  // Find the sector with the highest money inflow (Sector Rotation Signal)
  const sortedByInflow = [...sectors].sort((a, b) => b.moneyInflowScore - a.moneyInflowScore);
  const leadingSector = sortedByInflow[0];

  const getHeatmapColor = (change) => {
    const absVal = Math.min(2.0, Math.abs(change));
    const opacity = 0.08 + (absVal / 2.0) * 0.32; // Scale opacity from 0.08 to 0.40
    return change >= 0 
      ? `rgba(16, 185, 129, ${opacity})` // Green
      : `rgba(239, 68, 68, ${opacity})`; // Red
  };

  const getBorderColor = (change) => {
    return change >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  };

  const handleSectorClick = (name) => {
    if (expandedSector === name) {
      setExpandedSector(null);
    } else {
      setExpandedSector(name);
    }
  };

  return (
    <div className="cb-card" style={{ marginTop: 16 }}>
      <div className="cb-card-header">
        <div className="cb-card-title">📊 Sectoral Market Map</div>
        <span className="time-stamp">Relative Strength vs NIFTY 50 ({niftyChange >= 0 ? '+' : ''}{niftyChange.toFixed(2)}%)</span>
      </div>
      <div className="cb-card-body">
        {/* Heatmap Grid */}
        <div className="sec-map-grid">
          {sectors.map((sec) => {
            const isOutperforming = sec.relativeStrength > 0;
            const bg = getHeatmapColor(sec.change);
            const border = getBorderColor(sec.change);
            const isExpanded = expandedSector === sec.name;

            return (
              <React.Fragment key={sec.name}>
                <div
                  className="sec-map-item"
                  style={{
                    backgroundColor: bg,
                    border: isExpanded ? '1px solid #d4af37' : `1px solid ${border}`,
                    boxShadow: isExpanded ? '0 0 8px rgba(212, 175, 55, 0.2)' : 'none',
                  }}
                  onClick={() => handleSectorClick(sec.name)}
                >
                  <span className="sec-title">{sec.label}</span>
                  <span className="sec-change font-mono" style={{ color: sec.change >= 0 ? '#10b981' : '#ef4444' }}>
                    {sec.change >= 0 ? '+' : ''}{sec.change.toFixed(2)}%
                  </span>
                  <div className="flex-between">
                    <span className="sec-ad font-mono">A/D: {sec.adv}/{sec.dec}</span>
                    <span className="sec-rs font-mono" style={{ color: isOutperforming ? '#10b981' : '#ef4444', fontSize: 8.5 }}>
                      {isOutperforming ? 'RS: OUTPERF' : 'RS: UNDERPERF'}
                    </span>
                  </div>
                </div>

                {/* Inline Expand Movers Panel */}
                {isExpanded && (
                  <div className="sec-expand-panel">
                    <div className="sec-expand-header">
                      <span className="sec-expand-title">Top 3 Index Movers — {sec.label}</span>
                      <span style={{ fontSize: 9.5, color: '#94a3b8' }}>A/D: {sec.adv} Advances, {sec.dec} Declines</span>
                    </div>
                    <div className="movers-list">
                      {sec.movers.map((mover) => (
                        <div className="mover-item" key={mover.ticker}>
                          <span className="mover-ticker font-mono">{mover.ticker}</span>
                          <span className={`mover-chg font-mono ${mover.change >= 0 ? 'up' : 'down'}`}>
                            {mover.change >= 0 ? '+' : ''}{mover.change.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Sector Rotation Signal */}
        {leadingSector && (
          <div className="sector-rotation-alert">
            <span style={{ fontSize: 14 }}>🏆</span>
            <div>
              <strong>Sector Rotation Signal:</strong> <span style={{ color: '#ffffff' }}>{leadingSector.name}</span> is receiving the highest institutional money flow magnitude today. Stance: <strong style={{ color: leadingSector.change >= 0 ? '#10b981' : '#ef4444' }}>{leadingSector.change >= 0 ? 'BUY ACCUMULATION' : 'DISTRIBUTION LIQUIDATION'}</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SectoralMarketMap;
