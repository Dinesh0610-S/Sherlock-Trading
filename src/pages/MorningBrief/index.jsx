import React, { useState, useEffect, useCallback } from 'react';
import StrategyEngineDashboard from '../../components/StrategyEngineDashboard';
import { usePersistedState } from '../../hooks/usePersistedState';

const parseEconomicEvent = (eventStr) => {
  const timeMatch = eventStr.match(/\(([^)]+)\)/);
  const time = timeMatch ? timeMatch[1] : 'Day-long';
  let name = eventStr.replace(/\([^)]+\)/g, '').trim();
  
  let impact = 'LOW';
  const upperName = name.toUpperCase();
  if (
    upperName.includes('RBI') ||
    upperName.includes('FED') ||
    upperName.includes('FOMC') ||
    upperName.includes('CPI') ||
    upperName.includes('INFLATION') ||
    upperName.includes('EXPIRY') ||
    upperName.includes('BUDGET') ||
    upperName.includes('DECISION') ||
    upperName.includes('INTEREST RATE')
  ) {
    impact = 'HIGH';
  } else if (
    upperName.includes('OPEN') ||
    upperName.includes('US') ||
    upperName.includes('EUROPE') ||
    upperName.includes('DATA') ||
    upperName.includes('GDP') ||
    upperName.includes('FLOW')
  ) {
    impact = 'MEDIUM';
  }
  
  let asset = 'All Markets';
  if (upperName.includes('BANK') || upperName.includes('RBI') || upperName.includes('FIN')) {
    asset = 'BANK NIFTY';
  } else if (upperName.includes('NIFTY') || upperName.includes('EXPIRY')) {
    asset = 'NIFTY 50';
  } else if (upperName.includes('SENSEX')) {
    asset = 'SENSEX';
  }
  
  return { name, time, impact, asset };
};

