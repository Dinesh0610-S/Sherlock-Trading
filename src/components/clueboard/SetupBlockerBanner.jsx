import React from 'react';

const SetupBlockerBanner = React.memo(function SetupBlockerBanner({
  score = 0, // checklistScore
  bias = 'NEUTRAL',
  direction = 'LONG',
  volumeRatio = 1.0,
  ivPercentile = 50,
  dte = 0,
  expiryMinutes = null,
  pcr = 1.0,
  rrRatio = 2.0,
  vwapDistancePct = 0,
}) {
  // Compute the 10 dimensions for alignment
  // trendScore: when checklistScore is 0 (initialising) treat as neutral 5, not failed 0
  const trendScore = score === 0 ? 5 : Math.min(10, Math.round((score / 100) * 10));
  
  let entryTimingScore = 10;
  if (vwapDistancePct > 0.02) entryTimingScore = 4;
  else if (vwapDistancePct > 0.008) entryTimingScore = 7;

  const volumeScore = score >= 75 ? 10 : score >= 50 ? 7 : 4;

  let oiScore = 5;
  const upperDirection = (direction || 'LONG').toUpperCase();
  if ((upperDirection === 'LONG' || upperDirection === 'CE') && pcr > 1.1) oiScore = 10;
  else if ((upperDirection === 'SHORT' || upperDirection === 'PE') && pcr < 0.9) oiScore = 10;
  else if (pcr >= 0.9 && pcr <= 1.1) oiScore = 7;

  let rrScore = 5;
  if (rrRatio >= 2.5) rrScore = 15;
  else if (rrRatio >= 2.0) rrScore = 12;
  else if (rrRatio >= 1.5) rrScore = 9; // ≥1.5 is acceptable — no longer triggers Low RR blocker
  else if (rrRatio >= 1.2) rrScore = 7;

  let ivScore = 7;
  if (ivPercentile < 30) ivScore = 10;
  else if (ivPercentile > 75) ivScore = 4;

  const now = new Date();
  const hrs = now.getHours();
  const mins = now.getMinutes();
  const timeVal = hrs * 60 + mins;
  let timeOfDayScore = 10;
  // NSE opens at 9:15 IST — allow trading from 9:20 AM onwards
  if (timeVal < 9 * 60 + 20) timeOfDayScore = 5;     // pre-market or very open (<9:20)
  else if (timeVal < 9 * 60 + 45) timeOfDayScore = 7; // 9:20-9:44 — first 30 mins, caution
  else if (timeVal > 15 * 60 + 15) timeOfDayScore = 5; // after 3:15 PM — close risk

  const newsEventScore = 10;
  const srScore = vwapDistancePct < 0.01 ? 10 : vwapDistancePct < 0.02 ? 7 : 5;
  const mtfScore = score >= 80 ? 15 : score >= 60 ? 11 : 7;

  const totalScore = trendScore + entryTimingScore + volumeScore + oiScore + rrScore + ivScore + timeOfDayScore + newsEventScore + srScore + mtfScore;

  // Hard blockers — only fire on genuinely extreme conditions
  const activeBlockers = [];
  if (dte === 0 && expiryMinutes !== null && expiryMinutes < 30) {
    activeBlockers.push('Gamma risk extreme (<30m to expiry)');
  }
  // Volume: use 0.2 threshold (not 0.3) since we now supply time-adjusted expected volume
  if (volumeRatio < 0.2) {
    activeBlockers.push('Insufficient institutional volume (<0.2x of intraday expected)');
  }
  if (ivPercentile >= 85) {
    activeBlockers.push('Extreme IV (options too expensive — use spreads)');
  }
  if (upperDirection === 'LONG' && (bias === 'STRONGLY BEARISH' || bias === 'BEARISH')) {
    activeBlockers.push('Trend bias conflict (Bearish bias — avoid CE Buy)');
  }
  if (upperDirection === 'SHORT' && (bias === 'STRONGLY BULLISH' || bias === 'BULLISH')) {
    activeBlockers.push('Trend bias conflict (Bullish bias — avoid PE Buy)');
  }

  // Soft blockers from scorecard dimensions — only block if score is definitely poor
  if (trendScore < 4) activeBlockers.push('Weak Trend Alignment (checklist score very low)');
  if (entryTimingScore < 6) activeBlockers.push('Poor Entry Timing (extended from VWAP)');
  if (rrScore < 7) activeBlockers.push('Low Risk-Reward Ratio (<1.2:1)');
  if (timeOfDayScore < 6) activeBlockers.push('Volatility Risk Hour (pre-market or close)');
  if (srScore < 5) activeBlockers.push('Extended from Support/Resistance');

  let blockerText = '';
  let status = 'clear'; // 'clear', 'warning', 'blocked'

  if (activeBlockers.length > 0) {
    status = 'blocked';
    blockerText = `BLOCKED: ${activeBlockers.join(' | ')}`;
  } else if (totalScore < 70) {
    status = 'warning';
    blockerText = `HOLD: Deep checklist score is ${totalScore}/100 — low confidence setup`;
  } else {
    blockerText = 'CLEAR: All checklist requirements met — proceed with plan';
    status = 'clear';
  }

  const badgeText = status === 'clear' ? 'PASS' : status === 'warning' ? 'HOLD' : 'BLOCKED';

  return (
    <div className={`blocker-banner ${status}`}>
      <div className="blocker-content">
        <div className="blocker-status">
          <span className="freshness-dot green" style={{ animationName: status === 'clear' ? 'pulse-green' : status === 'warning' ? 'pulse-amber' : 'none', backgroundColor: status === 'clear' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444' }}></span>
          {badgeText} — Setup Verification
        </div>
        <div className="blocker-details">
          {blockerText}
        </div>
      </div>
      <div className="blocker-score font-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.65, color: 'inherit' }}>
          Setup Score
        </span>
        {totalScore}%
      </div>
    </div>
  );
});

export default SetupBlockerBanner;
