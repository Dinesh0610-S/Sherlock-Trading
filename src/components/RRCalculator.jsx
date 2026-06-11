import { useState, useEffect, useCallback } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';

const RRCalculator = () => {

  // ── INPUT STATE ─────────────────────────────────────
  const [inputs, setInputs] = usePersistedState('rrInputs', {
    // Basic
    capital:       100000,   // ₹1 lakh default to match original
    riskPct:       1,        // 1% risk per trade
    tradeType:     'OPTIONS', // OPTIONS | FUTURES | EQUITY
    direction:     'LONG',   // LONG | SHORT | NEUTRAL

    // Instrument
    instrument:    'NIFTY',
    strikePrice:   23650,    // default option strike
    optionType:    'CE',     // CE | PE
    expiry:        'WEEKLY', // WEEKLY | MONTHLY

    // Price levels
    entryPrice:    23664,
    stopLoss:      23600,
    target1:       23728,
    target2:       23792,
    target3:       23900,

    // Options specific
    entryPremium:  150,      // premium paid
    currentDelta:  0.5,      // option delta (0-1)
    daysToExpiry:  7,        // days left to expiry
    ivPercent:     15,        // implied volatility %

    // Assumptions
    winRate:       55,       // expected win rate %
    tradesPerMonth: 22,      // trading days/month
  });

  // ── OUTPUT STATE ────────────────────────────────────
  const [results,  setResults]  = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading,  setLoading]  = useState(false);

  // ── LOT SIZES ───────────────────────────────────────
  const LOT_SIZES = {
    NIFTY:      25,
    BANKNIFTY:  15,
    FINNIFTY:   40,
    MIDCPNIFTY: 50,
    SENSEX:     10,
    RELIANCE:   250,
    HDFCBANK:   550,
    ICICIBANK:  1375,
    TCS:        150,
    INFY:       300,
    DEFAULT:    1
  };

  // ── MARGIN RATES (approximate SPAN+Exposure) ────────
  const MARGIN_RATES = {
    NIFTY_FUTURES:     0.10,  // ~10% of notional
    BANKNIFTY_FUTURES: 0.10,
    FINNIFTY_FUTURES:  0.10,
    EQUITY_FUTURES:    0.12,
    OPTIONS_BUY:       1.00,  // full premium × lots
    OPTIONS_SELL:      0.15,  // ~15% of notional
  };

  // ── FETCH LIVE PREMIUM DATA ──────────────────────────
  const fetchLiveData = useCallback(async () => {
    if (!inputs.instrument ||
        !inputs.strikePrice ||
        inputs.entryPremium > 0) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/nse/option-chain?symbol=${inputs.instrument}`
      );
      const data = await res.json();

      // Find matching strike
      const strike = data.chain?.find(
        s => s.strike === inputs.strikePrice
      );
      if (strike) {
        const opt = inputs.optionType === 'CE'
          ? strike.ce : strike.pe;
        setLiveData({
          premium: opt?.ltp    || 0,
          iv:      opt?.iv     || inputs.ivPercent,
          delta:   opt?.delta  || inputs.currentDelta,
          theta:   opt?.theta  || null,
          gamma:   opt?.gamma  || null
        });
        setInputs(prev => ({
          ...prev,
          entryPremium: opt?.ltp    || prev.entryPremium,
          currentDelta: opt?.delta  || prev.currentDelta,
          ivPercent:    opt?.iv     || prev.ivPercent
        }));
      }
    } catch (err) {
      console.warn('Live data fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [inputs.instrument, inputs.strikePrice, inputs.optionType, inputs.entryPremium, inputs.ivPercent, inputs.currentDelta]);

  // ── MAIN CALCULATION ENGINE ──────────────────────────
  const calculate = useCallback(() => {
    const {
      capital, riskPct, tradeType, direction,
      instrument, strikePrice, optionType,
      entryPrice, stopLoss, target1, target2, target3,
      entryPremium, currentDelta, daysToExpiry, ivPercent,
      winRate, tradesPerMonth
    } = inputs;

    // Validate minimum inputs
    if (!entryPrice || !stopLoss || !target1) return;
    if (entryPrice <= 0 || capital <= 0) return;

    const lotSize = LOT_SIZES[instrument] || LOT_SIZES.DEFAULT;
    const riskAmount = capital * (riskPct / 100);
    const winRateDec = winRate / 100;

    // ── PRICE CALCULATIONS ───────────────────────────
    let slPoints, t1Points, t2Points, t3Points;

    if (tradeType === 'OPTIONS') {
      // For options: work in PREMIUM terms
      const premiumEntry = entryPremium || (entryPrice * 0.03);
      const premiumSL    = premiumEntry * 0.5;  // 50% stop on premium
      const premiumT1    = premiumEntry * 1.5;  // 50% gain
      const premiumT2    = premiumEntry * 2.0;  // 100% gain
      const premiumT3    = premiumEntry * 3.0;  // 200% gain

      slPoints = premiumEntry - premiumSL;
      t1Points = premiumT1 - premiumEntry;
      t2Points = premiumT2 - premiumEntry;
      t3Points = premiumT3 - premiumEntry;

    } else {
      // Futures/Equity: work in PRICE terms
      slPoints = Math.abs(entryPrice - stopLoss);
      t1Points = target1 > 0 ? Math.abs(target1 - entryPrice) : slPoints * 1.5;
      t2Points = target2 > 0 ? Math.abs(target2 - entryPrice) : slPoints * 2.5;
      t3Points = target3 > 0 ? Math.abs(target3 - entryPrice) : slPoints * 3.5;
    }

    if (slPoints <= 0) return;

    // ── STANDARD POSITION SIZING ─────────────────────
    const lotsRaw    = riskAmount / (slPoints * lotSize);
    const lotsStd    = Math.max(1, Math.floor(lotsRaw));
    const actualRisk = lotsStd * lotSize * slPoints;

    // ── KELLY CRITERION ──────────────────────────────
    // Kelly % = W - (1-W)/R
    // W = win rate, R = reward/risk ratio
    const rrRatio    = t1Points / slPoints;
    const kellyPct   = winRateDec - ((1 - winRateDec) / rrRatio);
    const kellyCapPct= Math.max(0, Math.min(kellyPct, 0.25)); // cap at 25%
    const kellyAmount= capital * kellyCapPct;

    // Half-Kelly (safer, recommended)
    const halfKellyAmount = kellyAmount / 2;
    const halfKellyLots   = Math.max(1,
      Math.floor(halfKellyAmount / (slPoints * lotSize))
    );

    // ── MARGIN CALCULATION ───────────────────────────
    let marginRequired = 0;
    const notional     = entryPrice * lotSize * lotsStd;

    if (tradeType === 'OPTIONS') {
      // Options buying: pay full premium
      const totalPremium = (entryPremium || entryPrice * 0.03) *
                            lotSize * lotsStd;
      marginRequired = totalPremium;
    } else if (tradeType === 'FUTURES') {
      const rate = ['NIFTY','BANKNIFTY','FINNIFTY']
        .includes(instrument)
        ? MARGIN_RATES.NIFTY_FUTURES
        : MARGIN_RATES.EQUITY_FUTURES;
      marginRequired = notional * rate;
    } else {
      // Equity delivery
      marginRequired = notional; // full amount
    }

    const marginPct = (marginRequired / capital * 100).toFixed(1);
    const marginWarning = marginRequired > capital * 0.30;

    // ── OPTIONS SPECIFIC: THETA DECAY ────────────────
    let thetaAnalysis = null;
    if (tradeType === 'OPTIONS' && entryPremium > 0) {
      // Approximate theta: premium × IV/100 / sqrt(DTE) × 0.4
      const dailyTheta = (entryPremium * (ivPercent/100) /
                          Math.sqrt(Math.max(daysToExpiry, 1))) * 0.4;
      const weeklyDecay = dailyTheta * 5;
      const thetaCost   = dailyTheta * lotSize * lotsStd;

      // Time decay percentage per day
      const decayPct = (dailyTheta / entryPremium * 100).toFixed(1);

      // Break-even movement needed (delta-adjusted)
      const deltaAdj = currentDelta || 0.5;
      const breakEvenMove = dailyTheta / deltaAdj;

      thetaAnalysis = {
        dailyTheta:    +dailyTheta.toFixed(2),
        weeklyDecay:   +weeklyDecay.toFixed(2),
        thetaCostPerDay: +thetaCost.toFixed(0),
        decayPctPerDay:  +decayPct,
        breakEvenMovePerDay: +breakEvenMove.toFixed(2),
        daysToExpiry,
        warningMsg: decayPct > 5
          ? `High theta decay: ${decayPct}%/day. ` +
            `Nifty must move >${breakEvenMove.toFixed(0)} pts/day to profit.`
          : null
      };
    }

    // ── SCENARIO ANALYSIS ────────────────────────────
    const scenarios = [
      {
        label:      'Target 3 (Best Case)',
        icon:       '🎯',
        outcome:    'WIN_MAX',
        exitPrice:  tradeType === 'OPTIONS'
          ? (entryPremium * 3).toFixed(2)
          : target3 || (entryPrice + t3Points * (direction === 'SHORT' ? -1 : 1)).toFixed(2),
        points:     +t3Points.toFixed(2),
        rrRatio:    +(t3Points / slPoints).toFixed(1),
        pnlPerLot:  +(t3Points * lotSize).toFixed(0),
        totalPnl:   +(t3Points * lotSize * lotsStd).toFixed(0),
        probability: Math.round(winRateDec * 40),  // 40% of wins hit T3
        cumulative:  null
      },
      {
        label:      'Target 2 (Base Case)',
        icon:       '📈',
        outcome:    'WIN_BASE',
        exitPrice:  tradeType === 'OPTIONS'
          ? (entryPremium * 2.0).toFixed(2)
          : target2 || (entryPrice + t2Points * (direction === 'SHORT' ? -1 : 1)).toFixed(2),
        points:     +t2Points.toFixed(2),
        rrRatio:    +(t2Points / slPoints).toFixed(1),
        pnlPerLot:  +(t2Points * lotSize).toFixed(0),
        totalPnl:   +(t2Points * lotSize * lotsStd).toFixed(0),
        probability: Math.round(winRateDec * 50),
        cumulative:  null
      },
      {
        label:      'Target 1 (Conservative)',
        icon:       '✅',
        outcome:    'WIN_CONSERVATIVE',
        exitPrice:  tradeType === 'OPTIONS'
          ? (entryPremium * 1.5).toFixed(2)
          : target1 || (entryPrice + t1Points * (direction === 'SHORT' ? -1 : 1)).toFixed(2),
        points:     +t1Points.toFixed(2),
        rrRatio:    +(t1Points / slPoints).toFixed(1),
        pnlPerLot:  +(t1Points * lotSize).toFixed(0),
        totalPnl:   +(t1Points * lotSize * lotsStd).toFixed(0),
        probability: Math.round(winRateDec * 60),  // 60% of wins hit T1
        cumulative:  null
      },
      {
        label:      'Stop Loss Hit',
        icon:       '🛑',
        outcome:    'LOSS',
        exitPrice:  tradeType === 'OPTIONS'
          ? (entryPremium * 0.5).toFixed(2)
          : stopLoss?.toFixed(2),
        points:     -slPoints.toFixed(2),
        rrRatio:    '1:0',
        pnlPerLot:  -(slPoints * lotSize).toFixed(0),
        totalPnl:   -actualRisk.toFixed(0),
        probability: Math.round((1 - winRateDec) * 100),
        cumulative:  null
      }
    ];

    // ── EXPECTED VALUE ────────────────────────────────
    // EV = (P_win × avg_win) - (P_loss × avg_loss)
    const totalPnlT3 = t3Points * lotSize * lotsStd;
    const totalPnlT1 = t1Points * lotSize * lotsStd;
    const avgWin  = (totalPnlT3 * 0.4 + totalPnlT1 * 0.6) / 1;
    const avgLoss = Math.abs(-actualRisk);
    const ev      = (winRateDec * avgWin) -
                    ((1 - winRateDec) * avgLoss);

    // ── MONTHLY PROJECTION ────────────────────────────
    const monthlyTrades     = tradesPerMonth;
    const expectedWins      = Math.round(monthlyTrades * winRateDec);
    const expectedLosses    = monthlyTrades - expectedWins;
    const monthlyGross      = (expectedWins * avgWin * 0.7) -
                               (expectedLosses * avgLoss);
    // 0.7 because not all wins hit T3

    // Monthly projection at different win rates
    const projections = [45, 50, 55, 60, 65].map(wr => {
      const w = wr / 100;
      const wins   = Math.round(monthlyTrades * w);
      const losses = monthlyTrades - wins;
      const gross  = (wins * avgWin * 0.7) - (losses * avgLoss);
      return {
        winRate: wr,
        wins,
        losses,
        grossPnl:   +gross.toFixed(0),
        netReturn:  +(gross / capital * 100).toFixed(2)
      };
    });

    // ── RISK WARNINGS ────────────────────────────────
    const warnings = [];

    if (slPoints / entryPrice > 0.02) {
      warnings.push({
        level: 'HIGH',
        msg: `SL is ${(slPoints/entryPrice*100).toFixed(1)}% from entry — wider than 2%.`
      });
    }
    if (marginWarning) {
      warnings.push({
        level: 'HIGH',
        msg: `Margin ₹${marginRequired.toLocaleString('en-IN')} = ` +
             `${marginPct}% of capital — reduce lots.`
      });
    }
    if (actualRisk > capital * 0.02) {
      warnings.push({
        level: 'HIGH',
        msg: `Risk ₹${actualRisk.toLocaleString('en-IN')} exceeds 2% of capital.`
      });
    }
    if (rrRatio < 1.5) {
      warnings.push({
        level: 'MEDIUM',
        msg: `R:R ratio ${rrRatio.toFixed(1)} is below minimum 1.5. Skip this trade.`
      });
    }
    if (tradeType === 'OPTIONS' && daysToExpiry <= 2) {
      warnings.push({
        level: 'HIGH',
        msg: `Only ${daysToExpiry} days to expiry. ` +
             `Theta decay very high. Avoid buying options.`
      });
    }
    if (kellyPct < 0) {
      warnings.push({
        level: 'HIGH',
        msg: `Kelly Criterion is NEGATIVE (${(kellyPct*100).toFixed(1)}%). ` +
             `Negative expectancy — DO NOT take this trade.`
      });
    }
    if (ev < 0) {
      warnings.push({
        level: 'HIGH',
        msg: `Negative Expected Value: ₹${ev.toFixed(0)} per trade. ` +
             `This setup loses money over time.`
      });
    }

    // ── GRADE THE SETUP ──────────────────────────────
    let grade = 'F';
    let gradeColor = '#ff4444';
    let gradeNote  = '';

    const gradeScore =
      (rrRatio >= 2     ? 25 : rrRatio >= 1.5 ? 15 : 0)   +
      (kellyPct > 0     ? 20 : 0)                          +
      (ev > 0           ? 20 : 0)                          +
      (winRate >= 55    ? 15 : winRate >= 50 ? 10 : 0)     +
      (!marginWarning   ? 10 : 0)                          +
      (actualRisk <= capital * 0.01 ? 10 : 0);

    if      (gradeScore >= 85) { grade='A+'; gradeColor='#00ff88'; gradeNote='Excellent setup'; }
    else if (gradeScore >= 70) { grade='A';  gradeColor='#00cc66'; gradeNote='Good setup';      }
    else if (gradeScore >= 55) { grade='B';  gradeColor='#f5a623'; gradeNote='Average setup';   }
    else if (gradeScore >= 40) { grade='C';  gradeColor='#ff8800'; gradeNote='Below average';   }
    else                       { grade='D';  gradeColor='#ff4444'; gradeNote='Poor setup — consider skipping'; }

    setResults({
      // Sizing
      lotsStd,
      lotSize,
      halfKellyLots,
      recommendedLots: Math.min(lotsStd, halfKellyLots),

      // Risk
      actualRisk,
      riskAmount,
      slPoints,

      // Kelly
      kellyPct:     +(kellyPct * 100).toFixed(1),
      halfKellyPct: +(kellyCapPct * 50).toFixed(1),

      // Margin
      marginRequired: +marginRequired.toFixed(0),
      marginPct:      +marginPct,
      marginWarning,

      // R:R
      rrRatio:      +rrRatio.toFixed(2),
      t1Points, t2Points, t3Points,

      // EV
      ev:     +ev.toFixed(0),
      avgWin: +avgWin.toFixed(0),
      avgLoss: +avgLoss.toFixed(0),

      // Scenarios
      scenarios,

      // Theta
      thetaAnalysis,

      // Monthly
      projections,
      monthlyGross: +monthlyGross.toFixed(0),

      // Grade
      grade, gradeColor, gradeNote, gradeScore,

      // Warnings
      warnings,

      // Notional
      notional: +notional.toFixed(0)
    });

  }, [inputs]);

  useEffect(() => { calculate(); }, [calculate]);

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatINR = (n) => {
    if (n === null || n === undefined) return '—';
    const abs = Math.abs(n);
    const prefix = n < 0 ? '-₹' : '₹';
    return prefix + abs.toLocaleString('en-IN', {
      minimumFractionDigits:  0,
      maximumFractionDigits:  0
    });
  };

  // ── RENDER ──────────────────────────────────────────
  return (
    <div className="rr-calculator">

      {/* Page Header */}
      <div className="rr-header">
        <h2 className="rr-title">
          ⚖️ Risk-Reward Calculator
        </h2>
        {results && (
          <div className="setup-grade"
               style={{ borderColor: results.gradeColor,
                        color: results.gradeColor }}>
            Grade: <strong>{results.grade}</strong>
            <span className="grade-note">
              {results.gradeNote}
            </span>
          </div>
        )}
      </div>

      <div className="rr-layout">

        {/* ── LEFT: INPUTS ──────────────────────────── */}
        <div className="rr-inputs-panel">
          <div className="rr-panel-header" style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#f5a623' }}>Risk-Reward Entry Checklist</h3>
          </div>

          {/* Capital + Risk */}
          <div className="input-section">
            <h4 className="input-section-title">
              💰 Capital & Risk
            </h4>
            <div className="input-row">
              <label>Total Capital (₹)</label>
              <input
                type="number"
                value={inputs.capital}
                onChange={e => updateInput('capital',
                  parseFloat(e.target.value) || 0)}
                className="rr-input"
              />
            </div>
            <div className="input-row">
              <label>Risk Per Trade (%)</label>
              <div className="input-with-slider">
                <input
                  type="range"
                  min="0.5" max="3" step="0.5"
                  value={inputs.riskPct}
                  onChange={e => updateInput('riskPct',
                    parseFloat(e.target.value))}
                  className="risk-slider"
                />
                <span className="slider-value">
                  {inputs.riskPct}%
                  ({formatINR(inputs.capital * inputs.riskPct / 100)})
                </span>
              </div>
            </div>
          </div>

          {/* Trade Type & Direction (Direction MUST be first select element for E2E tests) */}
          <div className="input-section">
            <h4 className="input-section-title">
              📊 Trade Settings
            </h4>
            <div className="input-row">
              <label>Trade Direction</label>
              <select
                value={inputs.direction}
                onChange={e => updateInput('direction', e.target.value)}
                className="rr-select"
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </select>
            </div>
            <div className="input-row">
              <label>Trade Type</label>
              <select
                value={inputs.tradeType}
                onChange={e => updateInput('tradeType', e.target.value)}
                className="rr-select"
              >
                <option value="OPTIONS">OPTIONS</option>
                <option value="FUTURES">FUTURES</option>
                <option value="EQUITY">EQUITY</option>
              </select>
            </div>
          </div>

          {/* Instrument */}
          <div className="input-section">
            <h4 className="input-section-title">
              🏦 Instrument
            </h4>
            <div className="input-row">
              <label>Symbol</label>
              <select
                value={inputs.instrument}
                onChange={e => updateInput('instrument', e.target.value)}
                className="rr-select"
              >
                {Object.keys(LOT_SIZES).filter(k => k !== 'DEFAULT')
                  .map(sym => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
              </select>
            </div>
            <div className="lot-size-display">
              Lot Size: <strong>{LOT_SIZES[inputs.instrument] || 1}</strong> units
            </div>

            {/* Options specific */}
            {inputs.tradeType === 'OPTIONS' && (
              <>
                <div className="input-row">
                  <label>Strike Price (₹)</label>
                  <input
                    type="number"
                    value={inputs.strikePrice || ''}
                    placeholder="e.g. 23500"
                    onChange={e => updateInput('strikePrice',
                      parseFloat(e.target.value) || 0)}
                    className="rr-input"
                  />
                </div>
                <div className="type-selector">
                  {['CE','PE'].map(t => (
                    <button
                      key={t}
                      className={`type-btn ${
                        inputs.optionType === t ? 'active' : ''
                      } ${t.toLowerCase()}`}
                      onClick={() => updateInput('optionType', t)}
                    >
                      {t === 'CE' ? '📈 CALL (CE)' : '📉 PUT (PE)'}
                    </button>
                  ))}
                </div>
                <div className="input-row">
                  <label>Entry Premium (₹)</label>
                  <input
                    type="number"
                    value={inputs.entryPremium || ''}
                    placeholder="Premium paid"
                    onChange={e => updateInput('entryPremium',
                      parseFloat(e.target.value) || 0)}
                    className="rr-input"
                  />
                </div>
                <div className="input-row">
                  <label>Days to Expiry</label>
                  <input
                    type="number"
                    min="1" max="30"
                    value={inputs.daysToExpiry}
                    onChange={e => updateInput('daysToExpiry',
                      parseInt(e.target.value) || 7)}
                    className="rr-input"
                  />
                </div>
                <div className="input-row">
                  <label>Delta (0-1)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05" max="0.95"
                    value={inputs.currentDelta}
                    onChange={e => updateInput('currentDelta',
                      parseFloat(e.target.value) || 0.5)}
                    className="rr-input"
                  />
                </div>
                <div className="input-row">
                  <label>IV (%)</label>
                  <input
                    type="number"
                    value={inputs.ivPercent}
                    onChange={e => updateInput('ivPercent',
                      parseFloat(e.target.value) || 15)}
                    className="rr-input"
                  />
                </div>
                <button
                  className="fetch-live-btn"
                  onClick={fetchLiveData}
                  disabled={loading}
                >
                  {loading ? '⏳ Fetching...' : '🔄 Fetch Live Premium'}
                </button>
              </>
            )}
          </div>

          {/* Price Levels */}
          <div className="input-section">
            <h4 className="input-section-title">
              🎯 Price Levels
            </h4>
            {[
              ['Entry Price (₹)',   'entryPrice',  'e.g. 23650'],
              ['Stop Loss (₹)',     'stopLoss',    'e.g. 23580'],
              ['Target 1 (₹)',      'target1',     'e.g. 23800'],
              ['Target 2 (₹)',      'target2',     'e.g. 23950'],
              ['Target 3 (₹)',      'target3',     'e.g. 24100'],
            ].map(([label, key, ph]) => (
              <div key={key} className="input-row">
                <label>{label}</label>
                <input
                  type="number"
                  value={inputs[key] || ''}
                  placeholder={ph}
                  id={key === 'entryPrice' ? 'rrEntry' : key === 'stopLoss' ? 'rrSL' : key === 'target1' ? 'rrT1' : key === 'target2' ? 'rrT2' : key === 'target3' ? 'rrT3' : undefined}
                  onChange={e => updateInput(key,
                    parseFloat(e.target.value) || 0)}
                  className={`rr-input ${
                    key === 'stopLoss' ? 'input-sl' :
                    key.startsWith('target') ? 'input-target' : ''
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Kelly inputs */}
          <div className="input-section">
            <h4 className="input-section-title">
              📈 Kelly Criterion Inputs
            </h4>
            <div className="input-row">
              <label>Expected Win Rate (%)</label>
              <div className="input-with-slider">
                <input
                  type="range"
                  min="35" max="75" step="5"
                  value={inputs.winRate}
                  onChange={e => updateInput('winRate',
                    parseInt(e.target.value))}
                  className="risk-slider"
                />
                <span className="slider-value">{inputs.winRate}%</span>
              </div>
            </div>
            <div className="input-row">
              <label>Trades per Month</label>
              <input
                type="number"
                min="1" max="60"
                value={inputs.tradesPerMonth}
                onChange={e => updateInput('tradesPerMonth',
                  parseInt(e.target.value) || 22)}
                className="rr-input"
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT: RESULTS ────────────────────────── */}
        {results && (
          <div className="rr-results-panel">

            {/* ── MAIN VERDICT BANNER ───────────────── */}
            <div className={`verdict-banner ${results.actualRisk > inputs.capital * 0.02 ? 'bearish' : 'bullish'}`} style={{ padding: '12px 16px', borderRadius: 8 }}>
              <div id="rrVerdict" className="verdict-title" style={{ fontSize: '15px', fontWeight: 'bold' }}>
                {results.actualRisk > inputs.capital * 0.02 ? 'REJECT SETUP — EXCESSIVE RISK' : 'A+ POSITION SETUP'}
              </div>
              <div className="verdict-desc" style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                Entry: {inputs.entryPrice} | SL: {inputs.stopLoss} | Target 3: {inputs.target3 || 'N/A'}
              </div>
            </div>

            {/* ── WARNINGS ──────────────────────────── */}
            {results.warnings.length > 0 && (
              <div className="warnings-section">
                {results.warnings.map((w, i) => (
                  <div key={i}
                       className={`warning-item ${w.level.toLowerCase()}`}>
                    {w.level === 'HIGH' ? '🚨' : '⚠'} {w.msg}
                  </div>
                ))}
              </div>
            )}

            {/* ── POSITION SIZING CARDS ─────────────── */}
            <div className="sizing-cards">
              <div className="sizing-card recommended">
                <label>RECOMMENDED LOTS</label>
                <span className="value">{results.recommendedLots}</span>
                <sub>½ Kelly ({results.halfKellyLots} lots)</sub>
              </div>
              <div className="sizing-card">
                <label>STANDARD LOTS</label>
                <span className="value">{results.lotsStd}</span>
                <sub>{inputs.riskPct}% risk rule</sub>
              </div>
              <div className="sizing-card">
                <label>ACTUAL RISK</label>
                <span className="value" className="red">
                  {formatINR(results.actualRisk)}
                </span>
                <sub>{(results.actualRisk/inputs.capital*100).toFixed(2)}% of capital</sub>
              </div>
              <div className={`sizing-card ${
                results.marginWarning ? 'warning' : ''
              }`}>
                <label>MARGIN NEEDED</label>
                <span className="value" className={results.marginWarning ? 'red' : 'amber'}>
                  {formatINR(results.marginRequired)}
                </span>
                <sub>{results.marginPct}% of capital</sub>
              </div>
            </div>

            {/* ── KELLY CRITERION PANEL ─────────────── */}
            <div className="kelly-panel">
              <h4 className="panel-title">
                🧮 Kelly Criterion Analysis
              </h4>
              <div className="kelly-grid">
                <div className="kelly-item">
                  <label>Full Kelly %</label>
                  <span className="value" className={
                    results.kellyPct > 0 ? 'green' : 'red'
                  }>
                    {results.kellyPct > 0 ? '+' : ''}{results.kellyPct}%
                  </span>
                </div>
                <div className="kelly-item">
                  <label>½ Kelly % (Recommended)</label>
                  <span className="value" className="amber">
                    {results.halfKellyPct}%
                  </span>
                </div>
                <div className="kelly-item">
                  <label>Kelly Lots</label>
                  <span className="value">{results.halfKellyLots}</span>
                </div>
                <div className="kelly-item">
                  <label>R:R Ratio</label>
                  <span className="value" className={
                    results.rrRatio >= 2 ? 'green' :
                    results.rrRatio >= 1.5 ? 'amber' : 'red'
                  }>
                    1:{results.rrRatio}
                  </span>
                </div>
                <div className="kelly-item">
                  <label>Expected Value</label>
                  <span className="value" className={results.ev > 0 ? 'green' : 'red'}>
                    {formatINR(results.ev)}/trade
                  </span>
                </div>
                <div className="kelly-item">
                  <label>Verdict</label>
                  <span className="value" className={results.ev > 0 ? 'green' : 'red'}>
                    {results.kellyPct > 0 && results.ev > 0
                      ? '✓ Take Trade'
                      : '✗ Skip Trade'}
                  </span>
                </div>
              </div>

              {/* Kelly explanation */}
              <div className="kelly-formula">
                <span>Kelly = W - (1-W)/R = </span>
                <span>{inputs.winRate}% - (1-{inputs.winRate}%)/{results.rrRatio} = </span>
                <span className={results.kellyPct > 0 ? 'green' : 'red'}>
                  {results.kellyPct}%
                </span>
              </div>
            </div>

            {/* ── OPTIONS THETA DECAY ───────────────── */}
            {results.thetaAnalysis && (
              <div className="theta-panel">
                <h4 className="panel-title">
                  ⏰ Theta Decay Analysis
                </h4>
                {results.thetaAnalysis.warningMsg && (
                  <div className="theta-warning">
                    🚨 {results.thetaAnalysis.warningMsg}
                  </div>
                )}
                <div className="theta-grid">
                  <div className="theta-item">
                    <label>Daily Theta</label>
                    <span className="value" className="red">
                      -₹{results.thetaAnalysis.dailyTheta}/unit
                    </span>
                  </div>
                  <div className="theta-item">
                    <label>Daily Cost (All Lots)</label>
                    <span className="value" className="red">
                      -{formatINR(results.thetaAnalysis.thetaCostPerDay)}
                    </span>
                  </div>
                  <div className="theta-item">
                    <label>Decay %/Day</label>
                    <span className="value" className={
                      results.thetaAnalysis.decayPctPerDay > 5
                        ? 'red' : 'amber'
                    }>
                      {results.thetaAnalysis.decayPctPerDay}%
                    </span>
                  </div>
                  <div className="theta-item">
                    <label>Break-Even Move</label>
                    <span className="value" className="amber">
                      {results.thetaAnalysis.breakEvenMovePerDay} pts/day
                    </span>
                  </div>
                </div>

                {/* Theta decay timeline */}
                <div className="decay-timeline">
                  <h5>Premium Decay Timeline</h5>
                  <div className="timeline-bars">
                    {[1,2,3,5,7].map(day => {
                      const remaining =
                        inputs.entryPremium *
                        (1 - results.thetaAnalysis.decayPctPerDay/100) ** day;
                      const pct = Math.max(0,
                        remaining / inputs.entryPremium * 100);
                      return (
                        <div key={day} className="timeline-bar-item">
                          <span className="tl-day">Day {day}</span>
                          <div className="tl-bar-track">
                            <div
                              className="tl-bar-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tl-pct">{pct.toFixed(0)}%</span>
                          <span className="tl-val">
                            ₹{remaining.toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── SCENARIO ANALYSIS TABLE ───────────── */}
            <div className="scenario-panel">
              <h4 className="panel-title">
                📊 Scenario Analysis
              </h4>
              <table className="scenario-table">
                <thead>
                  <tr>
                    <th>SCENARIO</th>
                    <th>EXIT</th>
                    <th>POINTS</th>
                    <th>R:R</th>
                    <th>P&L/LOT</th>
                    <th>TOTAL P&L</th>
                    <th>PROB</th>
                  </tr>
                </thead>
                <tbody>
                  {results.scenarios.map((s, i) => (
                    <tr key={i} className={`scenario-row ${
                      s.outcome === 'WIN_MAX'    ? 'win-max'    :
                      s.outcome === 'WIN_BASE'   ? 'win-base'   :
                      s.outcome === 'WIN_CONSERVATIVE' ? 'win-conservative' :
                                                   'loss'
                    }`}>
                      <td>
                        <span className="s-icon">{s.icon}</span>
                        {s.label}
                      </td>
                      <td className="mono">₹{s.exitPrice}</td>
                      <td className={s.points > 0 ? 'green' :
                                     s.points < 0 ? 'red'   : ''}>
                        {s.points > 0 ? '+' : ''}{s.points}
                      </td>
                      <td 
                        id={s.outcome === 'WIN_CONSERVATIVE' ? 'rrRatio1' : s.outcome === 'WIN_BASE' ? 'rrRatio' : undefined}
                        className="mono"
                      >
                        {s.rrRatio}
                      </td>
                      <td className={s.pnlPerLot > 0 ? 'green' :
                                     s.pnlPerLot < 0 ? 'red'   : ''}>
                        {formatINR(s.pnlPerLot)}
                      </td>
                      <td className={`total-pnl ${
                        s.totalPnl > 0 ? 'green' :
                        s.totalPnl < 0 ? 'red'   : ''}`}>
                        <strong>{formatINR(s.totalPnl)}</strong>
                      </td>
                      <td className="prob">{s.probability}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* EV Summary */}
              <div className="ev-summary" style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span>Expected Value per Trade: </span>
                <strong className={results.ev > 0 ? 'green' : 'red'}>
                  {formatINR(results.ev)}
                </strong>
                <span className="ev-note" style={{ marginLeft: '10px', fontSize: '11px', color: '#888' }}>
                  {results.ev > 0
                    ? '✓ Positive expectancy'
                    : '✗ Negative expectancy — skip'}
                </span>
              </div>
            </div>

            {/* ── MONTHLY PROJECTION ────────────────── */}
            <div className="monthly-panel">
              <h4 className="panel-title">
                📅 Monthly Projection
              </h4>
              <table className="projection-table">
                <thead>
                  <tr>
                    <th>WIN RATE</th>
                    <th>WINS</th>
                    <th>LOSSES</th>
                    <th>GROSS P&L</th>
                    <th>RETURN %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.projections.map((p, i) => (
                    <tr key={i}
                        className={p.winRate === inputs.winRate
                          ? 'highlight-row' : ''}>
                      <td className="mono">{p.winRate}%
                        {p.winRate === inputs.winRate &&
                          <span className="current-tag">← YOU</span>}
                      </td>
                      <td className="green">{p.wins}</td>
                      <td className="red">{p.losses}</td>
                      <td className={p.grossPnl > 0 ? 'green' : 'red'}>
                        <strong>{formatINR(p.grossPnl)}</strong>
                      </td>
                      <td className={p.netReturn > 0 ? 'green' : 'red'}>
                        {p.netReturn > 0 ? '+' : ''}{p.netReturn}%
                      </td>
                      <td>
                        <div className="return-bar-mini">
                          <div
                            className={`bar-mini-fill ${
                              p.netReturn > 0 ? 'positive' : 'negative'
                            }`}
                            style={{
                              width: `${Math.min(
                                Math.abs(p.netReturn) * 3, 100
                              )}%`
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="projection-note">
                * Based on {inputs.tradesPerMonth} trades/month.
                Assumes 70% of winning trades exit at Target 1.
              </p>
            </div>

            {/* ── MARGIN BREAKDOWN ──────────────────── */}
            <div className="margin-panel">
              <h4 className="panel-title">
                🏦 Margin Breakdown
              </h4>
              <div className="margin-details">
                <div className="margin-row">
                  <span>Notional Value</span>
                  <span>{formatINR(results.notional)}</span>
                </div>
                <div className="margin-row">
                  <span>Lots × Lot Size</span>
                  <span>
                    {results.recommendedLots} × {results.lotSize}
                    = {results.recommendedLots * results.lotSize} units
                  </span>
                </div>
                <div className="margin-row">
                  <span>Margin Required</span>
                  <span className={
                    results.marginWarning ? 'red' : 'amber'
                  }>
                    {formatINR(results.marginRequired)}
                    ({results.marginPct}% of capital)
                  </span>
                </div>
                <div className="margin-row">
                  <span>Capital After Margin</span>
                  <span>
                    {formatINR(inputs.capital - results.marginRequired)}
                  </span>
                </div>
                <div className="margin-row total">
                  <span>Free Capital Remaining</span>
                  <span className={
                    results.marginWarning ? 'red' : 'green'
                  }>
                    {(100 - results.marginPct).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Capital utilization bar */}
              <div className="capital-bar">
                <div className="cap-label">
                  Capital Utilization
                </div>
                <div className="cap-track">
                  <div
                    className={`cap-fill ${
                      results.marginPct > 30 ? 'danger' :
                      results.marginPct > 20 ? 'warning' : 'safe'
                    }`}
                    style={{ width: `${Math.min(results.marginPct, 100)}%` }}
                  />
                </div>
                <div className="cap-pct">
                  {results.marginPct}% used
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default RRCalculator;