const EconomicCalendar = ({ events }) => {
  const parsedEvents = (events || []).map(ev => parseEconomicEvent(ev));

  return (
    <div className="m-card bg-[#141722] border border-amber-900/30 rounded p-3 flex flex-col" style={{ flex: 1 }}>
      <div className="m-label-row border-b border-slate-800/60 pb-1.5 mb-3 flex justify-between items-center">
        <span className="ds-value--gold font-mono font-bold font-xs">📅 ECONOMIC CALENDAR</span>
        <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(245,158,11,0.2)' }}>TODAY</span>
      </div>
      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Time (IST)</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Event</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'center' }}>Impact</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Affected Asset</th>
            </tr>
          </thead>
          <tbody>
            {parsedEvents.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '16px 8px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                  No economic events scheduled for today.
                </td>
              </tr>
            ) : (
              parsedEvents.map((ev, i) => {
                const impactColor = ev.impact === 'HIGH' ? '#ff1744' : ev.impact === 'MEDIUM' ? '#ffab00' : '#64748b';
                const impactBg = ev.impact === 'HIGH' ? 'rgba(255,23,68,0.12)' : ev.impact === 'MEDIUM' ? 'rgba(255,171,0,0.12)' : 'rgba(100,116,139,0.1)';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="pmi-mrow">
                    <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>{ev.time}</td>
                    <td style={{ padding: '8px', color: '#f1f5f9', fontWeight: 500 }}>{ev.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        background: impactBg,
                        color: impactColor,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        border: `1px solid ${impactColor}33`,
                        letterSpacing: '0.5px'
                      }}>
                        {ev.impact}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-secondary)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontFamily: 'monospace'
                      }}>{ev.asset}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TradingPlanTab = ({ data }) => {
  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [genTime, setGenTime] = useState(null);

  const generatePlan = async () => {
    if (!data) return;
    loadingPlan();
  };

  const loadingPlan = async () => {
    setLoading(true);
    setError(null);

    const mappedNiftyGapPct = data._raw?.nifty_current ? ((data._raw.sgx_gap ?? 0) / data._raw.nifty_current) * 100 : 0;
    const mappedData = {
      globalCues: {
        dow: { changePct: data._raw?.dow?.change_pct ?? 0 },
        nasdaq: { changePct: data._raw?.nasdaq?.change_pct ?? 0 },
        sp500: { changePct: data._raw?.sp500?.change_pct ?? 0 },
        crude: { changePct: data._raw?.crude?.change_pct ?? 0 },
        gold: { changePct: data._raw?.gold?.change_pct ?? 0 },
        usdinr: { price: data._raw?.usdinr ?? 0 }
      },
      nifty: {
        prevClose: data._raw?.nifty_current ?? 0,
        iep: data._raw?.sgx_nifty ?? 0,
        gapPct: mappedNiftyGapPct
      },
      fiiNet: data._raw?.fii_net ?? 0,
      vix: { price: data._raw?.vix ?? 0 },
      newsAnalysis: {
        overall_sentiment: data.global_bias ?? 'NEUTRAL',
        key_opportunity: data.overnight_catalyst ?? '',
        key_risk: data.red_flags?.[0] ?? ''
      }
    };

    try {
      const res = await fetch('/api/morning/trading-plan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ morningData: mappedData })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      setPlan(result);
      setGenTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12:   true
        })
      );
    } catch (err) {
      console.warn('Backend trading plan endpoint failed, using client-side mock fallback:', err.message);
      const raw = data?._raw || {};
      const isBull = (raw.sgx_gap || 0) > 0 && (raw.fii_net || 0) > 0;
      const niftyClose = raw.nifty_current || 23600;
      const iep = raw.sgx_nifty || niftyClose;
      
      const mockPlan = {
        marketBias: isBull ? 'BULLISH' : 'BEARISH',
        openingExpectation: (raw.sgx_gap || 0) > 30
          ? `Gap up open expected near ₹${iep.toLocaleString('en-IN')}. Watch if gap holds.`
          : (raw.sgx_gap || 0) < -30
          ? `Gap down open near ₹${iep.toLocaleString('en-IN')}. Selling pressure expected.`
          : `Flat open near ₹${iep.toLocaleString('en-IN')}. Wait for direction.`,
        intradayStrategy:
          'Wait for 9:20 AM before taking any position. ' +
          'Let first 5-minute candle form and confirm direction. ' +
          'Enter only on clear breakout with volume.',
        longSetups: isBull ? [{
          stock:  'NIFTY',
          entry:  iep ? Math.round(iep / 50) * 50 + 50 : 23650,
          sl:     iep ? Math.round(iep / 50) * 50 - 25 : 23580,
          target: iep ? Math.round(iep / 50) * 50 + 150 : 23800,
          reason: 'Gap up with positive global cues'
        }] : [],
        shortSetups: !isBull ? [{
          stock:  'NIFTY',
          entry:  iep ? Math.round(iep / 50) * 50 - 50 : 23500,
          sl:     iep ? Math.round(iep / 50) * 50 + 25 : 23570,
          target: iep ? Math.round(iep / 50) * 50 - 150 : 23350,
          reason: 'Gap down with negative global cues'
        }] : [],
        sectorsToWatch: ['BANK', 'IT'],
        avoidToday:    ['PHARMA'],
        keyTimeZones: [
          '9:15–9:20 AM — Market opens, observe only',
          '9:20 AM — Enter on first directional signal',
          '3:15 PM — Exit all positions'
        ],
        riskFlags:    [],
        riskLevel:    'MEDIUM',
        oneLiner: 'Watson, let the market reveal its hand before we act.'
      };
      
      setPlan(mockPlan);
      setGenTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12:   true
        }) + ' (Offline Fallback)'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data && !plan && !loading) generatePlan();
  }, [data]);

  return (
    <div className="trading-plan-tab">
      <div className="plan-header">
        <div className="plan-title">
          <span className="plan-icon">📋</span>
          <span>Sherlock's Trading Plan</span>
          {genTime && (
            <span className="gen-time">
              Generated at {genTime}
            </span>
          )}
        </div>
        <button
          className="regenerate-btn"
          onClick={generatePlan}
          disabled={loading}
        >
          {loading ? '⏳ Generating...' : '↺ Regenerate Plan'}
        </button>
      </div>

      {loading && (
        <div className="plan-loading">
          <div className="loading-sherlock">
            <span className="loading-icon">🔍</span>
            <span>Sherlock is analyzing pre-market data...</span>
            <div className="loading-bar" />
          </div>
        </div>
      )}

      {error && (
        <div className="plan-error">
          ⚠ {error}
          <button onClick={generatePlan}>Retry</button>
        </div>
      )}

      {plan && !loading && (
        <div className="plan-content">
          <div className={`bias-banner bias-${plan.marketBias?.toLowerCase()}`}>
            <span className="bias-label">
              Market Bias Today:
            </span>
            <span className="bias-value">
              {plan.marketBias === 'BULLISH'  ? '🐂' :
               plan.marketBias === 'BEARISH'  ? '🐻' : '↔'}{' '}
              {plan.marketBias}
            </span>
          </div>

          <StrategyEngineDashboard mini={true} spotPrice={data._raw?.nifty_current || 24200} />

          <div className="plan-section">
            <h4>🔔 Opening Expectation</h4>
            <p className="plan-text">{plan.openingExpectation}</p>
          </div>

          <div className="plan-section">
            <h4>⚡ Intraday Strategy</h4>
            <p className="plan-text">{plan.intradayStrategy}</p>
          </div>

          {plan.longSetups?.length > 0 && (
            <div className="plan-section">
              <h4 className="green">🐂 Long Setups</h4>
              <div className="setups-grid">
                {plan.longSetups.map((s, i) => (
                  <div key={i} className="setup-card long">
                    <div className="setup-header">
                      <span className="setup-symbol">{s.stock}</span>
                      <span className="setup-type long">LONG</span>
                    </div>
                    <div className="setup-levels">
                      <div className="setup-row">
                        <span>Entry</span>
                        <span className="amber">
                          ₹{s.entry?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="setup-row">
                        <span>Stop Loss</span>
                        <span className="red">
                          ₹{s.sl?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="setup-row">
                        <span>Target</span>
                        <span className="green">
                          ₹{s.target?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                    <p className="setup-reason">{s.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.shortSetups?.length > 0 && (
            <div className="plan-section">
              <h4 className="red">🐻 Short Setups</h4>
              <div className="setups-grid">
                {plan.shortSetups.map((s, i) => (
                  <div key={i} className="setup-card short">
                    <div className="setup-header">
                      <span className="setup-symbol">{s.stock}</span>
                      <span className="setup-type short">SHORT</span>
                    </div>
                    <div className="setup-levels">
                      <div className="setup-row">
                        <span>Entry</span>
                        <span className="amber">
                          ₹{s.entry?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="setup-row">
                        <span>Stop Loss</span>
                        <span className="red">
                          ₹{s.sl?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="setup-row">
                        <span>Target</span>
                        <span className="green">
                          ₹{s.target?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                    <p className="setup-reason">{s.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.sectorsToWatch?.length > 0 && (
            <div className="plan-section">
              <h4>🏭 Sectors to Watch</h4>
              <div className="sectors-row">
                {plan.sectorsToWatch.map(s => (
                  <span key={s} className="sector-chip watch">{s}</span>
                ))}
              </div>
              {plan.avoidToday?.length > 0 && (
                <div className="avoid-row">
                  <span className="avoid-label">Avoid:</span>
                  {plan.avoidToday.map(s => (
                    <span key={s} className="sector-chip avoid">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {plan.keyTimeZones?.length > 0 && (
            <div className="plan-section">
              <h4>⏰ Key Time Zones</h4>
              <div className="time-zones">
                {plan.keyTimeZones.map((t, i) => (
                  <div key={i} className="time-zone-item">
                    <span className="tz-dot" />
                    <span className="tz-text">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.riskFlags?.length > 0 && (
            <div className="plan-section">
              <h4 className="red">⚠ Risk Flags</h4>
              {plan.riskFlags.map((r, i) => (
                <div key={i} className="risk-flag">
                  ⚠ {r}
                </div>
              ))}
            </div>
          )}

          {plan.oneLiner && (
            <div className="plan-oneliner">
              <span className="sherlock-icon">🕵️</span>
              <em>"{plan.oneLiner}"</em>
            </div>
          )}
        </div>
      )}

      {!plan && !loading && !error && (
        <div className="plan-empty">
          <button
            className="generate-plan-btn"
            onClick={generatePlan}
          >
            📋 Generate Today's Trading Plan
          </button>
        </div>
      )}
    </div>
  );
};

const MarketVerdictTab = ({ data }) => {
  const [verdict,   setVerdict]   = useState(null);
  const [generated, setGenerated] = useState(false);

  const calculateVerdict = useCallback(() => {
    if (!data) return;

    const mappedNiftyGapPct = data._raw?.nifty_current ? ((data._raw.sgx_gap ?? 0) / data._raw.nifty_current) * 100 : 0;
    const mappedData = {
      globalCues: {
        dow: { changePct: data._raw?.dow?.change_pct ?? 0 },
        nasdaq: { changePct: data._raw?.nasdaq?.change_pct ?? 0 },
        crude: { changePct: data._raw?.crude?.change_pct ?? 0 },
        gold: { changePct: data._raw?.gold?.change_pct ?? 0 },
        usdinr: { price: data._raw?.usdinr ?? 0 }
      },
      nifty: {
        gapPct: mappedNiftyGapPct,
        prevClose: data._raw?.nifty_current ?? 0,
        iep: data._raw?.sgx_nifty ?? 0,
      },
      fiiNet: data._raw?.fii_net ?? 0,
      vix: { price: data._raw?.vix ?? 0 },
      indiaVix: { price: data._raw?.vix ?? 0 },
      newsAnalysis: {
        overall_sentiment: data.global_bias ?? 'NEUTRAL',
        key_opportunity: data.overnight_catalyst ?? '',
        key_risk: data.red_flags?.[0] ?? ''
      }
    };

    const {
      globalCues, nifty, fiiNet,
      vix, indiaVix, newsAnalysis
    } = mappedData;

    let bullScore = 0;
    let bearScore = 0;
    const factors = [];

    // 1. US Markets
    if (globalCues?.dow && globalCues?.nasdaq) {
      const usUp = globalCues.dow.changePct > 0 &&
                   globalCues.nasdaq.changePct > 0;
      const usDn = globalCues.dow.changePct < 0 &&
                   globalCues.nasdaq.changePct < 0;
      if (usUp) {
        bullScore += 20;
        factors.push({
          name:   'US Markets',
          value:  `Dow ${globalCues.dow.changePct > 0 ? '+' : ''}${globalCues.dow.changePct}%`,
          signal: 'BULLISH',
          pts:    +20,
          color:  '#00ff88'
        });
      } else if (usDn) {
        bearScore += 20;
        factors.push({
          name:   'US Markets',
          value:  `Dow ${globalCues.dow.changePct}%`,
          signal: 'BEARISH',
          pts:    -20,
          color:  '#ff4444'
        });
      } else {
        factors.push({
          name:   'US Markets',
          value:  'Mixed',
          signal: 'NEUTRAL',
          pts:    0,
          color:  '#f5a623'
        });
      }
    }

    // 2. GIFT Nifty Gap
    if (nifty?.gapPct !== undefined) {
      const gap = nifty.gapPct;
      if (gap > 0.5) {
        bullScore += 20;
        factors.push({
          name:   'GIFT Nifty Gap',
          value:  `+${gap.toFixed(2)}% Gap Up`,
          signal: 'BULLISH',
          pts:    +20,
          color:  '#00ff88'
        });
      } else if (gap < -0.5) {
        bearScore += 20;
        factors.push({
          name:   'GIFT Nifty Gap',
          value:  `${gap.toFixed(2)}% Gap Down`,
          signal: 'BEARISH',
          pts:    -20,
          color:  '#ff4444'
        });
      } else {
        factors.push({
          name:   'GIFT Nifty Gap',
          value:  `${gap.toFixed(2)}% Flat`,
          signal: 'NEUTRAL',
          pts:    0,
          color:  '#f5a623'
        });
      }
    }

    // 3. FII Flow
    if (fiiNet !== null && fiiNet !== undefined) {
      if (fiiNet > 1000) {
        bullScore += 15;
        factors.push({
          name:   'FII Flow',
          value:  `+₹${fiiNet.toFixed(0)} Cr`,
          signal: 'BULLISH',
          pts:    +15,
          color:  '#00ff88'
        });
      } else if (fiiNet > 0) {
        bullScore += 8;
        factors.push({
          name:   'FII Flow',
          value:  `+₹${fiiNet.toFixed(0)} Cr`,
          signal: 'MILD BULLISH',
          pts:    +8,
          color:  '#00cc66'
        });
      } else if (fiiNet < -1000) {
        bearScore += 15;
        factors.push({
          name:   'FII Flow',
          value:  `₹${fiiNet.toFixed(0)} Cr`,
          signal: 'BEARISH',
          pts:    -15,
          color:  '#ff4444'
        });
      } else {
        bearScore += 5;
        factors.push({
          name:   'FII Flow',
          value:  `₹${fiiNet.toFixed(0)} Cr`,
          signal: 'MILD BEARISH',
          pts:    -5,
          color:  '#ff8800'
        });
      }
    }

    // 4. India VIX
    const vixVal = indiaVix?.price || vix?.price;
    if (vixVal) {
      if (vixVal < 13) {
        bullScore += 10;
        factors.push({
          name:   'India VIX',
          value:  vixVal.toFixed(2),
          signal: 'LOW FEAR',
          pts:    +10,
          color:  '#00ff88'
        });
      } else if (vixVal < 17) {
        bullScore += 5;
        factors.push({
          name:   'India VIX',
          value:  vixVal.toFixed(2),
          signal: 'MODERATE',
          pts:    +5,
          color:  '#f5a623'
        });
      } else if (vixVal > 22) {
        bearScore += 15;
        factors.push({
          name:   'India VIX',
          value:  vixVal.toFixed(2),
          signal: 'HIGH FEAR',
          pts:    -15,
          color:  '#ff4444'
        });
      } else {
        bearScore += 8;
        factors.push({
          name:   'India VIX',
          value:  vixVal.toFixed(2),
          signal: 'ELEVATED',
          pts:    -8,
          color:  '#ff8800'
        });
      }
    }

    // 5. Crude Oil
    if (globalCues?.crude) {
      if (globalCues.crude.changePct < -2) {
        bullScore += 8;
        factors.push({
          name:   'Crude Oil',
          value:  `${globalCues.crude.changePct}%`,
          signal: 'BULLISH for India',
          pts:    +8,
          color:  '#00ff88'
        });
      } else if (globalCues.crude.changePct > 2) {
        bearScore += 8;
        factors.push({
          name:   'Crude Oil',
          value:  `+${globalCues.crude.changePct}%`,
          signal: 'BEARISH for India',
          pts:    -8,
          color:  '#ff4444'
        });
      } else {
        factors.push({
          name:   'Crude Oil',
          value:  `${globalCues.crude.changePct}%`,
          signal: 'NEUTRAL',
          pts:    0,
          color:  '#f5a623'
        });
      }
    }

    // 6. News Sentiment
    if (newsAnalysis?.overall_sentiment) {
      const s = newsAnalysis.overall_sentiment;
      if (s === 'BULLISH') {
        bullScore += 10;
        factors.push({
          name:   'News Sentiment',
          value:  'BULLISH',
          signal: 'Positive headlines',
          pts:    +10,
          color:  '#00ff88'
        });
      } else if (s === 'BEARISH') {
        bearScore += 10;
        factors.push({
          name:   'News Sentiment',
          value:  'BEARISH',
          signal: 'Negative headlines',
          pts:    -10,
          color:  '#ff4444'
        });
      } else {
        factors.push({
          name:   'News Sentiment',
          value:  'NEUTRAL',
          signal: 'Mixed headlines',
          pts:    0,
          color:  '#f5a623'
        });
      }
    }

    const totalScore = bullScore + bearScore;
    const maxPossible = 100;
    const netScore   = bullScore - bearScore;
    const confidence = Math.min(95, Math.max(10,
      Math.round(50 + (netScore / maxPossible) * 50)
    ));

    const direction =
      netScore > 20  ? 'OPEN LONG'   :
      netScore < -20 ? 'OPEN SHORT'  :
      netScore > 5   ? 'CAUTIOUS LONG'  :
      netScore < -5  ? 'CAUTIOUS SHORT' :
                       'WAIT & WATCH';

    const conviction =
      Math.abs(netScore) > 40 ? 'HIGH CONVICTION'   :
      Math.abs(netScore) > 20 ? 'MEDIUM CONVICTION' :
                                 'LOW CONVICTION';

    const verdictColor =
      direction.includes('LONG')  ? '#00ff66' :
      direction.includes('SHORT') ? '#ff4444' : '#f5a623';

    setVerdict({
      direction,
      conviction,
      confidence,
      verdictColor,
      netScore,
      bullScore,
      bearScore,
      factors,
      keyLevels: {
        prevClose:   nifty?.prevClose,
        giftLevel:   nifty?.iep,
        resistance1: nifty?.iep
          ? Math.round((nifty.iep * 1.005) / 50) * 50
          : null,
        resistance2: nifty?.iep
          ? Math.round((nifty.iep * 1.010) / 50) * 50
          : null,
        support1: nifty?.iep
          ? Math.round((nifty.iep * 0.995) / 50) * 50
          : null,
        support2: nifty?.iep
          ? Math.round((nifty.iep * 0.990) / 50) * 50
          : null,
      }
    });
    setGenerated(true);
  }, [data]);

  useEffect(() => {
    if (data && !generated) calculateVerdict();
  }, [data, generated, calculateVerdict]);

  if (!data) return (
    <div className="tab-loading">
      Loading morning data...
    </div>
  );

  return (
    <div className="market-verdict-tab">
      {verdict && (
        <>
          <div className="verdict-main-banner" style={{ borderColor: verdict.verdictColor }}>
            <div className="verdict-direction" style={{ color: verdict.verdictColor }}>
              <span className="verdict-dot" style={{ background: verdict.verdictColor }} />
              {verdict.direction}
            </div>
            <div className="verdict-conviction">
              {verdict.conviction}
            </div>
          </div>

          <div className="verdict-confidence-row">
            <span className="conf-label">Confidence:</span>
            <div className="conf-bar-track">
              <div
                className="conf-bar-fill"
                style={{
                  width:      `${verdict.confidence}%`,
                  background: verdict.verdictColor
                }}
              />
            </div>
            <span className="conf-pct" style={{ color: verdict.verdictColor }}>
              {verdict.confidence}%
            </span>
          </div>

          <div className="factors-section">
            <h4 className="section-title">📊 Scoring Breakdown</h4>
            <table className="factors-table">
              <thead>
                <tr>
                  <th>FACTOR</th>
                  <th>VALUE</th>
                  <th>SIGNAL</th>
                  <th>SCORE</th>
                </tr>
              </thead>
              <tbody>
                {verdict.factors.map((f, i) => (
                  <tr key={i}>
                    <td className="factor-name">{f.name}</td>
                    <td className="factor-value">{f.value}</td>
                    <td style={{ color: f.color }}>{f.signal}</td>
                    <td className={f.pts > 0 ? 'positive' : f.pts < 0 ? 'negative' : 'neutral'}>
                      {f.pts > 0 ? '+' : ''}{f.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2}><strong>NET SCORE</strong></td>
                  <td style={{ color: verdict.verdictColor }}>
                    <strong>{verdict.direction}</strong>
                  </td>
                  <td className={verdict.netScore > 0 ? 'positive' : 'negative'}>
                    <strong>
                      {verdict.netScore > 0 ? '+' : ''}
                      {verdict.netScore}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bull-bear-bar-section">
            <div className="bb-labels">
              <span className="green">🐂 Bull {verdict.bullScore}</span>
              <span className="red">🐻 Bear {verdict.bearScore}</span>
            </div>
            <div className="bb-bar">
              <div
                className="bb-bull"
                style={{
                  width: `${(verdict.bullScore / (verdict.bullScore + verdict.bearScore || 1)) * 100}%`
                }}
              />
              <div
                className="bb-bear"
                style={{
                  width: `${(verdict.bearScore / (verdict.bullScore + verdict.bearScore || 1)) * 100}%`
                }}
              />
            </div>
          </div>

          {verdict.keyLevels?.prevClose && (
            <div className="key-levels-section">
              <h4 className="section-title">🎯 Key Levels for Today</h4>
              <div className="levels-grid">
                <div className="level-card resistance">
                  <label>R2</label>
                  <span className="value">₹{verdict.keyLevels.resistance2?.toLocaleString('en-IN') || '—'}</span>
                </div>
                <div className="level-card resistance">
                  <label>R1</label>
                  <span className="value">₹{verdict.keyLevels.resistance1?.toLocaleString('en-IN') || '—'}</span>
                </div>
                <div className="level-card current">
                  <label>GIFT NIFTY</label>
                  <span className="value" style={{ color: verdict.verdictColor }}>
                    ₹{verdict.keyLevels.giftLevel?.toLocaleString('en-IN') || '—'}
                  </span>
                </div>
                <div className="level-card support">
                  <label>S1</label>
                  <span className="value">₹{verdict.keyLevels.support1?.toLocaleString('en-IN') || '—'}</span>
                </div>
                <div className="level-card support">
                  <label>S2</label>
                  <span className="value">₹{verdict.keyLevels.support2?.toLocaleString('en-IN') || '—'}</span>
                </div>
              </div>
            </div>
          )}

          <button className="recalculate-verdict-btn" onClick={calculateVerdict}>
            🔄 Recalculate Verdict
          </button>
        </>
      )}

      {!verdict && !generated && (
        <button className="generate-verdict-btn" onClick={calculateVerdict}>
          ⚖️ Calculate Market Verdict
        </button>
      )}
    </div>
  );
};

export default function MorningBrief() {
  const [morningBrief, setMorningBrief] = useState(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [briefSubTab, setBriefSubTab] = useState('global');

  const fetchMorningBrief = async () => {
    setLoadingBrief(true);
    try {
      const res = await fetch(`/api/morning-brief?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setMorningBrief(json);
        setBriefSubTab('global');
      }
    } catch (e) {
      console.error('Error fetching morning brief:', e);
    } finally {
      setLoadingBrief(false);
    }
  };

  useEffect(() => {
    fetchMorningBrief();
  }, []);

  const raw = morningBrief?._raw || {};
  const pred = morningBrief?.nifty_open_prediction || {};
  const statusColor = morningBrief?.market_status?.includes('LONG') ? '#00ff66'
    : morningBrief?.market_status?.includes('SHORT') ? 'var(--red)' : 'var(--gold)';
  const statusEmoji = morningBrief?.market_status?.includes('LONG') ? '🟢'
    : morningBrief?.market_status?.includes('SHORT') ? '🔴' : '🟡';
  const convBg = morningBrief?.conviction === 'HIGH'
    ? 'rgba(0,255,102,0.15)' : morningBrief?.conviction === 'MEDIUM'
    ? 'rgba(201,168,76,0.15)' : 'rgba(255,77,77,0.12)';
  const convColor = morningBrief?.conviction === 'HIGH' ? '#00ff66'
    : morningBrief?.conviction === 'MEDIUM' ? 'var(--gold)' : 'var(--red)';

  const MORNING_TABS = [
    { id: 'global', label: 'Global Overnight', icon: '🌐' },
    { id: 'india', label: 'India Ready', icon: '🇮🇳' },
    { id: 'verdict', label: 'Market Verdict', icon: '⚖️' },
    { id: 'trading-plan', label: 'Trading Plan', icon: '📋' }
  ];

  return (
    <div className="w-full box-border">
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #071a0e 100%)',
        border: '1px solid var(--border-bright)',
        borderRadius: 8,
        padding: '24px 28px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: '100%',
          background: 'radial-gradient(ellipse at right, rgba(0,201,167,0.06) 0%, transparent 70%)' }} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📅</span>
          <span>{morningBrief?.date_display || new Date().toLocaleDateString('en-IN', {weekday:'long',year:'numeric',month:'long',day:'numeric'})} · {morningBrief?.briefing_time || new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})} (30 min to market open)</span>
        </div>
        <h2 style={{ margin: '0 0 16px 0', fontFamily: 'Cinzel, serif', color: 'var(--text-primary)', fontSize: 22 }}>
          Sherlock Holmes Morning Brief
        </h2>
        {morningBrief ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{statusEmoji}</span>
              <span style={{ fontFamily: 'Cinzel, serif', color: statusColor, fontSize: 18, fontWeight: 'bold', letterSpacing: '1px' }}>
                {morningBrief.market_status}
              </span>
            </div>
            <div style={{ background: convBg, border: `1px solid ${convColor}`, borderRadius: 4,
              padding: '3px 12px', fontSize: 11, fontWeight: 'bold', color: convColor, letterSpacing: '1.5px' }}>
              {morningBrief.conviction} CONVICTION
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Generate Brief" to see today's analysis</div>
        )}
      </div>

      {/* Generate Button (shown when no data) */}
      {!morningBrief && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌅</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Watson, the markets have not yet opened. Let me examine the overnight evidence.
            </div>
            <button className="btn btn-gold" style={{ minWidth: 240 }}
              onClick={fetchMorningBrief} disabled={loadingBrief}>
              {loadingBrief ? '🔍 Fetching global cues...' : '🌅 Generate Morning Brief'}
            </button>
          </div>
        </div>
      )}

      {morningBrief && (
        <div>
          {/* Sub-tabs Navigation Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end', // Align tabs to the right
            flexWrap: 'wrap',
            gap: '6px',
            padding: '4px',
            background: 'rgba(10,12,20,0.85)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            marginBottom: '24px',
            boxSizing: 'border-box'
          }}>
            {MORNING_TABS.map(tab => {
              const isActive = briefSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setBriefSubTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 12px', // btn-sm padding
                    borderRadius: '4px', // btn-sm border-radius
                    border: isActive
                      ? '1px solid #c9a84c'
                      : '1px solid rgba(201, 168, 76, 0.25)',
                    background: isActive
                      ? '#c9a84c'
                      : 'rgba(201, 168, 76, 0.03)',
                    color: isActive ? '#0a0c14' : '#c9a84c',
                    fontSize: '10px', // btn-sm font-size
                    fontFamily: "'Cinzel', 'Georgia', serif",
                    fontWeight: isActive ? '700' : '600',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(201, 168, 76, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.45)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(201, 168, 76, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.25)';
                    }
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}

          </div>

          {(briefSubTab === 'global' || briefSubTab === 'india') && (() => {
            const intra = morningBrief?.intraday_plan || {};
            const swing = morningBrief?.swing_plan || {};
            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-slate-300 font-sans leading-relaxed tracking-wide">
                
                {/* Row 1: Directives (full-width) */}
                <div className="col-span-full ds-card shadow-lg shadow-black/25">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <span className="text-xs uppercase font-mono font-bold tracking-wider ds-value--gold flex items-center gap-1.5">
                      <span>🛡️</span> The One Trade Framework Directives
                    </span>
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">SYSTEM GATEWAY STATUS: ONLINE</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="m-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: '#141722', padding: 14 }}>
                      <div className="m-label-row">
                        <span className="ds-value--gold font-mono font-bold">🎯 ONE TRADE PER DAY LIMIT</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mt-2 whitespace-pre-line break-words">
                        The gate locks permanently after 1 position. No re-entries, averaging, or second chances.
                      </p>
                      <div className="m-sub-row mt-2">
                        <span className="text-[9px] uppercase font-mono ds-value--gold opacity-80 font-bold">Priority: Critical</span>
                      </div>
                    </div>
                    <div className="m-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: '#141722', padding: 14 }}>
                      <div className="m-label-row">
                        <span className="text-emerald-500 font-mono font-bold">📈 MINIMUM 90% SETUP QUALITY</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mt-2 whitespace-pre-line break-words">
                        Only setups crossing the 90-point checklist threshold are authorized. STAND DOWN if score is lower.
                      </p>
                      <div className="m-sub-row mt-2">
                        <span className="text-[9px] uppercase font-mono text-emerald-500/80 font-bold">Priority: High</span>
                      </div>
                    </div>
                    <div className="m-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: '#141722', padding: 14 }}>
                      <div className="m-label-row">
                        <span className="text-rose-500 font-mono font-bold">🛑 ABSOLUTE SPOT COORDINATE INVALIDATION</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mt-2 whitespace-pre-line break-words">
                        If spot price breaches invalidation level or 5-min candle closes beyond SL, close position immediately.
                      </p>
                      <div className="m-sub-row mt-2">
                        <span className="text-[9px] uppercase font-mono text-rose-500/80 font-bold">Priority: Immediate</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Sub-tab specific markets data */}
                {briefSubTab === 'global' && (
                  <>
                    {/* Overnight US & Global Markets */}
                    <div className="lg:col-span-2 ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-4">
                      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                        <span className="text-xs uppercase font-mono font-bold text-slate-200">🌍 Overnight US & Global Markets</span>
                        <button className="text-[10px] font-mono bg-[#141722] border border-[#23283b] text-slate-300 hover:text-white px-2.5 py-1 rounded" onClick={fetchMorningBrief} disabled={loadingBrief}>
                          {loadingBrief ? '...' : '↻ Refresh'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            { label: 'Dow Jones',  data: raw.dow,    suffix: '' },
                            { label: 'S&P 500',    data: raw.sp500,  suffix: '' },
                            { label: 'Nasdaq',     data: raw.nasdaq, suffix: '' },
                            { label: 'Crude Oil',  data: raw.crude,  suffix: '/bbl', prefix: '$' },
                            { label: 'Gold',       data: raw.gold,   suffix: '/oz',  prefix: '$' },
                          ].map(({ label, data, suffix, prefix = '' }) => {
                            const pct = data?.change_pct ?? 0;
                            const color = pct > 0 ? 'text-[#10b981]' : pct < 0 ? 'text-[#ef4444]' : 'text-slate-500';
                            return (
                              <div key={label} className="m-card" style={{ padding: 10 }}>
                                <div className="m-label-row">
                                  <span className="truncate">{label}</span>
                                </div>
                                <div className={`m-value font-mono ${color} text-sm`}>
                                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                                </div>
                                <div className="m-sub-row text-slate-400">
                                  <span className="truncate">
                                    {prefix}{data?.price?.toLocaleString('en-IN', { maximumFractionDigits: 1 }) || '—'}{suffix}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Global Sentiment */}
                        {(() => {
                          const bias = morningBrief.global_bias;
                          const borderColor = bias === 'BULLISH' ? 'rgba(16, 185, 129, 0.25)' : bias === 'BEARISH' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)';
                          const bgColor = bias === 'BULLISH' ? 'bg-emerald-950/10' : bias === 'BEARISH' ? 'bg-rose-950/10' : 'bg-amber-950/10';
                          const textColor = bias === 'BULLISH' ? 'text-[#10b981]' : bias === 'BEARISH' ? 'text-[#ef4444]' : 'ds-value--gold';
                          return (
                            <div className={`border rounded-md p-3.5 ${bgColor}`} style={{ borderColor }}>
                              <span className={`text-xs uppercase font-mono font-bold ${textColor} block mb-1.5`}>
                                🌍 Global Sentiment: {bias}
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line break-words">{morningBrief.global_interpretation}</p>
                            </div>
                          );
                        })()}

                        {/* Catalyst */}
                        <div className="bg-[#0b0d12]/60 border border-[#23283b] rounded-md p-3.5">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1.5">⚡ Major Overnight Catalyst</span>
                          <p className="text-xs text-white italic font-serif leading-relaxed whitespace-pre-line break-words">
                            "{morningBrief.overnight_catalyst}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Key Overnight News Headlines */}
                    <div className="lg:col-span-1 ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-4">
                      <div className="border-b border-slate-800 pb-3">
                        <span className="text-xs uppercase font-mono font-bold text-slate-200">📰 Key Overnight News Headlines</span>
                      </div>
                      <div className="flex-1 divide-y divide-slate-800/60 overflow-y-auto max-h-[360px] scrollbar-thin">
                        {raw.news && raw.news.length > 0 ? (
                          raw.news.slice(0, 4).map((item, idx) => (
                            <div key={idx} className="py-3 first:pt-0 last:pb-0 flex justify-between items-start gap-4 hover:bg-white/5 transition-colors">
                              <div className="flex-1">
                                <h4 className="text-xs text-slate-200 font-sans font-medium mb-1 leading-snug break-words">{item.title}</h4>
                                <span className="text-[10px] font-mono text-slate-500">{item.source} · {item.category}</span>
                              </div>
                              <span className={`text-[9px] font-mono font-bold uppercase border px-1.5 py-0.5 rounded flex-shrink-0 ${
                                item.sentiment === 'BULLISH' ? 'text-[#10b981] border-emerald-900/50 bg-emerald-950/10' :
                                item.sentiment === 'BEARISH' ? 'text-[#ef4444] border-rose-900/50 bg-rose-950/10' :
                                'ds-value--gold border-amber-900/50 bg-amber-950/10'
                              }`}>
                                {item.sentiment}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-500">No headlines available.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {briefSubTab === 'india' && (
                  <>
                    {/* India Market Context & FII/DII Net Flow */}
                    <div className="lg:col-span-2 ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-4">
                      <div className="border-b border-slate-800 pb-3">
                        <span className="text-xs uppercase font-mono font-bold text-slate-200">🇮🇳 Domestic Market Context & Institutional Flow</span>
                      </div>
                      <div className="flex flex-col gap-4">
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>Nifty Prev Close</span>
                            </div>
                            <div className="m-value font-mono ds-value--gold">
                              ₹{(raw.nifty_current || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="m-sub-row text-slate-500">
                              <span>Previous session close</span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>SGX/Gift Nifty</span>
                            </div>
                            <div className={`m-value font-mono ${(raw.sgx_gap || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                              ₹{(raw.sgx_nifty || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="m-sub-row">
                              <span style={{ color: (raw.sgx_gap || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                {(raw.sgx_gap || 0) >= 0 ? '▲ +' : '▼ '}{raw.sgx_gap || 0} pts gap
                              </span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>USD/INR</span>
                            </div>
                            <div className={`m-value font-mono ${(raw.usdinr_change_pct || 0) <= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                              ₹{(raw.usdinr || 0).toFixed(2)}
                            </div>
                            <div className="m-sub-row">
                              <span style={{ color: (raw.usdinr_change_pct || 0) <= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                Currency variance
                              </span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>India VIX</span>
                            </div>
                            <div className={`m-value font-mono ${(raw.vix_change_pct || 0) > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                              {(raw.vix || 0).toFixed(2)}
                            </div>
                            <div className="m-sub-row">
                              <span style={{ color: (raw.vix_change_pct || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                Volatility index
                              </span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>FII Net Flow (Prev Day)</span>
                            </div>
                            <div className={`m-value font-mono ${(raw.fii_net || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                              {(raw.fii_net || 0) >= 0 ? '+' : ''}₹{(raw.fii_net || 0).toLocaleString('en-IN')} Cr
                            </div>
                            <div className="m-sub-row">
                              <span style={{ color: (raw.fii_net || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                Signal: {morningBrief.fii_signal}
                              </span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>DII Net Flow (Prev Day)</span>
                            </div>
                            <div className={`m-value font-mono ${(raw.dii_net || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                              {(raw.dii_net || 0) >= 0 ? '+' : ''}₹{(raw.dii_net || 0).toLocaleString('en-IN')} Cr
                            </div>
                            <div className="m-sub-row text-slate-500">
                              <span>Domestic Absorption</span>
                            </div>
                          </div>
                        </div>

                        {/* Sherlock's FII Read */}
                        <div className={`border rounded-md p-3.5 ${
                          (raw.fii_net || 0) >= 0 
                            ? 'border-emerald-900/20 bg-emerald-950/5' 
                            : 'border-rose-900/20 bg-rose-950/5'
                        }`}>
                          <span className="text-[10px] uppercase font-mono font-bold ds-value--gold block mb-1">🕵️‍♂️ Sherlock's FII Read</span>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line break-words">{morningBrief.fii_interpretation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Nifty 50 Pre-Open Prediction */}
                    <div className="ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-4">
                      <div className="border-b border-slate-800 pb-3">
                        <span className="text-xs uppercase font-mono font-bold text-slate-200">📈 Nifty 50 Pre-Open Prediction</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span className="truncate">Direction</span>
                            </div>
                            <div className={`m-value font-mono text-xs ${
                              pred.direction === 'GAP UP' ? 'text-[#10b981]' :
                              pred.direction === 'GAP DOWN' ? 'text-[#ef4444]' :
                              'ds-value--gold'
                            }`}>{pred.direction || '—'}</div>
                            <div className="m-sub-row text-slate-500">
                              <span>Predicted</span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span className="truncate">Gap Pts</span>
                            </div>
                            <div className={`m-value font-mono text-xs ${
                              (pred.expected_points || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                            }`}>{(pred.expected_points || 0) >= 0 ? '+' : ''}{pred.expected_points || 0}</div>
                            <div className="m-sub-row text-slate-500">
                              <span>Estimated</span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span className="truncate">Probability</span>
                            </div>
                            <div className="m-value font-mono text-xs ds-value--gold">{pred.probability || '—'}</div>
                            <div className="m-sub-row text-slate-500">
                              <span>Confidence</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>Support Level</span>
                            </div>
                            <div className="m-value font-mono text-emerald-500 text-sm">
                              ₹{(pred.support_level || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="m-sub-row text-slate-500">
                              <span>Key Floor</span>
                            </div>
                          </div>
                          <div className="m-card" style={{ padding: 10 }}>
                            <div className="m-label-row">
                              <span>Resistance Level</span>
                            </div>
                            <div className="m-value font-mono text-rose-500 text-sm">
                              ₹{(pred.resistance_level || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="m-sub-row text-slate-500">
                              <span>Key Ceiling</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-[#0b0d12]/50 border border-[#23283b] rounded p-3 text-xs text-slate-400 leading-relaxed font-sans flex-1 flex items-center italic">
                          "Watson, the calculations hint at a {(pred.direction || 'flat').toLowerCase()} open with a {(pred.probability || 'normal').toLowerCase()} probability of execution."
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Row 3: Execution Blueprint & Verdict */}
                <div className="lg:col-span-2 ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs uppercase font-mono font-bold tracking-wider text-slate-200 flex items-center gap-1.5">
                      <span>⚡</span> Trading Plan Execution Matrix
                    </span>
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">EXECUTION BLUEPRINT</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Intraday Section */}
                    <div className="m-card flex flex-col gap-3" style={{ padding: 14 }}>
                      <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                        <span className="text-xs font-mono font-bold text-white uppercase">Intraday Plan ({intra.timeframe || '15-Min'})</span>
                        <span className="text-[10px] font-mono ds-value--gold font-bold border border-amber-900/50 bg-amber-950/10 px-2 py-0.5 rounded">
                          Best Window: {intra.best_trading_window}
                        </span>
                      </div>
                      <div className="bg-[#0b0d12]/60 border border-[#23283b] rounded p-3">
                        <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Execution Strategy</span>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line break-words">{intra.entry_strategy}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <div className="bg-emerald-950/5 border border-emerald-900/20 rounded p-2.5">
                          <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Target 1</span>
                          <span className="text-sm font-mono font-bold text-[#10b981]">₹{(intra.first_target || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-rose-950/5 border border-rose-900/20 rounded p-2.5">
                          <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Stop Loss</span>
                          <span className="text-sm font-mono font-bold text-rose-500">₹{(intra.stop_loss || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Swing Section */}
                    <div className="m-card flex flex-col gap-3 justify-between" style={{ padding: 14 }}>
                      <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                        <span className="text-xs font-mono font-bold text-white uppercase">Swing Trading Plan (2-5 Days)</span>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold border border-indigo-900/50 bg-indigo-950/10 px-2 py-0.5 rounded">
                          Duration: {swing.target_days || 3} Days
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className={`text-[9px] font-mono font-bold uppercase border px-2 py-0.5 rounded ${
                          swing.hold_existing_longs ? 'text-[#10b981] border-emerald-900 bg-emerald-950/10' : 'text-rose-500 border-rose-900 bg-rose-950/10'
                        }`}>
                          Hold Longs: {swing.hold_existing_longs ? 'YES' : 'NO'}
                        </span>
                        <span className={`text-[9px] font-mono font-bold uppercase border px-2 py-0.5 rounded ${
                          swing.add_on_weakness ? 'text-[#10b981] border-emerald-900 bg-emerald-950/10' : 'text-rose-500 border-rose-900 bg-rose-950/10'
                        }`}>
                          Buy Dips: {swing.add_on_weakness ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <div className="bg-[#0b0d12]/60 border border-[#23283b] rounded p-3 flex-1 flex flex-col justify-center min-h-[90px]">
                        <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Reasoning & Bias</span>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line break-words">{swing.reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Sherlock's Deduction Verdict */}
                <div className="lg:col-span-1 ds-card shadow-lg shadow-black/25 flex flex-col gap-4">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <span className="text-xs uppercase font-mono font-bold ds-value--gold flex items-center gap-1.5">
                      <span>🕵️‍♂️</span> Sherlock's Deduction Verdict
                    </span>
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">AI DECISION SUMMARY</span>
                  </div>
                  <div className="m-card flex-1 flex flex-col justify-center bg-[#141722] border border-[#23283b]" style={{ padding: 14 }}>
                    <p className="text-xs text-slate-300 italic font-serif leading-relaxed whitespace-pre-line break-words">
                      "{morningBrief.sherlock_summary}"
                    </p>
                    {morningBrief.market_status && (
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-slate-500">BIAS STATUS</span>
                        <span className="text-[11px] font-mono font-bold ds-value--gold uppercase">
                          {morningBrief.market_status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Sectors in Focus Today */}
                <div className="lg:col-span-1 ds-card shadow-lg shadow-black/25 flex flex-col justify-between gap-3">
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-xs uppercase font-mono font-bold text-slate-200 flex items-center gap-1.5">
                      <span>🔦</span> Sectors in Focus Today
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-3">
                    <div className="flex gap-2 flex-wrap">
                      {(morningBrief.sectors_in_focus || []).map(s => (
                        <span key={s} className="bg-amber-950/10 border border-amber-900/50 ds-value--gold rounded px-2.5 py-1 text-[10px] font-mono font-bold">
                          {s}
                        </span>
                      ))}
                      {(morningBrief.sectors_in_focus || []).length === 0 && (
                        <span className="text-xs text-slate-500 italic">No sectors listed.</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line break-words mt-2">
                      {morningBrief.sector_rationale}
                    </p>
                  </div>
                </div>

                {/* Risks & Events Calendar */}
                <div className="lg:col-span-2 ds-card shadow-lg shadow-black/25 flex flex-col gap-3">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <span className="text-xs uppercase font-mono font-bold text-slate-200 flex items-center gap-1.5">
                      <span>⚠️</span> Risks & Events Calendar
                    </span>
                    <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">RISK RADAR</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    <div className="m-card bg-[#141722] border border-rose-900/30 rounded p-3 flex flex-col">
                      <div className="m-label-row border-b border-slate-800/60 pb-1.5 mb-2">
                        <span className="text-rose-500 font-mono font-bold">WARNINGS & SHOCKS</span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin max-h-[140px]">
                        {(morningBrief.red_flags || []).map((flag, i) => (
                          <div key={i} className="text-xs text-slate-300 leading-relaxed pl-3 relative">
                            <span className="absolute left-0 text-rose-500">•</span>
                            {flag}
                          </div>
                        ))}
                        {(morningBrief.red_flags || []).length === 0 && (
                          <div className="text-xs text-slate-500 italic">No critical warnings flagged.</div>
                        )}
                      </div>
                    </div>
                    
                    <EconomicCalendar events={morningBrief.key_events_today} />
                  </div>
                </div>

                {/* Next Brief Update strip */}
                <div className="col-span-full ds-card flex justify-between items-center shadow-lg shadow-black/20">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Next Scheduled System Brief Update</span>
                  <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                    <span>⏰</span> {morningBrief.next_update}
                  </span>
                </div>

              </div>
            );
          })()}

          {briefSubTab === 'verdict' && (
            <MarketVerdictTab data={morningBrief} />
          )}

          {briefSubTab === 'trading-plan' && (
            <TradingPlanTab data={morningBrief} />
          )}
        </div>
      )}
    </div>
  );
}
