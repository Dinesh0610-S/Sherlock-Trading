import React from 'react';

const TradeQualityScore = React.memo(function TradeQualityScore({
  direction = 'LONG',
  checklistScore = 0,
  pcr = 1.0,
  ivPercentile = 50,
  rrRatio = 2.0,
  vwapDistancePct = 0,
}) {
  // 1. Trend Alignment (/10)
  const trendScore = Math.min(10, Math.round((checklistScore / 100) * 10));

  // 2. Entry Timing (/10)
  let entryTimingScore = 10;
  if (vwapDistancePct > 0.02) entryTimingScore = 4;
  else if (vwapDistancePct > 0.008) entryTimingScore = 7;

  // 3. Volume Confirmation (/10)
  const volumeScore = checklistScore >= 75 ? 10 : checklistScore >= 50 ? 7 : 4;

  // 4. OI Support (/10)
  let oiScore = 5;
  const upperDirection = (direction || 'LONG').toUpperCase();
  if ((upperDirection === 'LONG' || upperDirection === 'CE') && pcr > 1.1) oiScore = 10;
  else if ((upperDirection === 'SHORT' || upperDirection === 'PE') && pcr < 0.9) oiScore = 10;
  else if (pcr >= 0.9 && pcr <= 1.1) oiScore = 7;

  // 5. Risk-Reward Ratio (/15)
  let rrScore = 5;
  if (rrRatio >= 3.0) rrScore = 15;
  else if (rrRatio >= 2.0) rrScore = 12;
  else if (rrRatio >= 1.5) rrScore = 9;

  // 6. IV Environment (/10)
  let ivScore = 7;
  if (ivPercentile < 30) ivScore = 10;
  else if (ivPercentile > 75) ivScore = 4;

  // 7. Time-of-Day Risk (/10)
  const now = new Date();
  const hrs = now.getHours();
  const mins = now.getMinutes();
  const timeVal = hrs * 60 + mins;
  let timeOfDayScore = 10;
  if (timeVal < 10 * 60) timeOfDayScore = 6; // opening volatility
  else if (timeVal > 14 * 60 + 45) timeOfDayScore = 5; // close volatility

  // 8. News/Event Risk (/10)
  const newsEventScore = 10; // default stable

  // 9. Proximity to S/R Pivot Confluences (/10)
  const srScore = vwapDistancePct < 0.01 ? 10 : vwapDistancePct < 0.02 ? 7 : 5;

  // 10. Multi-Timeframe Alignment Consensus (/15)
  const mtfScore = checklistScore >= 80 ? 15 : checklistScore >= 60 ? 11 : 7;

  // Compute total out of 100
  const totalScore = trendScore + entryTimingScore + volumeScore + oiScore + rrScore + ivScore + timeOfDayScore + newsEventScore + srScore + mtfScore;

  // Determine Grade & Recommendation
  let grade = 'C';
  let recommendation = 'DO NOT TRADE — insufficient edge';
  let badgeColor = '#ef4444'; // Red

  if (totalScore >= 85) {
    grade = 'A+';
    recommendation = 'HIGH CONVICTION — consider 1.5x size';
    badgeColor = '#d4af37'; // Gold
  } else if (totalScore >= 75) {
    grade = 'A';
    recommendation = 'GOOD SETUP — standard size';
    badgeColor = '#10b981'; // Green
  } else if (totalScore >= 60) {
    grade = 'B';
    recommendation = 'MARGINAL — reduce size to 50%';
    badgeColor = '#f59e0b'; // Amber
  }

  // Dimensions array for rendering progress bars
  const dimensions = [
    { name: 'Trend Alignment', score: trendScore, max: 10, pct: (trendScore / 10) * 100 },
    { name: 'Entry Timing', score: entryTimingScore, max: 10, pct: (entryTimingScore / 10) * 100 },
    { name: 'Volume Confirm', score: volumeScore, max: 10, pct: (volumeScore / 10) * 100 },
    { name: 'OI Support', score: oiScore, max: 10, pct: (oiScore / 10) * 100 },
    { name: 'Risk-Reward', score: rrScore, max: 15, pct: (rrScore / 15) * 100 },
    { name: 'IV Environment', score: ivScore, max: 10, pct: (ivScore / 10) * 100 },
    { name: 'Time-of-Day Risk', score: timeOfDayScore, max: 10, pct: (timeOfDayScore / 10) * 100 },
    { name: 'News/Event Risk', score: newsEventScore, max: 10, pct: (newsEventScore / 10) * 100 },
    { name: 'S/R Proximity', score: srScore, max: 10, pct: (srScore / 10) * 100 },
    { name: 'MTF Alignment', score: mtfScore, max: 15, pct: (mtfScore / 15) * 100 }
  ];

  const accelerators = dimensions.filter(d => d.pct >= 80);
  const blockers = dimensions.filter(d => d.pct < 60);

  return (
    <div className="cb-card w-full box-border" style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
      <div className="cb-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="cb-card-title" style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--gold)' }}>🛡️ Deep Quality Score Gate</div>
        <span className="time-stamp" style={{ fontSize: '9px', color: '#64748b' }}>10-Dimension Scorecard</span>
      </div>
      <div className="cb-card-body" style={{ padding: '12px 0 0 0' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full box-border" style={{ marginBottom: '14px', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>CONVICTION GRADE</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: badgeColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {grade} <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 'normal' }}>({totalScore}/100)</span>
            </div>
          </div>
          <div className="text-left sm:text-right max-w-full sm:max-w-[60%]" style={{ fontSize: '11px', color: '#cbd5e1' }}>
            {recommendation}
          </div>
        </div>

        {/* 10-Dimension Progress Bar Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 w-full box-border" style={{ gap: '10px 14px', marginBottom: '14px' }}>
          {dimensions.map((d, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8' }}>
                <span>{d.name}</span>
                <strong style={{ color: '#cbd5e1' }}>{d.score}/{d.max}</strong>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${d.pct}%`, height: '100%', background: d.pct >= 80 ? '#00e676' : d.pct >= 60 ? '#ffab00' : '#ff1744', borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Accelerators & Blockers Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 w-full box-border" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>🚀 Accelerators (≥80%)</span>
            {accelerators.length === 0 ? (
              <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>None active</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {accelerators.map((a, i) => (
                  <span key={i} style={{ fontSize: '9px', background: 'rgba(0, 230, 118, 0.08)', color: '#00e676', border: '1px solid rgba(0, 230, 118, 0.15)', padding: '2px 5px', borderRadius: '4px' }}>
                    {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>⚠️ Blockers (&lt;60%)</span>
            {blockers.length === 0 ? (
              <span style={{ fontSize: '10px', color: '#10b981', fontStyle: 'italic' }}>No active blockers</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {blockers.map((b, i) => (
                  <span key={i} style={{ fontSize: '9px', background: 'rgba(255, 23, 68, 0.08)', color: '#ff1744', border: '1px solid rgba(255, 23, 68, 0.15)', padding: '2px 5px', borderRadius: '4px' }}>
                    {b.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default TradeQualityScore;
