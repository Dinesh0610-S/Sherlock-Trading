import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StrategyEngineDashboard from '../../components/StrategyEngineDashboard';
import { refreshManager } from '../../services/DataRefreshManager';
import {
  isValidPrice,
  formatNumber,
  formatPrice,
  detectDirection,
  DataStatusBanner,
  MTFConfirmationPanel,
  VerdictAccuracyTracker,
  parseEvidenceItem,
  parseVerdict
} from '../../utils/sharedHelpers';

export default function SherlockVerdict() {
  const [marketData, setMarketData] = useState(() => {
    try {
      const cached = localStorage.getItem('sherlock_market_data');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [dataStatus, setDataStatus] = useState('LOADING');
  const [dataErrors, setDataErrors] = useState([]);
  const [verdictResult, setVerdictResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  // Flash state for live price ticks (green=up, red=down)
  const [priceFlash, setPriceFlash] = useState(''); // 'flash-green-text' | 'flash-red-text' | ''
  const lastTickPriceRef = useRef(null); // tracks previous price for flash direction

  // Local state for direction, signal and loader
  const [selectedDirection, setSelectedDirection] = useState('NEUTRAL');
  const [precisionSignal, setPrecisionSignal] = useState(null);
  const [loadingSignal, setLoadingSignal] = useState(false);

  // Save to localStorage when updated
  useEffect(() => {
    if (marketData && isValidPrice(marketData.spot)) {
      try {
        localStorage.setItem('sherlock_market_data', JSON.stringify(marketData));
      } catch (e) {
        console.warn('Failed to save marketData to localStorage:', e);
      }
    }
  }, [marketData]);

  const isBlockedText = (str) => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return lower.includes('blocked') || lower.includes('do not trade') || lower.includes('no trade today') || lower.includes('do-not-trade');
  };

  const fetchAllData = useCallback(async () => {
    setDataStatus('LOADING');
    setDataErrors([]);

    const errors = [];
    let quote = null;
    let indicators = null;
    let options = null;
    let fii = null;
    let mtf = null;

    const fetchQuote = async () => {
      const res = await fetch('/api/nse/quote?symbol=NIFTY');
      const data = await res.json();
      if (data.error) throw new Error(data.message);
      if (!isValidPrice(data.lastPrice))
        throw new Error('Invalid price: ' + data.lastPrice);
      quote = data;
    };

    const fetchIndicators = async () => {
      const res  = await fetch('/api/indicators?symbol=NIFTY');
      const data = await res.json();
      if (data.error) throw new Error(data.message);
      indicators = data;
    };

    const fetchOptions = async () => {
      const res  = await fetch('/api/nse/option-chain?symbol=NIFTY');
      const data = await res.json();
      if (data.error) throw new Error(data.message);
      options = data;
    };

    const fetchFii = async () => {
      const res  = await fetch('/api/fiidii/today');
      const data = await res.json();
      if (data.error) throw new Error(data.message);
      fii = data;
    };

    const fetchMtf = async () => {
      const res = await fetch('/api/verdict/mtf?symbol=NIFTY');
      const data = await res.json();
      if (data && !data.error) {
        mtf = data;
      }
    };

    await Promise.allSettled([
      fetchQuote().catch(e => errors.push({ source: 'Quote', message: e.message })),
      fetchIndicators().catch(e => errors.push({ source: 'Indicators', message: e.message })),
      fetchOptions().catch(e => errors.push({ source: 'Options', message: e.message })),
      fetchFii().catch(e => errors.push({ source: 'FII/DII', message: e.message })),
      fetchMtf().catch(e => errors.push({ source: 'MTF', message: e.message }))
    ]);

    setDataErrors(errors);

    // Get cached data for fallback values
    let cachedData = null;
    try {
      const cachedDataStr = localStorage.getItem('sherlock_market_data');
      if (cachedDataStr) cachedData = JSON.parse(cachedDataStr);
    } catch (e) {}

    const lastKnownSpot = cachedData?.spot || 23500;
    const spot = quote?.lastPrice || indicators?.spot || lastKnownSpot;

    // Guard: without a valid spot, we cannot proceed
    if (!spot || !isValidPrice(spot)) {
      setDataStatus('ERROR');
      setMarketData(null);
      return;
    }

    // Build data object — null or cached for missing values
    const data = {
      symbol: 'NIFTY',
      spot,                                       // never 0
      change: quote?.change ?? cachedData?.change ?? null,
      changePct: quote?.pChange ?? quote?.changePct ?? cachedData?.changePct ?? null,
      rsi: indicators?.rsi14
            ? +indicators.rsi14.toFixed(1)
            : (cachedData?.rsi ?? null),
      ema9: indicators?.ema9
            ? +indicators.ema9.toFixed(2)
            : (cachedData?.ema9 ?? null),
      ema21: indicators?.ema21
            ? +indicators.ema21.toFixed(2)
            : (cachedData?.ema21 ?? null),
      // VWAP: only valid if meaningfully different from spot
      vwap: indicators?.vwapValid && indicators.vwap &&
            Math.abs(indicators.vwap - spot) > 5
              ? +indicators.vwap.toFixed(2)
              : (cachedData?.vwap ?? null),
      atr: indicators?.atr14
            ? +indicators.atr14.toFixed(2)
            : (cachedData?.atr ?? null),
      // PCR: only valid if option chain loaded
      pcr: options?.pcr && options.pcr > 0
            ? +options.pcr.toFixed(2)
            : (cachedData?.pcr ?? null),
      maxPain: options?.maxPain?.strike ?? indicators?.maxPain?.strike ?? cachedData?.maxPain ?? null,
      fiiNet: fii?.fii?.net ?? cachedData?.fiiNet ?? null,
      dataSource: quote?.source || cachedData?.dataSource || 'Cache',
      hasOptions: !!options || !!cachedData?.hasOptions,
      hasIndicators: !!indicators || !!cachedData?.hasIndicators,
      isRestricted: indicators?.isRestricted ?? cachedData?.isRestricted ?? false,
      deducedDirection: indicators?.deducedDirection ?? cachedData?.deducedDirection ?? null,
      mtf: mtf || cachedData?.mtf || null
    };

    // Calculate derived signals only when data exists
    if (data.ema9 && data.ema21) {
      data.emaSignal = data.ema9 > data.ema21 ? 'BULLISH' : 'BEARISH';
    } else {
      data.emaSignal = null;
    }
    if (data.vwap) {
      data.vwapSignal = data.spot > data.vwap ? 'ABOVE' : 'BELOW';
    } else {
      data.vwapSignal = null;
    }
    data.autoDirection = detectDirection(data);

    setMarketData(data);
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }));
    
    if (errors.length === 5) {
      setDataStatus('ERROR');
    } else if (errors.length > 0) {
      setDataStatus('PARTIAL');
    } else {
      setDataStatus('READY');
    }

  }, []);


  // ── Full data refresh: on mount + every 30s (indicators, options, FII) ────
  useEffect(() => {
    fetchAllData();
    refreshManager.register('sherlock-verdict-full', fetchAllData, 30000);
    return () => refreshManager.unregister('sherlock-verdict-full');
  }, [fetchAllData]);

  // ── 2-second lightweight price/change/pct poll ──────────────────────────
  useEffect(() => {
    const pollPrice = async () => {
      try {
        const res = await fetch(`/api/nse/quote?symbol=NIFTY&_t=${Date.now()}`);
        if (!res.ok) return; // keep last known value

        const q = await res.json();

        // Guard: reject NaN, undefined, 0, or error responses
        if (
          !q ||
          q.error ||
          typeof q.lastPrice !== 'number' ||
          !isFinite(q.lastPrice) ||
          q.lastPrice <= 0
        ) return;

        const newPrice  = q.lastPrice;
        const newChange = typeof q.change  === 'number' && isFinite(q.change)  ? q.change  : 0;
        const newPct    = typeof q.pChange === 'number' && isFinite(q.pChange) ? q.pChange : 0;

        // Flash direction: green if up, red if down, none if same
        const prev = lastTickPriceRef.current;
        if (prev !== null && newPrice !== prev) {
          const flashClass = newPrice > prev ? 'flash-green-text' : 'flash-red-text';
          setPriceFlash(flashClass);
          setTimeout(() => setPriceFlash(''), 800);
        }
        lastTickPriceRef.current = newPrice;

        // Update ONLY spot/change/pct in marketData — preserve all other fields
        setMarketData(prev => {
          if (!prev) return prev; // don't create data from scratch here
          return {
            ...prev,
            spot:       newPrice,
            change:     newChange,
            changePct:  newPct,
          };
        });

        setLastUpdated(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }));
      } catch (err) {
        console.warn('[Verdict Price Poll] Failed (keeping last value):', err.message);
      }
    };

    pollPrice(); // immediate first tick
    refreshManager.register('sherlock-verdict-price', pollPrice, 2000);
    return () => refreshManager.unregister('sherlock-verdict-price');
  }, []); // empty deps — runs once, self-contained

  // Set the direction state when marketData is populated
  useEffect(() => {
    if (marketData?.autoDirection) {
      setSelectedDirection(marketData.autoDirection);
    }
  }, [marketData?.autoDirection]);

  // Auto-generate verdict when data is ready
  useEffect(() => {
    if (marketData && isValidPrice(marketData.spot) && !verdictResult && !loading) {
      handleRecalculate();
    }
  }, [marketData?.spot]);

  const generateVerdict = async (data) => {
    const res = await fetch('/api/verdict/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketData: data
      })
    });
    if (!res.ok) {
      throw new Error("Failed to connect to Sherlock's deductive threads.");
    }
    const json = await res.json();
    return json;
  };

  const handleRecalculate = async () => {
    if (!marketData) {
      setVerdictResult({ text: 'Waiting for market data to load...', source: 'LOADING' });
      return;
    }

    if (!marketData.spot || !isValidPrice(marketData.spot)) {
      setVerdictResult({
        text: '⚠ Cannot generate verdict: Nifty spot price unavailable.\n\n' +
              'Please check:\n' +
              '1. Is your proxy server running? (npm run proxy)\n' +
              '2. Is NSE India accessible?\n' +
              '3. Click "Recalculate Verdict" to retry.',
        source: 'ERROR'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateVerdict(marketData);
      setVerdictResult(result);
    } catch (err) {
      setVerdictResult({
        text: `Failed to generate verdict: ${err.message}`,
        source: 'ERROR',
        reason: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSignal = async () => {
    if (!marketData || !isValidPrice(marketData.spot)) return;
    setLoadingSignal(true);
    try {
      const res = await fetch('/api/generate-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: '^NSEI',
          direction: selectedDirection,
          metrics: {
            spot_price: marketData.spot,
            rsi: marketData.rsi ?? 50.0,
            ema_status: marketData.emaSignal === 'BULLISH' ? 'Bullish Alignment (9 > 21)' : 'Bearish Alignment (9 < 21)',
            vwap_val: marketData.vwap ?? marketData.spot,
            spot_below_ema21: marketData.ema21 ? marketData.spot < marketData.ema21 : false,
            pcr: marketData.pcr ?? 1.0,
            max_pain: marketData.maxPain ?? marketData.spot
          }
        })
      });
      if (res.ok) {
        const json = await res.json();
        setPrecisionSignal(json.signal);
      }
    } catch (e) {
      console.error('Error generating signal:', e);
    } finally {
      setLoadingSignal(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full box-border" style={{ marginTop: 15 }}>
      {/* Left Column: AI verdict text — rendered with ReactMarkdown */}
      <div className="lg:col-span-2 flex flex-col gap-4 w-full box-border">
        <div className="card">
          <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="card-title">🔬 Sherlock's Analytical Verdict</div>
            <button className="btn btn-gold btn-sm" onClick={handleRecalculate} disabled={loading}>
              {loading ? 'Deducting...' : '🔄 Recalculate Verdict'}
            </button>
          </div>
          <div className="card-body sherlock-verdict-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DataStatusBanner 
              status={dataStatus} 
              errors={dataErrors} 
              dataSource={marketData?.dataSource} 
              lastUpdated={lastUpdated} 
              onRetry={fetchAllData} 
            />
            
            {!marketData || !isValidPrice(marketData.spot) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                {/* Status Bar */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.04)',
                  border: '1px dashed rgba(59, 130, 246, 0.25)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span className="status-dot pulsing" style={{ color: '#60a5fa', animation: 'pulse 1.5s infinite' }}>●</span>
                  <span>🕵️‍♂️ Gathered clues: waiting for live NIFTY feed. Estimated wait time: &lt; 5 seconds...</span>
                </div>

                {/* Shimmer / Skeleton Card */}
                <div className="loading-skeleton" style={{
                  background: 'rgba(19, 24, 31, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  animation: 'pulse 1.5s infinite'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '30%' }}></div>
                    <div style={{ height: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '15%' }}></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', width: '100%' }}></div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', width: '90%' }}></div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', width: '40%' }}></div>
                  </div>
                </div>

                {/* Shimmer / Skeleton Evidence Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '25%' }}></div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    animation: 'pulse 1.5s infinite'
                  }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        background: 'rgba(19, 24, 31, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', width: '40%' }}></div>
                        <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', width: '80%' }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <StrategyEngineDashboard mini={true} spotPrice={marketData.spot} />
                {(() => {
                  const parsed = parseVerdict(verdictResult?.text);
                  const isBull = parsed.deduction.toLowerCase().includes('bull') || parsed.deduction.toLowerCase().includes('long') || parsed.deduction.toLowerCase().includes('ce');
                  const isBear = parsed.deduction.toLowerCase().includes('bear') || parsed.deduction.toLowerCase().includes('short') || parsed.deduction.toLowerCase().includes('pe');
                  const isBlocked = isBlockedText(parsed.deduction) || parsed.deduction.toLowerCase().includes('avoid');

                  let verdictType = 'NEUTRAL';
                  let verdictColor = '#cbd5e1';
                  let verdictBg = 'rgba(255, 255, 255, 0.02)';
                  let verdictBorder = 'rgba(255, 255, 255, 0.08)';

                  if (isBlocked) {
                    verdictType = 'SIGNAL BLOCKED';
                    verdictColor = '#ff1744';
                    verdictBg = 'rgba(255, 23, 68, 0.08)';
                    verdictBorder = 'rgba(255, 23, 68, 0.3)';
                  } else if (isBull) {
                    verdictType = 'BULLISH ACCUMULATION';
                    verdictColor = '#00e676';
                    verdictBg = 'rgba(0, 230, 118, 0.08)';
                    verdictBorder = 'rgba(0, 230, 118, 0.3)';
                  } else if (isBear) {
                    verdictType = 'BEARISH DISTRIBUTION';
                    verdictColor = '#ff1744';
                    verdictBg = 'rgba(255, 23, 68, 0.08)';
                    verdictBorder = 'rgba(255, 23, 68, 0.3)';
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Deduction Status Card */}
                      <div style={{
                        background: 'rgba(11, 15, 25, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '20px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        animation: 'pmi-fade-in 0.3s ease both'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            🕵️‍♂️ SHERLOCK'S DEDUCTION
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: verdictColor,
                            background: verdictBg,
                            border: `1px solid ${verdictBorder}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {verdictType}
                          </span>
                        </div>

                        {/* Source Banner */}
                        {verdictResult && (
                          <div className="verdict-source-banner" style={{
                            background: verdictResult.source === 'CLAUDE_AI' ? 'rgba(0,255,136,0.04)' : 'rgba(255,170,0,0.04)',
                            borderColor: verdictResult.source === 'CLAUDE_AI' ? 'rgba(0,255,136,0.15)' : 'rgba(255,170,0,0.15)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: '#94a3b8',
                            marginBottom: '14px'
                          }}>
                            <span style={{ color: verdictResult.source === 'CLAUDE_AI' ? '#00ff88' : '#ffaa00' }}>●</span>
                            <span>
                              {verdictResult.source === 'CLAUDE_AI'
                                ? `Sherlock AI Active — ${verdictResult.tokens} tokens`
                                : `⚠ Rule-Based Fallback — ${verdictResult.reason || 'Fallback active'}`}
                            </span>
                            {verdictResult.source !== 'CLAUDE_AI' && (
                              <button
                                className="retry-claude-btn"
                                onClick={handleRecalculate}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                Retry AI
                              </button>
                            )}
                          </div>
                        )}

                        <div style={{
                          fontSize: '13px',
                          lineHeight: '1.625',
                          color: '#cbd5e1',
                          whiteSpace: 'pre-line',
                          wordBreak: 'break-words'
                        }}>
                          {loading ? 'Analyzing parameters and generating verdict...' : parsed.deduction}
                        </div>
                      </div>

                      {/* Technical Evidence Grid */}
                      {parsed.evidence && parsed.evidence.length > 0 && (
                        <div>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                            📊 TECHNICAL EVIDENCE MATRIX
                          </span>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '12px'
                          }}>
                            {parsed.evidence.map((item, idx) => {
                              const detail = parseEvidenceItem(item);
                              return (
                                <div key={idx} style={{
                                  background: 'rgba(11, 15, 25, 0.65)',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  borderRadius: '8px',
                                  padding: '14px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                  transition: 'transform 0.2s ease',
                                }}>
                                  <div style={{ fontSize: '9px', color: 'var(--gold-dim)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                                    {detail.label}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', fontFamily: 'monospace', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                                    {detail.value}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Execution Checklist Box */}
                      {parsed.checklist && (
                        <div style={{
                          background: 'rgba(11, 15, 25, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderLeft: '4px solid var(--gold)',
                          borderRadius: '8px',
                          padding: '18px 20px',
                          marginTop: '4px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                        }}>
                          <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 'bold', display: 'block', marginBottom: '8px', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            📋 OPTIONS EXECUTION GATEWAYS
                          </span>
                          <div style={{
                            fontSize: '12px',
                            lineHeight: '1.6',
                            color: '#cbd5e1',
                            whiteSpace: 'pre-line',
                            wordBreak: 'break-words'
                          }}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                                li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                                ul: ({children}) => <ul style={{ paddingLeft: '16px', margin: '4px 0 8px 0' }}>{children}</ul>,
                                ol: ({children}) => <ol style={{ paddingLeft: '16px', margin: '4px 0 8px 0' }}>{children}</ol>,
                                strong: ({children}) => <strong style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{children}</strong>,
                                code: ({children}) => <code style={{ background: 'rgba(255,200,0,0.08)', color: 'var(--gold)', padding: '1px 5px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{children}</code>,
                              }}
                            >
                              {parsed.checklist}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <MTFConfirmationPanel symbol={marketData?.symbol || 'NIFTY'} />
      </div>

      {/* Right Column: Precision Signal Generator with live data tiles */}
      <div className="lg:col-span-1 flex flex-col gap-4 w-full box-border">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="card-title">⚡ Precision Signal Generator</div>
            <span style={{fontSize:10,color:'var(--gold-dim)',opacity:.8}}>Live Feed</span>
          </div>
          <div className="card-body">
            {/* Live Indicator Mini-Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 w-full box-border" style={{ gap: 8, marginBottom: 14 }}>
              {/* RSI */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>RSI</div>
                <div style={{
                  fontSize:18,fontWeight:700,
                  color: !marketData?.rsi ? '#555' : marketData.rsi > 70 ? '#ff6b6b' : marketData.rsi < 30 ? '#4ade80' : 'var(--gold)',
                  animation: !marketData ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {!marketData ? '...' : formatNumber(marketData?.rsi, 1)}
                </div>
                <div style={{fontSize:9,color: !marketData?.rsi ? '#555' : marketData.rsi > 70 ? '#ff6b6b' : marketData.rsi < 30 ? '#4ade80' : '#888',marginTop:2}}>
                  {!marketData ? '...' : (!marketData?.rsi ? '—' : marketData.rsi > 70 ? 'Overbought' : marketData.rsi < 30 ? 'Oversold' : 'Neutral')}
                </div>
              </div>
              
              {/* VWAP vs Spot */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>vs VWAP</div>
                <div style={{
                  fontSize:13,fontWeight:700,
                  color: !marketData?.vwap ? '#555' : marketData.vwapSignal === 'ABOVE' ? '#4ade80' : '#ff6b6b',
                  animation: !marketData ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {!marketData ? '...' : (!marketData?.vwap ? '—' : marketData.vwapSignal === 'ABOVE' ? '▲ Above' : '▼ Below')}
                </div>
                <div style={{fontSize:9,color:'#666',marginTop:2, animation: !marketData ? 'pulse 1.5s infinite' : 'none'}}>
                  {!marketData ? '...' : formatPrice(marketData?.vwap)}
                </div>
              </div>
              
              {/* EMA Status */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>EMA Trend</div>
                <div style={{
                  fontSize:13,fontWeight:700,
                  color: !marketData?.emaSignal ? '#555' : marketData.emaSignal === 'BULLISH' ? '#4ade80' : '#ff6b6b',
                  animation: !marketData ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {!marketData ? '...' : (!marketData?.emaSignal ? '—' : marketData.emaSignal === 'BULLISH' ? 'Bullish ↑' : 'Bearish ↓')}
                </div>
                <div style={{fontSize:9,color:'#666',marginTop:2, animation: !marketData ? 'pulse 1.5s infinite' : 'none'}}>
                  {!marketData ? '...' : (!marketData?.ema9 ? '—' : `${formatNumber(marketData?.ema9)} / ${formatNumber(marketData?.ema21)}`)}
                </div>
              </div>
              
              {/* PCR */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>PCR</div>
                <div style={{
                  fontSize:18,fontWeight:700,
                  color: !marketData?.pcr ? '#555' : marketData.pcr > 1.2 ? '#4ade80' : marketData.pcr < 0.8 ? '#ff6b6b' : 'var(--gold)',
                  animation: !marketData ? 'pulse 1.5s infinite' : 'none'
                }}>{!marketData ? '...' : formatNumber(marketData?.pcr, 2)}</div>
                <div style={{fontSize:9,color: !marketData?.pcr ? '#555' : marketData.pcr > 1.2 ? '#4ade80' : marketData.pcr < 0.8 ? '#ff6b6b' : '#888',marginTop:2, animation: !marketData ? 'pulse 1.5s infinite' : 'none'}}>
                  {!marketData ? '...' : (!marketData?.pcr ? '—' : marketData.pcr > 1.2 ? 'Bullish Floor' : marketData.pcr < 0.8 ? 'Bearish Pressure' : 'Neutral')}
                </div>
              </div>
              
              {/* Max Pain */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Max Pain</div>
                <div style={{fontSize:13,fontWeight:700,color:'#c084fc', animation: !marketData ? 'pulse 1.5s infinite' : 'none'}}>
                  {!marketData ? '...' : formatPrice(marketData?.maxPain)}
                </div>
                <div style={{fontSize:9,color:'#666',marginTop:2}}>Options Gravity</div>
              </div>
              
              {/* Spot vs Max Pain distance */}
              <div style={{background:'#0a0c10',border:'1px solid rgba(255,200,0,0.15)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Pain Δ</div>
                <div style={{
                  fontSize:13,fontWeight:700,
                  color: !marketData?.maxPain || !marketData?.spot ? '#555' : Math.abs((marketData.maxPain - marketData.spot) / marketData.spot * 100) < 0.5 ? '#ff6b6b' : '#4ade80',
                  animation: !marketData ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {!marketData
                    ? '...'
                    : (!marketData?.maxPain || !marketData?.spot
                      ? '—'
                      : `${((marketData.maxPain - marketData.spot)/marketData.spot*100).toFixed(2)}%`)}
                </div>
                <div style={{fontSize:9,color:'#666',marginTop:2}}>Spot–Pain Gap</div>
              </div>
            </div>

            {/* Direction selector */}
            <div className="form-group" style={{marginBottom:10}}>
              <label className="form-label">Trade Direction</label>
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                style={{width:'100%'}}
              >
                <option value="LONG" disabled={marketData?.isRestricted}>
                  🟢 LONG — Bullish Breakout {marketData?.isRestricted && '(Restricted by RSI Gate)'}
                </option>
                <option value="SHORT">🔴 SHORT — Bearish Breakdown</option>
                <option value="NEUTRAL">⚪ NEUTRAL — Sideways Consolidation</option>
              </select>
            </div>

            <button
              id="btn-generate-precision-signal"
              className="btn btn-gold"
              onClick={handleGenerateSignal}
              style={{ width: '100%', marginBottom: 14, padding: '10px 0', letterSpacing: 1 }}
              disabled={loadingSignal || !marketData || !isValidPrice(marketData.spot)}
            >
              {loadingSignal
                ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <span style={{display:'inline-block',width:12,height:12,border:'2px solid var(--gold)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>
                    Analysing Market Structure…
                  </span>
                : '⚡ Generate Precision Signal'}
            </button>

            {precisionSignal && (
              <div style={{
                background:'linear-gradient(135deg,#0a0c10 0%,#0f1218 100%)',
                border:'1px solid var(--gold)',
                borderRadius:8,
                padding:16,
                boxShadow:'0 0 20px rgba(255,200,0,0.08)'
              }}>
                <div style={{
                  display:'flex',alignItems:'center',gap:8,
                  color:'var(--gold)',fontWeight:700,fontSize:11,
                  textTransform:'uppercase',letterSpacing:1.5,marginBottom:12,
                  borderBottom:'1px solid rgba(255,200,0,0.2)',paddingBottom:8
                }}>
                  <span>📋</span> Precision Blueprint
                  <span style={{marginLeft:'auto',fontSize:10,color:'#888',fontWeight:400,letterSpacing:0}}>
                    {new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})} IST
                  </span>
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({children}) => <h1 style={{color:'var(--gold)',fontSize:14,fontWeight:700,margin:'0 0 6px'}}>{children}</h1>,
                    h2: ({children}) => <h2 style={{color:'var(--gold)',fontSize:13,fontWeight:700,margin:'10px 0 4px'}}>{children}</h2>,
                    h3: ({children}) => <h3 style={{color:'#afd8ff',fontSize:12,fontWeight:600,margin:'8px 0 4px'}}>{children}</h3>,
                    p:  ({children}) => <p  style={{fontSize:12,color:'#e0e0e0',margin:'2px 0 6px',lineHeight:1.6}}>{children}</p>,
                    strong: ({children}) => <strong style={{color:'var(--gold)',fontWeight:700}}>{children}</strong>,
                    li: ({children}) => <li style={{fontSize:12,color:'#e0e0e0',margin:'2px 0',lineHeight:1.5}}>{children}</li>,
                    ul: ({children}) => <ul style={{paddingLeft:16,margin:'4px 0 6px'}}>{children}</ul>,
                    ol: ({children}) => <ol style={{paddingLeft:16,margin:'4px 0 6px'}}>{children}</ol>,
                    code: ({children}) => <code style={{background:'rgba(255,200,0,0.12)',color:'var(--gold)',padding:'1px 5px',borderRadius:3,fontSize:11,fontFamily:'var(--font-mono)'}}>{children}</code>,
                    table: ({children}) => <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,margin:'6px 0'}}>{children}</table>,
                    th: ({children}) => <th style={{border:'1px solid rgba(255,200,0,0.25)',padding:'4px 8px',background:'rgba(255,200,0,0.08)',color:'var(--gold)',textAlign:'left',fontWeight:600}}>{children}</th>,
                    td: ({children}) => <td style={{border:'1px solid rgba(255,255,255,0.08)',padding:'4px 8px',color:'#e0e0e0'}}>{children}</td>,
                    hr: () => <hr style={{border:'none',borderTop:'1px solid rgba(255,200,0,0.15)',margin:'10px 0'}}/>,
                  }}
                >
                  {precisionSignal}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        <VerdictAccuracyTracker />
      </div>
    </div>
  );
}
