import React from 'react';

const BiasMatrix = React.memo(function BiasMatrix({
  signals, // structure: { '15m': { rsi, macd, ema, volume, priceAction }, '1h': {...}, '1d': {...}, '1w': {...} }
}) {
  const timeframes = [
    { key: '15m', label: '15 Min', weight: 1 },
    { key: '1h', label: '1 Hour', weight: 2 },
    { key: '1d', label: 'Daily', weight: 3 },
    { key: '1w', label: 'Weekly', weight: 4 },
  ];

  const columns = [
    { key: 'rsi', label: 'RSI(14)' },
    { key: 'macd', label: 'MACD' },
    { key: 'ema', label: 'EMAs' },
    { key: 'volume', label: 'Volume' },
    { key: 'priceAction', label: 'Price Act' },
  ];

  // Calculate scores
  let weightedSum = 0;
  let maxWeightSum = 0;
  const tfScores = {};

  timeframes.forEach((tf) => {
    const data = signals?.[tf.key] || { rsi: 0, macd: 0, ema: 0, volume: 0, priceAction: 0 };
    const score = (data.rsi || 0) + (data.macd || 0) + (data.ema || 0) + (data.volume || 0) + (data.priceAction || 0);
    tfScores[tf.key] = score;

    weightedSum += score * tf.weight;
    maxWeightSum += 5 * tf.weight; // Max score per signal is 1, 5 signals total
  });

  // Scale score to -10 to +10 range
  const finalScore = maxWeightSum > 0 ? (weightedSum / maxWeightSum) * 10 : 0;

  // Determine Bias Label
  let biasLabel = 'NEUTRAL';
  let biasClass = 'neutral';
  
  if (finalScore >= 6.0) {
    biasLabel = 'STRONGLY BULLISH';
    biasClass = 'strongly-bullish';
  } else if (finalScore >= 1.5) {
    biasLabel = 'BULLISH';
    biasClass = 'bullish';
  } else if (finalScore <= -6.0) {
    biasLabel = 'STRONGLY BEARISH';
    biasClass = 'strongly-bearish';
  } else if (finalScore <= -1.5) {
    biasLabel = 'BEARISH';
    biasClass = 'bearish';
  }

  // Handle critical rules and short term bounce
  const dailyTrend = signals?.['1d']?.ema || 0; // daily trend
  const m15Trend = signals?.['15m']?.ema || 0; // short term trend
  let overrideLabel = null;
  if (m15Trend > 0 && dailyTrend < 0) {
    overrideLabel = 'SHORT-TERM BOUNCE IN DOWNTREND';
  } else if (m15Trend < 0 && dailyTrend > 0) {
    overrideLabel = 'SHORT-TERM PULLBACK IN UPTREND';
  }

  // Count aligned timeframes
  let alignedCount = 0;
  timeframes.forEach((tf) => {
    const score = tfScores[tf.key] || 0;
    if (finalScore > 0 && score > 0) alignedCount++;
    else if (finalScore < 0 && score < 0) alignedCount++;
    else if (finalScore === 0 && score === 0) alignedCount++;
  });

  // Render signal icon
  const renderIcon = (val) => {
    if (val > 0) return <span className="bias-cell-state bullish">✓</span>;
    if (val < 0) return <span className="bias-cell-state bearish">✗</span>;
    return <span className="bias-cell-state neutral">—</span>;
  };

  // Get score bar color
  const getScoreBarFill = () => {
    const percent = ((finalScore + 10) / 20) * 100;
    const color = finalScore >= 1.5 ? '#10b981' : finalScore <= -1.5 ? '#ef4444' : '#f59e0b';
    return {
      left: finalScore >= 0 ? '50%' : `${percent}%`,
      width: `${Math.abs(finalScore) * 5}%`,
      backgroundColor: color,
    };
  };

  const confidencePct = Math.round(
    (timeframes.reduce((acc, tf) => {
      const data = signals?.[tf.key] || {};
      const tfCount = Object.values(data).filter((v) => {
        if (finalScore > 0) return v > 0;
        if (finalScore < 0) return v < 0;
        return v === 0;
      }).length;
      return acc + tfCount;
    }, 0) / 20) * 100
  );

  return (
    <div className="cb-card">
      <div className="cb-card-header">
        <div className="cb-card-title">🔍 Multi-Timeframe Bias Matrix</div>
        <span className="time-stamp">Confluence Score</span>
      </div>
      <div className="cb-card-body" style={{ padding: '12px 16px' }}>
        <table className="bias-table">
          <thead>
            <tr>
              <th>Timeframe</th>
              {columns.map((col) => (
                <th key={col.key} style={{ textAlign: 'center' }}>{col.label}</th>
              ))}
              <th style={{ textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {timeframes.map((tf) => {
              const data = signals?.[tf.key] || { rsi: 0, macd: 0, ema: 0, volume: 0, priceAction: 0 };
              const score = tfScores[tf.key] || 0;
              return (
                <tr key={tf.key}>
                  <td className="bias-row-title">{tf.label} <span style={{ fontSize: 9, color: '#64748b' }}>({tf.weight}x)</span></td>
                  <td style={{ textAlign: 'center' }}>{renderIcon(data.rsi)}</td>
                  <td style={{ textAlign: 'center' }}>{renderIcon(data.macd)}</td>
                  <td style={{ textAlign: 'center' }}>{renderIcon(data.ema)}</td>
                  <td style={{ textAlign: 'center' }}>{renderIcon(data.volume)}</td>
                  <td style={{ textAlign: 'center' }}>{renderIcon(data.priceAction)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '700', color: score > 0 ? '#10b981' : score < 0 ? '#ef4444' : '#94a3b8' }}>
                    {score > 0 ? '+' : ''}{score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Score Bar */}
        <div style={{ marginTop: 14 }}>
          <div className="flex-between" style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
            <span>BEARISH (-10)</span>
            <span style={{ color: '#ffffff', fontWeight: 'bold' }}>Score: {finalScore >= 0 ? '+' : ''}{finalScore.toFixed(1)}/10</span>
            <span>BULLISH (+10)</span>
          </div>
          <div className="bias-score-bar-container">
            <div className="bias-score-bar-fill" style={getScoreBarFill()} />
          </div>
        </div>

        {/* Summary */}
        <div className="bias-summary-row">
          <div className="flex-gap-8">
            <span style={{ color: '#94a3b8', fontSize: 11.5 }}>Aggregated Bias:</span>
            <span className={`bias-badge ${biasClass}`}>
              {overrideLabel || biasLabel}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, color: '#cbd5e1' }}>
            <span>{alignedCount} of 4 TFs aligned</span>
            <span style={{ color: '#64748b', marginLeft: 8 }}>({confidencePct}% Confidence)</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default BiasMatrix;
