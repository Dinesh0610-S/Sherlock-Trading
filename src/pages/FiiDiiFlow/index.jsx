import React, { useState, useEffect } from 'react';
import { 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  Legend as RechartsLegend,
  XAxis as RechartsXAxis, 
  YAxis as RechartsYAxis, 
  CartesianGrid as RechartsCartesianGrid, 
  Tooltip as RechartsTooltip, 
  ReferenceLine as RechartsReferenceLine, 
  ResponsiveContainer as RechartsResponsiveContainer 
} from 'recharts';

export default function FiiDiiFlow() {
  const [fiiDiiData, setFiiDiiData] = useState([]);
  const [fiiDiiToday, setFiiDiiToday] = useState(null);
  const [fiiDiiLiveClock, setFiiDiiLiveClock] = useState('');
  const [fiiDiiLastFetch, setFiiDiiLastFetch] = useState(null);
  const [loadingFiiDii, setLoadingFiiDii] = useState(false);
  const [fiiDiiAnalysis, setFiiDiiAnalysis] = useState(null);
  const [analyzingFiiDii, setAnalyzingFiiDii] = useState(false);
  const [fiiDiiActiveSubTab, setFiiDiiActiveSubTab] = useState('today');
  const [fiiDiiError, setFiiDiiError] = useState(null);
  const [isRefreshingFiiDii, setIsRefreshingFiiDii] = useState(false);
  const [fiiDiiLastCachedTime, setFiiDiiLastCachedTime] = useState(null);
  const [fiiDiiSectorFlow, setFiiDiiSectorFlow] = useState(null);
  const [ledgerLimit, setLedgerLimit] = useState(30);

  // Memoize FII/DII daily trend calculations
  const chartData = React.useMemo(() => {
    const reversedHistory = [...fiiDiiData].reverse();
    return reversedHistory.map(h => {
      const parts = h.date.split('-');
      const formattedDate = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : h.date;
      return {
        date: formattedDate,
        fii: h.fii_net,
        dii: h.dii_net
      };
    });
  }, [fiiDiiData]);

  // Memoize FII/DII cumulative trend calculations
  const cumulativeChartData = React.useMemo(() => {
    const last30 = fiiDiiData.slice(0, 30);
    const chronological30 = [...last30].reverse();
    let cumulativeFii = 0;
    let cumulativeDii = 0;
    return chronological30.map(h => {
      cumulativeFii += (h.fii_net || 0);
      cumulativeDii += (h.dii_net || 0);
      const parts = h.date.split('-');
      const formattedDate = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : h.date;
      return {
        date: formattedDate,
        fiiCumulative: cumulativeFii,
        diiCumulative: cumulativeDii
      };
    });
  }, [fiiDiiData]);

  // Memoize FII/DII 22-day average trend metrics
  const trendMetrics = React.useMemo(() => {
    const trendDays = fiiDiiData.slice(0, 22);
    const totalDays = trendDays.length;
    const fiiAvg = totalDays > 0 ? (trendDays.reduce((acc, h) => acc + h.fii_net, 0) / totalDays) : 0;
    const diiAvg = totalDays > 0 ? (trendDays.reduce((acc, h) => acc + h.dii_net, 0) / totalDays) : 0;
    const fiiBuyDays = trendDays.filter(h => h.fii_net > 0).length;
    return { fiiAvg, diiAvg, fiiBuyDays, totalDays };
  }, [fiiDiiData]);

  // ── Consistent INR formatter: always 2 decimal places ──
  const formatINR = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return Math.abs(value).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // CORRECT date formatting for India
  const formatDateIST = (dateInput) => {
    let date;
    if (dateInput) {
      date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        if (typeof dateInput === 'string' && dateInput.includes('-')) {
          const parts = dateInput.split('-');
          if (parts.length === 3) {
            const months = {
              jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
              jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
            };
            const d = parseInt(parts[0]);
            const m = months[parts[1].toLowerCase()];
            const y = parseInt(parts[2]);
            if (!isNaN(d) && m !== undefined && !isNaN(y)) {
              date = new Date(Date.UTC(y, m, d));
            }
          }
        }
      }
    } else {
      date = new Date();
    }

    if (!date || isNaN(date.getTime())) {
      date = new Date();
    }

    let istDate;
    try {
      istDate = new Date(
        date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      );
    } catch (e) {
      istDate = date;
    }

    const day   = String(istDate.getDate()).padStart(2, '0');
    const month = istDate.toLocaleString('en-IN', {
      month: 'short',
      timeZone: 'Asia/Kolkata'
    }).toUpperCase();
    const year  = istDate.getFullYear();

    if (year < 2020 || year > 2030) {
      console.error(`Invalid year detected: ${year}. Using system date.`);
      const now = new Date();
      const y   = now.getFullYear();
      const m   = now.toLocaleString('en-IN',
        { month:'short', timeZone:'Asia/Kolkata' }).toUpperCase();
      const d   = String(now.getDate()).padStart(2, '0');
      return `${d}-${m}-${y}`;
    }

    return `${day}-${month}-${year}`;
  };

  const fetchFiiDii = async () => {
    setLoadingFiiDii(true);
    setFiiDiiError(null);
    try {
      // Fetch Sector Flow
      try {
        const sectorRes = await fetch(`/api/nse/sector-flow?_t=${Date.now()}`);
        if (sectorRes.ok) {
          const sectorData = await sectorRes.json();
          setFiiDiiSectorFlow(sectorData);
        }
      } catch (secErr) {
        console.warn('Sector flow fetch failed:', secErr);
      }

      // 1. Fetch Today's Flow (enriched API response)
      const todayRes = await fetch(`/api/fiidii/today?_t=${Date.now()}`);
      if (!todayRes.ok) {
        throw new Error('Live FII/DII data unavailable — NSE session expired. Retrying...');
      }
      const todayData = await todayRes.json();
      if (todayData.error) {
        throw new Error(todayData.message || 'Live FII/DII data unavailable — NSE session expired. Retrying...');
      }

      setFiiDiiToday(todayData);
      setFiiDiiLastFetch(new Date());

      // 2. Fetch History
      let historyData = [];
      try {
        const historyRes = await fetch(`/api/fiidii/history?_t=${Date.now()}`);
        if (historyRes.ok) {
          const resJson = await historyRes.json();
          const rawHistory = Array.isArray(resJson) ? resJson : (resJson.data || []);
          if (Array.isArray(rawHistory)) {
            historyData = rawHistory.map(item => {
              const fBuy  = parseFloat(item.fii_buy  || item.fiiBuy  || item.buyValue  || 0);
              const fSell = parseFloat(item.fii_sell || item.fiiSell || item.sellValue || 0);
              const fNet  = parseFloat(item.fii_net  || item.fiiNet  || item.netValue  || (fBuy - fSell));
              const dBuy  = parseFloat(item.dii_buy  || item.diiBuy  || item.buyValue  || 0);
              const dSell = parseFloat(item.dii_sell || item.diiSell || item.sellValue || 0);
              const dNet  = parseFloat(item.dii_net  || item.diiNet  || item.netValue  || (dBuy - dSell));
              return {
                date: item.date || item.tradeDate || '',
                fii_buy: fBuy, fii_sell: fSell, fii_net: fNet,
                dii_buy: dBuy, dii_sell: dSell, dii_net: dNet
              };
            }).filter(item => item.date);
          }
        }
      } catch (histErr) {
        console.warn('History fetch failed, using today only:', histErr);
      }

      // 3. Build combined array for trend chart (today + history)
      const todayMapped = {
        date:     todayData.date,
        fii_buy:  todayData.fii.buy,
        fii_sell: todayData.fii.sell,
        fii_net:  todayData.fii.net,
        dii_buy:  todayData.dii.buy,
        dii_sell: todayData.dii.sell,
        dii_net:  todayData.dii.net,
        isToday:  true
      };
      const filteredHistory = historyData.filter(item => item.date !== todayMapped.date);
      setFiiDiiData([todayMapped, ...filteredHistory]);
      setFiiDiiLastCachedTime(todayData.last_updated || new Date().toLocaleTimeString('en-IN'));
      setFiiDiiError(null);
    } catch (e) {
      console.error('Error fetching FII/DII flows:', e);
      setFiiDiiError(e.message || 'Live FII/DII data unavailable — NSE session expired. Retrying...');
    } finally {
      setLoadingFiiDii(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshingFiiDii(true);
    try {
      await fetch('/api/fiidii/refresh-session', { method: 'POST' });
      await fetchFiiDii();
    } catch (err) {
      console.error('Error in force refresh:', err);
    } finally {
      setIsRefreshingFiiDii(false);
    }
  };

  const [fiiDiiAnalysisTime, setFiiDiiAnalysisTime] = useState(null);

  const handleAnalyzeFiiDii = async () => {
    if (fiiDiiData.length === 0) return;

    setFiiDiiAnalysis({
      combined_bias: "CALCULATING...",
      confidence: 0,
      fii_signal: "CALCULATING...",
      dii_signal: "CALCULATING...",
      action: "CALCULATING...",
      fii_interpretation: "Sherlock is examining the ledger...",
      dii_interpretation: "Sherlock is examining the ledger...",
      market_implication: "Sherlock is examining the ledger...",
      intraday_bias: "NEUTRAL",
      swing_bias: "NEUTRAL",
      momentum: "STEADY",
      red_flag: "None"
    });
    setAnalyzingFiiDii(true);

    try {
      const todayFlow = fiiDiiData[0];
      const res = await fetch('/api/fii-dii/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fii_buy: todayFlow.fii_buy,
          fii_sell: todayFlow.fii_sell,
          dii_buy: todayFlow.dii_buy,
          dii_sell: todayFlow.dii_sell,
          history: fiiDiiData.slice(1)
        })
      });

      if (!res.ok) {
        throw new Error("Failed to connect to flow analysis engine.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedAnalysis = {
        combined_bias: "NEUTRAL",
        confidence: 0,
        fii_signal: "NEUTRAL",
        dii_signal: "NEUTRAL",
        action: "HOLD",
        fii_interpretation: "",
        dii_interpretation: "",
        market_implication: "",
        intraday_bias: "NEUTRAL",
        swing_bias: "NEUTRAL",
        momentum: "STEADY",
        red_flag: "None"
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'metadata') {
              const meta = parsed.data;
              accumulatedAnalysis = {
                ...accumulatedAnalysis,
                combined_bias: meta.verdict || "NEUTRAL",
                action: meta.recommended_action || "HOLD",
                red_flag: (Array.isArray(meta.risk_flags) && meta.risk_flags.length > 0) ? meta.risk_flags.join(', ') : (meta.red_flag || "None"),
                confidence: meta.confidence > 1 ? meta.confidence / 100 : (meta.confidence || 0.5),
                fii_signal: meta.fii_signal || "NEUTRAL",
                dii_signal: meta.dii_signal || "NEUTRAL",
                intraday_bias: meta.intraday_bias || "NEUTRAL",
                swing_bias: meta.swing_bias || "NEUTRAL",
                momentum: meta.momentum || "STEADY"
              };
              setFiiDiiAnalysis({ ...accumulatedAnalysis });
            } else if (parsed.type === 'delta') {
              const { field, text } = parsed;
              accumulatedAnalysis[field] = (accumulatedAnalysis[field] || '') + text;
              setFiiDiiAnalysis({ ...accumulatedAnalysis });
            }
          } catch (err) {
            console.error("Error parsing analysis token chunk:", err);
          }
        }
      }
      setFiiDiiAnalysisTime(Date.now());
    } catch (e) {
      console.error('Error analyzing FII/DII flows:', e);
      setFiiDiiAnalysis(prev => prev ? {
        ...prev,
        fii_interpretation: "Watson, it seems our connection to the flow engines has dropped.",
        dii_interpretation: "Watson, it seems our connection to the flow engines has dropped.",
        market_implication: "Flow interpretation is currently unavailable."
      } : null);
    } finally {
      setAnalyzingFiiDii(false);
    }
  };

  // Clock tick
  useEffect(() => {
    const tick = () => {
      const ist = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Asia/Kolkata', hour12: true
      });
      setFiiDiiLiveClock(ist);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch FII/DII initially and auto-refresh
  useEffect(() => {
    fetchFiiDii();
    const getInterval = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const h = ist.getHours(), m = ist.getMinutes(), dw = ist.getDay();
      const open = dw >= 1 && dw <= 5 &&
                   (h > 9 || (h === 9 && m >= 15)) &&
                   (h < 15 || (h === 15 && m <= 30));
      return open ? 60_000 : 300_000;
    };
    const id = setInterval(() => fetchFiiDii(), getInterval());
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">💰 FII/DII Daily Flow Panel</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${fiiDiiActiveSubTab === 'today' ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => setFiiDiiActiveSubTab('today')}
            >
              Today's flow
            </button>
            <button
              className={`btn btn-sm ${fiiDiiActiveSubTab === 'trend' ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => setFiiDiiActiveSubTab('trend')}
            >
              30-day trend
            </button>
            <button
              className={`btn btn-sm ${fiiDiiActiveSubTab === 'verdict' ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => setFiiDiiActiveSubTab('verdict')}
            >
              AI verdict
            </button>
          </div>
        </div>
      </div>

      {fiiDiiError && fiiDiiData.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#ffaa00', border: '1px dashed rgba(255, 170, 0, 0.4)', background: 'rgba(255, 170, 0, 0.03)' }}>
          <span style={{ fontSize: 24, display: 'block', marginBottom: 12 }}>⚠️</span>
          {fiiDiiError}
        </div>
      ) : loadingFiiDii && fiiDiiData.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Watson, fetching the FII/DII flows. One moment...
        </div>
      ) : fiiDiiData.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No FII/DII flow records found.
        </div>
      ) : (
        <div>
          {fiiDiiError && (
            <div className="alert alert-warning" style={{
              background: 'rgba(255,170,0,0.08)',
              border: '1px solid rgba(255,170,0,0.25)',
              color: '#ffaa00',
              borderRadius: 4,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⚠️</span>
              <span>Live FII/DII data unavailable — NSE session expired. Retrying... Last known: {fiiDiiLastCachedTime}</span>
            </div>
          )}

          {fiiDiiActiveSubTab === 'today' && (() => {
            const api = fiiDiiToday;
            const today = fiiDiiData[0];
            if (!api && !today) return null;

            const fiiBuy  = api?.fii?.buy  ?? today?.fii_buy  ?? 0;
            const fiiSell = api?.fii?.sell ?? today?.fii_sell ?? 0;
            const fiiNet  = api?.fii?.net  ?? (fiiBuy - fiiSell);
            const diiBuy  = api?.dii?.buy  ?? today?.dii_buy  ?? 0;
            const diiSell = api?.dii?.sell ?? today?.dii_sell ?? 0;
            const diiNet  = api?.dii?.net  ?? (diiBuy - diiSell);
            const combNet = api?.combined_net ?? (fiiNet + diiNet);

            const getStreak = (data, field) => {
              if (!data || data.length === 0) return { count: 0, type: 'NEUTRAL' };
              const firstVal = data[0][field];
              if (firstVal === undefined || firstVal === null || isNaN(firstVal) || firstVal === 0) return { count: 0, type: 'NEUTRAL' };
              const isPositive = firstVal > 0;
              let count = 0;
              for (let i = 0; i < data.length; i++) {
                const val = data[i][field];
                if (val === undefined || val === null || isNaN(val)) break;
                if (isPositive && val > 0) count++;
                else if (!isPositive && val < 0) count++;
                else break;
              }
              return { count, type: isPositive ? 'BUY' : 'SELL' };
            };

            const get5dSum = (data, field) => {
              if (!data || data.length === 0) return 0;
              return data.slice(0, 5).reduce((acc, curr) => acc + (curr[field] || 0), 0);
            };

            const fiiStreak = getStreak(fiiDiiData, 'fii_net');
            const diiStreak = getStreak(fiiDiiData, 'dii_net');
            const fiiMom5d = get5dSum(fiiDiiData, 'fii_net');
            const diiMom5d = get5dSum(fiiDiiData, 'dii_net');

            const isDivergent = (fiiNet > 0 && diiNet < 0) || (fiiNet < 0 && diiNet > 0);
            const divergenceType = isDivergent 
              ? (fiiNet > 0 ? 'FII_BUY_DII_SELL' : 'DII_BUY_FII_SELL')
              : (fiiNet > 0 ? 'CO_BUY' : 'CO_SELL');

            const displayDate = formatDateIST(api?.date || today?.date);
            const isStale = api && api.isStale;

            const alignment = api?.alignment || (() => {
              if (fiiNet > 0 && diiNet > 0) return { type: 'BULLISH', label: '🟢 BULLISH ALIGNMENT', desc: 'Both FII and DII are buying. Strong institutional conviction.' };
              if (fiiNet < 0 && diiNet < 0) return { type: 'BEARISH', label: '🔴 BEARISH ALIGNMENT', desc: 'Both FII and DII are selling. Joint institutional distribution.' };
              if (fiiNet < 0 && diiNet > 0) return { type: 'MIXED_DII', label: '🟡 MIXED (DII Buying, FII Selling)', desc: 'Domestic support absorbing foreign distribution.' };
              return { type: 'MIXED_FII', label: '🟡 MIXED (FII Buying, DII Selling)', desc: 'Foreign inflow despite domestic caution.' };
            })();

            const alignmentColor = alignment.color || (alignment.type === 'BULLISH' ? 'var(--green)'
              : alignment.type === 'BEARISH' ? 'var(--red)' : 'var(--gold)');

            const fiiText = api?.fii?.interpretation || (() => {
              const pct = fiiSell > 0 ? ((Math.abs(fiiBuy - fiiSell) / fiiSell) * 100).toFixed(1) : '0.0';
              return `FII is ${fiiNet > 0 ? 'accumulating' : 'distributing'}. Buy volume (₹${formatINR(fiiBuy)} cr) is ${pct}% ${fiiNet > 0 ? 'higher' : 'lower'} than sell volume.`;
            })();
            const diiText = api?.dii?.interpretation || (() => {
              const pct = diiSell > 0 ? ((Math.abs(diiBuy - diiSell) / diiSell) * 100).toFixed(1) : '0.0';
              return `DII is ${diiNet > 0 ? 'accumulating' : 'distributing'}. Buy volume (₹${formatINR(diiBuy)} cr) is ${pct}% ${diiNet > 0 ? 'higher' : 'lower'} than sell volume.`;
            })();

            return (
              <div>
                {/* Date Header */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--text-primary)' }}>
                      <span className="date-display">{displayDate}</span>
                    </h3>
                    {api?.marketStatus === 'OPEN' && (
                      <span className="market-status-badge open">
                        ● MARKET OPEN
                      </span>
                    )}
                    {api?.marketStatus === 'PRE_MARKET' && (
                      <span className="market-status-badge pre_market">
                        ◐ PRE-MARKET
                      </span>
                    )}
                    {api?.marketStatus === 'WEEKEND' && (
                      <span className="market-status-badge weekend">
                        ■ WEEKEND
                      </span>
                    )}
                    {api?.marketStatus === 'CLOSED' && (
                      <span className="market-status-badge closed">
                        ■ MARKET CLOSED
                      </span>
                    )}
                    {!api && (
                      <span className="market-status-badge closed">
                        ■ MARKET CLOSED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                      Live as of {fiiDiiLiveClock}
                    </span>
                    <button
                      className={`btn btn-secondary btn-sm refresh-btn ${isRefreshingFiiDii ? 'spinning' : ''}`}
                      onClick={handleForceRefresh}
                      disabled={isRefreshingFiiDii || loadingFiiDii}
                      style={{ fontSize: 11 }}
                    >
                      {isRefreshingFiiDii ? '⏳' : '↻'} Refresh
                    </button>
                  </div>
                </div>

                {/* Sanity Error Warning */}
                {api?.sanityErrors && (
                  <div className="sanity-warning" style={{ marginBottom: 16 }}>
                    ⚠️ Data anomaly detected: {api.sanityErrors.join('. ')}. Verify on NSE website before trading decisions.
                  </div>
                )}

                {/* Stale data warning */}
                {isStale && (
                  <div className="stale-banner" style={{ marginBottom: 16 }}>
                    ⚠️ Live data unavailable. Showing data from {api.date} ({api.staleAgeHrs}h ago).
                    <button onClick={handleForceRefresh} className="inline-retry" disabled={isRefreshingFiiDii}>
                      {isRefreshingFiiDii ? '⏳' : 'Retry Now'}
                    </button>
                  </div>
                )}

                {/* Today's data warning */}
                {api && !api.isToday && !isStale && (
                  <div className="date-warning-banner" style={{ marginBottom: 16 }}>
                    ℹ️ NSE may not have updated today's data yet. Showing latest available ({api.date}). Data typically updates after market opens at 09:15 IST.
                  </div>
                )}

                {/* Top Metric Cards */}
                <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                  <div className="metric-card">
                    <div className="metric-label">FII NET</div>
                    <div className={`metric-value ${fiiNet >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                      {fiiNet >= 0 ? '+' : '-'}₹{formatINR(fiiNet)} cr
                    </div>
                    <div className="metric-sub">
                      Buy ₹{formatINR(fiiBuy)} | Sell ₹{formatINR(fiiSell)}
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">DII NET</div>
                    <div className={`metric-value ${diiNet >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                      {diiNet >= 0 ? '+' : '-'}₹{formatINR(diiNet)} cr
                    </div>
                    <div className="metric-sub">
                      Buy ₹{formatINR(diiBuy)} | Sell ₹{formatINR(diiSell)}
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">NET COMBINED</div>
                    <div className={`metric-value ${combNet >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                      {combNet >= 0 ? '+' : '-'}₹{formatINR(combNet)} cr
                    </div>
                    <div className="metric-sub">Institutional Sum Flow</div>
                  </div>
                </div>

                {/* Alignment Banner */}
                <div style={{
                  background: `rgba(${combNet >= 0 ? '0, 201, 167' : '255, 77, 77'}, 0.08)`,
                  borderLeft: `4px solid ${alignmentColor}`,
                  padding: '16px 20px', borderRadius: 4, marginBottom: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 'bold', letterSpacing: '1px', fontSize: 14, color: alignmentColor }}>
                      {alignment.label}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                    {alignment.desc}
                  </div>
                </div>

                {/* Institutional Flow Analytics */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <div className="card-title">🕵️‍♂️ Institutional Flow Analytics (Streak & Momentum)</div>
                  </div>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                      <div className="metric-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="metric-label" style={{ fontSize: 10 }}>FII Streak (30-Day)</div>
                        <div className="metric-value" style={{ fontSize: 15, color: fiiStreak.type === 'BUY' ? 'var(--green)' : fiiStreak.type === 'SELL' ? 'var(--red)' : 'var(--gold)' }}>
                          {fiiStreak.count} Days {fiiStreak.type === 'BUY' ? 'Buying 📈' : fiiStreak.type === 'SELL' ? 'Selling 📉' : 'Flat'}
                        </div>
                      </div>
                      <div className="metric-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="metric-label" style={{ fontSize: 10 }}>DII Streak (30-Day)</div>
                        <div className="metric-value" style={{ fontSize: 15, color: diiStreak.type === 'BUY' ? 'var(--green)' : diiStreak.type === 'SELL' ? 'var(--red)' : 'var(--gold)' }}>
                          {diiStreak.count} Days {diiStreak.type === 'BUY' ? 'Buying 📈' : diiStreak.type === 'SELL' ? 'Selling 📉' : 'Flat'}
                        </div>
                      </div>
                      <div className="metric-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="metric-label" style={{ fontSize: 10 }}>FII 5D Momentum</div>
                        <div className={`metric-value ${fiiMom5d >= 0 ? 'metric-val-green' : 'metric-val-red'}`} style={{ fontSize: 16 }}>
                          {fiiMom5d >= 0 ? '+' : ''}₹{formatINR(fiiMom5d)} cr
                        </div>
                      </div>
                      <div className="metric-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="metric-label" style={{ fontSize: 10 }}>DII 5D Momentum</div>
                        <div className={`metric-value ${diiMom5d >= 0 ? 'metric-val-green' : 'metric-val-red'}`} style={{ fontSize: 16 }}>
                          {diiMom5d >= 0 ? '+' : ''}₹{formatINR(diiMom5d)} cr
                        </div>
                      </div>
                    </div>

                    {/* Divergence Status */}
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 'bold', borderRadius: 4, padding: '3px 8px',
                        background: isDivergent ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                        color: isDivergent ? 'var(--gold)' : 'var(--green)',
                        border: `1px solid ${isDivergent ? 'var(--gold)' : 'var(--green)'}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {isDivergent ? '⚠️ FLOW DIVERGENCE' : '✅ FLOW ALIGNMENT'}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {divergenceType === 'FII_BUY_DII_SELL' && 'Foreign capital is buying, but Domestic desks are distributing. Potential index volatility ahead.'}
                        {divergenceType === 'DII_BUY_FII_SELL' && 'Domestic support is actively buying to absorb Foreign institutional selling pressure.'}
                        {divergenceType === 'CO_BUY' && 'Both Foreign and Domestic institutional desks are aligned in buying. High conviction rally.'}
                        {divergenceType === 'CO_SELL' && 'Both Foreign and Domestic institutional desks are aligned in selling. Risk-off distribution.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sectoral Flow Panel */}
                {fiiDiiSectorFlow && fiiDiiSectorFlow.length > 0 && (
                  <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                      <div className="card-title">🔦 Sectoral Flow (Institutional Stance)</div>
                    </div>
                    <div className="card-body" style={{ padding: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        {fiiDiiSectorFlow.map((s, idx) => {
                          const isAcc = s.stance === 'ACCUMULATING';
                          const stanceColor = isAcc ? 'var(--green)' : s.stance === 'DISTRIBUTING' ? 'var(--red)' : 'var(--gold)';
                          return (
                            <div key={idx} style={{
                              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px',
                              display: 'flex', flexDirection: 'column', gap: 6
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: 12, color: '#fff' }}>{s.sector}</span>
                                <span style={{
                                  fontSize: 8, fontWeight: 'bold', borderRadius: 3, padding: '1px 5px',
                                  background: isAcc ? 'rgba(34,197,94,0.1)' : s.stance === 'DISTRIBUTING' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                  color: stanceColor, border: `1px solid ${stanceColor}`
                                }}>{s.stance}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 'bold', color: s.netFlow >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {s.netFlow >= 0 ? '+' : ''}₹{s.netFlow.toFixed(2)} Cr
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Side by Side Desk Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border" style={{ marginBottom: 20 }}>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                      <div className="card-title">FII (Foreign Institutional)</div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Buy volume</span>
                        <span style={{ color: '#fff', fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace' }}>₹{formatINR(fiiBuy)} cr</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Sell volume</span>
                        <span style={{ color: '#fff', fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace' }}>₹{formatINR(fiiSell)} cr</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Net flow</span>
                        <span style={{ color: fiiNet >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {fiiNet >= 0 ? '+' : '-'}₹{formatINR(fiiNet)} cr
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                        {fiiText}
                      </p>
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                      <div className="card-title">DII (Domestic Institutional)</div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Buy volume</span>
                        <span style={{ color: '#fff', fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace' }}>₹{formatINR(diiBuy)} cr</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Sell volume</span>
                        <span style={{ color: '#fff', fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace' }}>₹{formatINR(diiSell)} cr</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Net flow</span>
                        <span style={{ color: diiNet >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {diiNet >= 0 ? '+' : '-'}₹{formatINR(diiNet)} cr
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                        {diiText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="data-source-footer">
                  {api?.source && <span>Source: {api.source}</span>}
                  {api?.lastUpdated && <span>Updated: {api.lastUpdated}</span>}
                  {fiiDiiLastFetch && (
                    <span>
                      Fetched: {fiiDiiLastFetch.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {fiiDiiActiveSubTab === 'trend' && (() => {
            const { fiiAvg, diiAvg, fiiBuyDays, totalDays } = trendMetrics;

            return (
              <div>
                {/* Trend Summary Cards */}
                <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                  <div className="metric-card">
                    <div className="metric-label">FII Avg (Net)</div>
                    <div className={`metric-value ${fiiAvg >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                      ₹{fiiAvg.toFixed(1)} cr
                    </div>
                    <div className="metric-sub">Average net over last {totalDays} days</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">DII Avg (Net)</div>
                    <div className={`metric-value ${diiAvg >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                      ₹{diiAvg.toFixed(1)} cr
                    </div>
                    <div className="metric-sub">Average net over last {totalDays} days</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">FII Buy Days</div>
                    <div className="metric-value metric-val-gold">
                      {fiiBuyDays}/{totalDays}
                    </div>
                    <div className="metric-sub">Desks bought on positive days</div>
                  </div>
                </div>

                {/* Daily Chart */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <div className="card-title">Daily Institutional Net Flows</div>
                  </div>
                  <div className="card-body" style={{ height: 320, padding: '16px 8px' }}>
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <RechartsCartesianGrid strokeDasharray="3 3" stroke="rgba(30, 45, 61, 0.2)" vertical={false} />
                        <RechartsXAxis dataKey="date" tick={{ fill: '#8a9ab0', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} />
                        <RechartsYAxis tick={{ fill: '#8a9ab0', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1a2130', borderColor: '#1e2d3d', borderRadius: 4 }} 
                          itemStyle={{ fontSize: 12 }}
                          labelStyle={{ color: '#fff', fontWeight: 600, fontSize: 11 }}
                        />
                        <RechartsReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" />
                        <RechartsBar dataKey="fii" name="FII Net" fill="#00c9a7" radius={[3, 3, 0, 0]} />
                        <RechartsBar dataKey="dii" name="DII Net" fill="#ffb347" radius={[3, 3, 0, 0]} />
                      </RechartsBarChart>
                    </RechartsResponsiveContainer>
                  </div>
                </div>

                {/* Cumulative Trend Chart */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <div className="card-title">30-Session Cumulative FII & DII Net Flows</div>
                  </div>
                  <div className="card-body" style={{ height: 320, padding: '16px 8px' }}>
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <RechartsCartesianGrid strokeDasharray="3 3" stroke="rgba(30, 45, 61, 0.2)" vertical={false} />
                        <RechartsXAxis dataKey="date" tick={{ fill: '#8a9ab0', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} />
                        <RechartsYAxis tick={{ fill: '#8a9ab0', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1a2130', borderColor: '#1e2d3d', borderRadius: 4 }} 
                          itemStyle={{ fontSize: 12 }}
                          labelStyle={{ color: '#fff', fontWeight: 600, fontSize: 11 }}
                          formatter={(value) => [`${value >= 0 ? '+' : ''}₹${value.toLocaleString('en-IN')} cr`]}
                        />
                        <RechartsLegend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono', marginBottom: 10 }} />
                        <RechartsReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" />
                        <RechartsLine type="monotone" dataKey="fiiCumulative" name="Cumulative FII" stroke="#00c9a7" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 2 }} />
                        <RechartsLine type="monotone" dataKey="diiCumulative" name="Cumulative DII" stroke="#ffb347" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 2 }} />
                      </RechartsLineChart>
                    </RechartsResponsiveContainer>
                  </div>
                </div>

                {/* Historical Ledger */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-header">
                    <div className="card-title">Detailed Historical Ledger</div>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>FII Buy (cr)</th>
                            <th>FII Sell (cr)</th>
                            <th>FII Net (cr)</th>
                            <th>DII Buy (cr)</th>
                            <th>DII Sell (cr)</th>
                            <th>DII Net (cr)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fiiDiiData.slice(0, ledgerLimit).map((row, idx) => {
                            const isCoBuy = row.fii_net > 0 && row.dii_net > 0;
                            const isCoSell = row.fii_net < 0 && row.dii_net < 0;
                            const rowClass = isCoBuy ? 'confluence-buy' : isCoSell ? 'confluence-sell' : '';
                            return (
                              <tr key={idx} className={rowClass}>
                                <td className="highlight">{row.date}</td>
                                <td>₹{row.fii_buy.toLocaleString('en-IN')}</td>
                                <td>₹{row.fii_sell.toLocaleString('en-IN')}</td>
                                <td style={{ color: row.fii_net >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                                  {row.fii_net >= 0 ? '+' : ''}₹{row.fii_net.toLocaleString('en-IN')}
                                </td>
                                <td>₹{row.dii_buy.toLocaleString('en-IN')}</td>
                                <td>₹{row.dii_sell.toLocaleString('en-IN')}</td>
                                <td style={{ color: row.dii_net >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                                  {row.dii_net >= 0 ? '+' : ''}₹{row.dii_net.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {fiiDiiData.length > ledgerLimit && (
                      <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setLedgerLimit(prev => prev + 30)}
                          style={{ width: '100%', maxWidth: 200 }}
                        >
                          📥 Load More
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {fiiDiiActiveSubTab === 'verdict' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  *Sherlock AI verdict deduces institutional alignments using live flow velocity ledger.
                </div>
                <button
                  className="btn btn-gold"
                  onClick={handleAnalyzeFiiDii}
                  disabled={analyzingFiiDii}
                >
                  {analyzingFiiDii ? "Watson, I am examining the flows..." : "🔍 Run Sherlock AI flow analysis"}
                </button>
              </div>

              {fiiDiiAnalysis ? (
                <div>
                  <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
                      <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
                        Combined Bias Verdict
                      </div>
                      <h2 style={{
                        margin: 0,
                        fontFamily: 'Cinzel, serif',
                        color: fiiDiiAnalysis.combined_bias.includes('BULLISH') ? 'var(--green)' : fiiDiiAnalysis.combined_bias.includes('BEARISH') ? 'var(--red)' : 'var(--gold)',
                        fontSize: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10
                      }}>
                        <span>{fiiDiiAnalysis.combined_bias.includes('BULLISH') ? '🟢' : fiiDiiAnalysis.combined_bias.includes('BEARISH') ? '🔴' : '⚪'}</span>
                        {fiiDiiAnalysis.combined_bias} ({Math.round(fiiDiiAnalysis.confidence * 100)}% Confidence)
                      </h2>
                    </div>
                  </div>

                  <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="metric-card">
                      <div className="metric-label">FII Desk Signal</div>
                      <div className={`metric-value ${fiiDiiAnalysis.fii_signal.includes('BUY') ? 'metric-val-green' : fiiDiiAnalysis.fii_signal.includes('SELL') ? 'metric-val-red' : ''}`}>
                        {fiiDiiAnalysis.fii_signal}
                      </div>
                      <div className="metric-sub">Based on foreign buying velocity</div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-label">DII Desk Signal</div>
                      <div className={`metric-value ${fiiDiiAnalysis.dii_signal.includes('BUY') ? 'metric-val-green' : fiiDiiAnalysis.dii_signal.includes('SELL') ? 'metric-val-red' : ''}`}>
                        {fiiDiiAnalysis.dii_signal}
                      </div>
                      <div className="metric-sub">Based on domestic absorbing capacity</div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-label">Recommended Action</div>
                      <div className="metric-value metric-val-gold">
                        {fiiDiiAnalysis.action}
                      </div>
                      <div className="metric-sub">Tactical capital posture rule</div>
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                      <div className="card-title">🕵️‍♂️ Sherlock's Flow Deductions</div>
                    </div>
                    <div className="card-body">
                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ margin: '0 0 6px 0', color: 'var(--gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          FII Interpretation
                        </h4>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {fiiDiiAnalysis.fii_interpretation}
                        </p>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ margin: '0 0 6px 0', color: 'var(--gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          DII Interpretation
                        </h4>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {fiiDiiAnalysis.dii_interpretation}
                        </p>
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 6px 0', color: 'var(--gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Market Implication & Price Target Expectation
                        </h4>
                        <div style={{
                          background: 'rgba(201, 168, 76, 0.04)',
                          border: '1px solid rgba(201, 168, 76, 0.15)',
                          borderRadius: 4,
                          padding: 12,
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          lineHeight: '1.5',
                          fontWeight: 500
                        }}>
                          {fiiDiiAnalysis.market_implication}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ fontSize: 24 }}>🎯</div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Intraday Bias</div>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: 14 }}>{fiiDiiAnalysis.intraday_bias}</div>
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ fontSize: 24 }}>📈</div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Swing Bias</div>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: 14 }}>{fiiDiiAnalysis.swing_bias}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border">
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Flow Momentum</div>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>
                            {fiiDiiAnalysis.momentum === 'ACCELERATING' ? '⚡' : fiiDiiAnalysis.momentum === 'REVERSING' ? '🔄' : '→'}
                          </span>
                          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: 14 }}>
                            {fiiDiiAnalysis.momentum}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12 }}>
                          {fiiDiiAnalysis.momentum === 'ACCELERATING' ? "Flows are getting stronger day-over-day, showing increasing institutional conviction." :
                           fiiDiiAnalysis.momentum === 'FADING' ? "Flow pressure is beginning to exhaust, suggesting a short-term trend reversal may occur soon." :
                           fiiDiiAnalysis.momentum === 'REVERSING' ? "A major shift is underway. Institutional positioning is changing rapidly." :
                           "Flow velocity is steady and sustaining the current trend."}
                        </p>
                      </div>
                    </div>

                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Risk Warnings & Red Flags</div>
                      </div>
                      <div className="card-body">
                        {fiiDiiAnalysis.red_flag && fiiDiiAnalysis.red_flag !== 'None' ? (
                          <div style={{ display: 'flex', gap: 8, color: 'var(--red)', fontSize: 13, lineHeight: '1.5' }}>
                            <span>🚨</span>
                            <span>{fiiDiiAnalysis.red_flag}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, color: 'var(--green)', fontSize: 13, lineHeight: '1.5' }}>
                            <span>🛡️</span>
                            <span>No major red flags or anomalous outflows detected. Setup remains structurally clean.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Click the button above to have Sherlock analyze the current desk flows.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
