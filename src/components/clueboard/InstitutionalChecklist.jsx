import React, { useState, useEffect } from 'react';

const InstitutionalChecklist = React.memo(function InstitutionalChecklist({
  direction = 'LONG',
  ltp = 0,
  ema9 = 0,
  ema21 = 0,
  ema50 = 0,
  currentVolume = 0,
  avgVolume = 1000000,
  vwap = 0,
  sessionVwapAbovePct = 0.5,
  pcr = 1.0,
  pcrChange = 0,
  fiiNet = 0,
  priceChange = 0,
  uptickRatio = 0.5,
  onScoreUpdate, // callback to notify parent of score
}) {
  const [scoreData, setScoreData] = useState({ totalScore: 0, items: [] });

  useEffect(() => {
    const isLong = direction === 'LONG';

    // 1. Trend Alignment (20 pts)
    let trendScore = 0;
    const conds = [];
    if (isLong) {
      conds.push(ema9 > ema21);
      conds.push(ema21 > ema50);
      conds.push(ltp > ema9);
      conds.push(ltp > ema21);
      conds.push(ltp > ema50);
    } else {
      conds.push(ema9 < ema21);
      conds.push(ema21 < ema50);
      conds.push(ltp < ema9);
      conds.push(ltp < ema21);
      conds.push(ltp < ema50);
    }
    const trendPassedCount = conds.filter(Boolean).length;
    trendScore = trendPassedCount * 4;

    let trendPassed = trendPassedCount >= 4;
    let trendDetails = isLong 
      ? `EMA 9 (${ema9.toFixed(0)}) > 21 (${ema21.toFixed(0)}) > 50 (${ema50.toFixed(0)}) and price above`
      : `EMA 9 (${ema9.toFixed(0)}) < 21 (${ema21.toFixed(0)}) < 50 (${ema50.toFixed(0)}) and price below`;

    // 2. Volume Confirmation (15 pts)
    const volMultiplier = currentVolume / (avgVolume || 1);
    const volumeScore = Math.min(15, Math.round(volMultiplier * 15));
    const volumePassed = volMultiplier >= 1.0;
    const volumeDetails = `Vol: ${volMultiplier.toFixed(2)}x avg today (${(currentVolume/1000).toFixed(0)}K vs avg ${(avgVolume/1000).toFixed(0)}K)`;

    // 3. VWAP Position (20 pts)
    let vwapScore = 0;
    const devPct = Math.abs(ltp - vwap) / (vwap || 1);
    const isAtVwap = devPct <= 0.001; // +/- 0.1%

    if (isAtVwap) {
      vwapScore = 10;
    } else if (isLong && ltp > vwap) {
      vwapScore = sessionVwapAbovePct >= 0.6 ? 20 : 15;
    } else if (!isLong && ltp < vwap) {
      // For short: price below vwap
      vwapScore = sessionVwapAbovePct <= 0.4 ? 20 : 15;
    } else {
      vwapScore = 0;
    }
    const vwapPassed = vwapScore >= 15;
    const vwapDetails = `Price is ₹${Math.abs(ltp - vwap).toFixed(1)} ${ltp >= vwap ? 'above' : 'below'} VWAP (₹${vwap.toFixed(1)}) — session: ${Math.round(sessionVwapAbovePct * 100)}% above`;

    // 4. OI Buildup (PCR) (15 pts)
    let oiScore = 0;
    if (isLong) {
      if (pcr > 1.1 && pcrChange >= 0) oiScore = 15;
      else if (pcr > 1.1 || pcrChange >= 0) oiScore = 10;
      else oiScore = 5;
    } else {
      if (pcr < 0.9 && pcrChange <= 0) oiScore = 15;
      else if (pcr < 0.9 || pcrChange <= 0) oiScore = 10;
      else oiScore = 5;
    }
    const oiPassed = oiScore >= 10;
    const oiDetails = `PCR: ${pcr.toFixed(2)} (OI change dir: ${pcrChange >= 0 ? '▲ buying support' : '▼ call writing'})`;

    // 5. FII Smart Money (15 pts)
    let fiiScore = 0;
    const isFiiBuying = fiiNet > 0;
    const isPriceRising = priceChange >= 0;
    if (isFiiBuying && isPriceRising) {
      fiiScore = isLong ? 15 : 5;
    } else if (!isFiiBuying && !isPriceRising) {
      fiiScore = !isLong ? 15 : 5;
    } else {
      fiiScore = 7;
    }
    const fiiPassed = fiiScore >= 10;
    const fiiDetails = `FII Net: ${fiiNet >= 0 ? '+' : ''}${fiiNet.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr today`;

    // 6. Bid Support (15 pts)
    const activeUpticks = isLong ? uptickRatio : (1 - uptickRatio);
    const bidScore = Math.round(activeUpticks * 15);
    const bidPassed = activeUpticks >= 0.5;
    const bidDetails = `Tick uptick ratio: ${(uptickRatio * 100).toFixed(0)}% (live order book pressure)`;

    const items = [
      { name: 'Trend Alignment (EMA)', score: trendScore, maxScore: 20, passed: trendPassed, details: trendDetails },
      { name: 'Volume Confirmation', score: volumeScore, maxScore: 15, passed: volumePassed, details: volumeDetails },
      { name: 'VWAP Position', score: vwapScore, maxScore: 20, passed: vwapPassed, details: vwapDetails },
      { name: 'OI Buildup (PCR)', score: oiScore, maxScore: 15, passed: oiPassed, details: oiDetails },
      { name: 'FII Smart Money', score: fiiScore, maxScore: 15, passed: fiiPassed, details: fiiDetails },
      { name: 'Bid Support', score: bidScore, maxScore: 15, passed: bidPassed, details: bidDetails },
    ];

    const totalScore = items.reduce((acc, c) => acc + c.score, 0);
    const finalData = { totalScore, items };
    setScoreData(finalData);

    if (onScoreUpdate) {
      onScoreUpdate(totalScore);
    }
  }, [
    direction, ltp, ema9, ema21, ema50, currentVolume,
    avgVolume, vwap, sessionVwapAbovePct, pcr, pcrChange,
    fiiNet, priceChange, uptickRatio
  ]);

  // Determine color based on score
  const getScoreColor = () => {
    const s = scoreData.totalScore;
    if (s >= 85) return '#d4af37'; // Gold
    if (s >= 70) return '#10b981'; // Green
    if (s >= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <div className="cb-card">
      <div className="cb-card-header">
        <div className="cb-card-title">📋 Institutional Checklist</div>
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: getScoreColor() }}>
          SCORE: {scoreData.totalScore}/100
        </span>
      </div>
      <div className="cb-card-body" style={{ padding: '12px 16px' }}>
        <div className="confidence-bar-wrapper" style={{ margin: '0 0 14px 0', background: '#1e293b', height: 6, borderRadius: 3, overflow: 'hidden' }}>
          <div
            className="confidence-bar-fill"
            style={{
              height: '100%',
              width: `${scoreData.totalScore}%`,
              background: getScoreColor(),
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div className="checklist-container">
          {scoreData.items.map((item, idx) => (
            <div className="chk-item" key={idx}>
              <span className={`chk-status-icon ${item.passed ? 'pass' : 'fail'}`}>
                {item.passed ? '✓' : '✗'}
              </span>
              <div className="chk-details">
                <div className="chk-row1">
                  <span>{item.name}</span>
                  <span className={`chk-score-pill ${item.passed ? 'pass' : 'fail'}`}>
                    +{item.score}/{item.maxScore}
                  </span>
                </div>
                <span className="chk-row2">{item.details}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default InstitutionalChecklist;
