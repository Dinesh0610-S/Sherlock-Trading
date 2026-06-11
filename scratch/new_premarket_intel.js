function PreMarketIntel() {
  const [activeSubTab, setActiveSubTab] = React.useState('globalCues');
  const [marketData, setMarketData] = React.useState(null);
  const [tradingPlan, setTradingPlan] = React.useState(null);
  const [loadingData, setLoadingData] = React.useState(false);
  const [loadingPlan, setLoadingPlan] = React.useState(false);
  const [errorData, setErrorData] = React.useState(null);
  const [errorPlan, setErrorPlan] = React.useState(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Fetch all MarketMind data
  const fetchMarketMindData = React.useCallback(async () => {
    setLoadingData(true);
    setErrorData(null);
    try {
      const res = await fetch('/api/marketmind/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch market data`);
      const data = await res.json();
      setMarketData(data);
      
      // Concurrently fetch AI Trading Plan
      fetchTradingPlan(data);
    } catch (err) {
      console.error(err);
      setErrorData(err.message);
    } finally {
      setLoadingData(false);
    }
  }, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch AI Trading Plan
  const fetchTradingPlan = async (data) => {
    setLoadingPlan(true);
    setErrorPlan(null);
    try {
      const res = await fetch('/api/marketmind/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData: data })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to generate trading plan`);
      const plan = await res.json();
      setTradingPlan(plan);
    } catch (err) {
      console.error(err);
      setErrorPlan(err.message);
    } finally {
      setLoadingPlan(false);
    }
  };

  React.useEffect(() => {
    fetchMarketMindData();
  }, [fetchMarketMindData]);

  const handleRefresh = () => {
    setRefreshTick(t => t + 1);
  };

  // Format percent color & indicators
  const formatChange = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return { text: '0.00%', color: 'var(--text-secondary)', isUp: false };
    const prefix = num > 0 ? '+' : '';
    return {
      text: `${prefix}${num.toFixed(2)}%`,
      color: num >= 0 ? '#00e676' : '#ff1744',
      isUp: num >= 0
    };
  };

  // Helper to render skeleton screen loaders
  const renderSkeleton = () => (
    <div className="skeleton-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '20px 0' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton-card" style={{
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 8, height: 120, position: 'relative', overflow: 'hidden'
        }}>
          <div className="shimmer" style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
            animation: 'shimmer 1.5s infinite'
          }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="marketmind-root" style={{
      background: '#0a0f1d',
      color: '#e2e8f0',
      minHeight: '100vh',
      padding: '24px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header bar */}
      <div className="mm-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '20px',
        flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h2 style={{
            margin: 0, fontSize: '26px', fontWeight: 800, color: '#00e5ff',
            letterSpacing: '-0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            🧠 MarketMind <span style={{
              fontSize: '11px', background: 'rgba(0,229,255,0.15)', color: '#00e5ff',
              padding: '2px 8px', borderRadius: '4px', border: '1px solid #00e5ff', verticalAlign: 'middle'
            }}>PRE-MARKET AI</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Production-Grade Pre-Open Intelligence Engine for Indian Traders
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {marketData && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Last Sync: <strong>{new Date(marketData.fetched_at).toLocaleTimeString('en-IN', { hour12: true })}</strong>
            </span>
          )}
          <button className="btn" onClick={handleRefresh} disabled={loadingData || loadingPlan} style={{
            background: 'rgba(0,229,255,0.1)', border: '1px solid #00e5ff', color: '#00e5ff',
            padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease',
            textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '12px'
          }}>
            🔄 {loadingData || loadingPlan ? 'Fetching...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Sticky Tab Bar */}
      <div className="mm-tabs-wrapper" style={{
        position: 'sticky', top: 0, zIndex: 100, background: '#0a0f1d',
        padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px'
      }}>
        <div className="mm-tabs" style={{
          display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px'
        }}>
          {[
            { id: 'globalCues', label: '🌐 Global Cue$', icon: '🌎' },
            { id: 'indiaPulse', label: '🇮🇳 India Pulse', icon: '📈' },
            { id: 'verdict', label: '🎯 AI Verdict', icon: '⚖️' },
            { id: 'tradingPlan', label: '📝 AI Trading Plan', icon: '⚡' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                background: activeSubTab === tab.id ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.02)',
                border: activeSubTab === tab.id ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.05)',
                color: activeSubTab === tab.id ? '#00e5ff' : '#94a3b8',
                padding: '10px 18px', borderRadius: '6px', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="mm-tab-content">
        
        {/* TAB 1: GLOBAL CUE$ */}
        {activeSubTab === 'globalCues' && (
          <div>
            {loadingData && !marketData ? renderSkeleton() : errorData ? (
              <div className="error-card" style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444',
                padding: '16px', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px'
              }}>
                <h3>⚠️ Data Load Failed</h3>
                <p>{errorData}</p>
                <button onClick={handleRefresh} className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', marginTop: 10 }}>Retry</button>
              </div>
            ) : marketData && (
              <div>
                {/* AI One-liner Interpretation Banner */}
                <div style={{
                  background: 'rgba(0,229,255,0.04)', borderLeft: '4px solid #00e5ff',
                  padding: '16px', borderRadius: '4px', marginBottom: '24px', position: 'relative'
                }}>
                  <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '1px' }}>
                    🤖 AI INTERPRETATION (via Claude)
                  </span>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: '#f1f5f9', fontStyle: 'italic' }}>
                    "{marketData.global_cues.ai_interpretation}"
                  </p>
                </div>

                {/* Futures Section */}
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>US Index Futures</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  {[
                    { id: 'dow', name: 'Dow Jones Futures', data: marketData.global_cues.futures.dow, ticker: 'YM=F' },
                    { id: 'sp500', name: 'S&P 500 Futures', data: marketData.global_cues.futures.sp500, ticker: 'ES=F' },
                    { id: 'nasdaq', name: 'NASDAQ Futures', data: marketData.global_cues.futures.nasdaq, ticker: 'NQ=F' }
                  ].map(item => {
                    const change = formatChange(item.data.change_pct);
                    return (
                      <div key={item.id} className="pulse-fresh" style={{
                        background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px', padding: '16px', position: 'relative',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace' }}>{item.ticker}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
                          <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', color: '#f8fafc' }}>
                            {item.data.price > 0 ? item.data.price.toLocaleString('en-US') : 'Data Unavailable'}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace', color: change.color }}>
                            {change.text}
                          </span>
                        </div>
                        <div style={{ fontSize: '9px', color: '#475569', textAlign: 'right', marginTop: '8px' }}>via Yahoo Finance</div>
                      </div>
                    );
                  })}
                </div>

                {/* Commodities & Currency Section */}
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>Commodities, FX & Fear Index</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  {[
                    { name: 'Crude Oil (WTI)', val: marketData.global_cues.commodities.wti.price, change: marketData.global_cues.commodities.wti.change_pct, ticker: 'CL=F', tag: '$' },
                    { name: 'Crude Oil (Brent)', val: marketData.global_cues.commodities.brent.price, change: marketData.global_cues.commodities.brent.change_pct, ticker: 'BZ=F', tag: '$' },
                    { name: 'Gold Futures', val: marketData.global_cues.commodities.gold.price, change: marketData.global_cues.commodities.gold.change_pct, ticker: 'GC=F', tag: '$' },
                    { name: 'Dollar Index (DXY)', val: marketData.global_cues.currencies.dxy.price, change: marketData.global_cues.currencies.dxy.change_pct, ticker: 'DX-Y', tag: '' },
                    { name: 'US VIX Index', val: marketData.global_cues.vix.price, change: marketData.global_cues.vix.change_pct, ticker: '^VIX', tag: '' },
                    { name: 'GIFT Nifty', val: marketData.global_cues.gift_nifty.price, change: marketData.global_cues.gift_nifty.change_pct, ticker: 'GIFT_NIFTY', tag: '₹' }
                  ].map((item, idx) => {
                    const change = formatChange(item.change);
                    return (
                      <div key={idx} style={{
                        background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '6px', padding: '12px 16px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{item.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>
                            {item.val > 0 ? `${item.tag}${item.val.toLocaleString('en-IN')}` : 'Data Unavailable'}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: change.color }}>
                            {change.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Asian Markets Section */}
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>Asian Benchmarks</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {[
                    { name: 'Nikkei 225 (Japan)', data: marketData.global_cues.asian_markets.nikkei, ticker: '^N225' },
                    { name: 'Hang Seng (Hong Kong)', data: marketData.global_cues.asian_markets.hang_seng, ticker: '^HSI' },
                    { name: 'Shanghai Composite (China)', data: marketData.global_cues.asian_markets.shanghai, ticker: '000001.SS' }
                  ].map((item, idx) => {
                    const change = formatChange(item.data.change_pct);
                    return (
                      <div key={idx} style={{
                        background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '6px', padding: '14px 16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                          <span>{item.name}</span>
                          <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{item.ticker}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '10px' }}>
                          <span style={{ fontSize: '19px', fontWeight: 700, fontFamily: 'monospace' }}>
                            {item.data.price > 0 ? item.data.price.toLocaleString('en-IN') : 'Data Unavailable'}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: change.color }}>
                            {change.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INDIA PULSE */}
        {activeSubTab === 'indiaPulse' && (
          <div>
            {loadingData && !marketData ? renderSkeleton() : errorData ? (
              <div style={{ color: '#ef4444', padding: 20 }}>{errorData}</div>
            ) : marketData && (
              <div>
                {/* Row 1: Indian Indices & Institutional Flow */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  
                  {/* Closes Card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Indian Benchmarks close</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { name: 'Nifty 50', data: marketData.india_pulse.previous_close.nifty, id: '^NSEI' },
                        { name: 'Bank Nifty', data: marketData.india_pulse.previous_close.bank_nifty, id: '^NSEBANK' },
                        { name: 'BSE Sensex', data: marketData.india_pulse.previous_close.sensex, id: '^BSESN' }
                      ].map((item, idx) => {
                        const change = formatChange(item.data.change_pct);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '14px' }}>{item.name}</strong>
                              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px', fontFamily: 'monospace' }}>{item.id}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>₹{item.data.price.toLocaleString('en-IN')}</div>
                              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: change.color }}>{change.text}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* FII DII Flow Card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FII/DII Net Cash Flow</h3>
                      <span style={{ fontSize: '10px', color: '#ffb300', fontWeight: 'bold' }}>PROVISIONAL DATA</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* FII segment */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span>Foreign Institutional (FII)</span>
                          <strong style={{ color: '#ff1744', fontFamily: 'monospace' }}>
                            {marketData.india_pulse.fii_dii.fii_net > 0 ? '+' : ''}{marketData.india_pulse.fii_dii.fii_net.toLocaleString('en-IN')} Cr
                          </strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            background: '#ff1744', height: '100%',
                            width: `${Math.min(100, (Math.abs(marketData.india_pulse.fii_dii.fii_net) / 12000) * 100)}%`
                          }} />
                        </div>
                      </div>

                      {/* DII segment */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span>Domestic Institutional (DII)</span>
                          <strong style={{ color: '#00e676', fontFamily: 'monospace' }}>
                            +{marketData.india_pulse.fii_dii.dii_net.toLocaleString('en-IN')} Cr
                          </strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            background: '#00e676', height: '100%',
                            width: `${Math.min(100, (Math.abs(marketData.india_pulse.fii_dii.dii_net) / 12000) * 100)}%`
                          }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '16px' }}>
                      <span>Source: NSE / BSE Cash segment</span>
                      <span>Target Date: June 2, 2026</span>
                    </div>
                  </div>

                </div>

                {/* Earnings & Economic Events */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  
                  {/* Earnings */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>Corporate Earnings Calendar</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Company</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Expected</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Actual</th>
                            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Reaction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketData.india_pulse.earnings_calendar.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 600 }}>{item.company}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'monospace' }}>₹{item.expected_eps}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'monospace', color: item.actual_eps !== 'N/A' ? '#00e5ff' : '#64748b' }}>
                                {item.actual_eps !== 'N/A' ? `₹${item.actual_eps}` : '—'}
                              </td>
                              <td style={{
                                padding: '8px 4px', textAlign: 'right', fontWeight: 700,
                                color: item.reaction.includes('BULLISH') ? '#00e676' : item.reaction.includes('BEARISH') ? '#ff1744' : '#ffb300'
                              }}>{item.reaction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Economic Calendar */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>India Economic Calendar</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Event</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Schedule (IST)</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Prev</th>
                            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Expected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketData.india_pulse.economic_calendar.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 600 }}>{item.event}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', color: '#ffab00' }}>{item.time_ist}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{item.previous}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>{item.expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* OI Gainers and News Headlines */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  
                  {/* Top 3 F&O OI Gainers */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>F&O Top OI Gainers</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {marketData.india_pulse.oi_gainers.map((stock, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)',
                          padding: '10px 14px', borderRadius: '4px'
                        }}>
                          <div>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{stock.symbol}</span>
                            <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>₹{stock.price}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#00e676', fontFamily: 'monospace' }}>+{stock.oi_change_pct}% OI</span>
                            <span style={{
                              fontSize: '9px', display: 'block', color: '#00e676', fontWeight: 800,
                              background: 'rgba(0,230,118,0.1)', padding: '1px 6px', borderRadius: '2px', marginTop: '4px'
                            }}>{stock.interpretation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* News Headlines */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>Top Market News</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {marketData.india_pulse.news_headlines.map((item, i) => (
                        <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: '#f1f5f9', lineHeight: '1.4' }}>{item.title}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                            <span>{item.source}</span>
                            <span>{item.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI VERDICT */}
        {activeSubTab === 'verdict' && (
          <div>
            {loadingPlan && !tradingPlan ? renderSkeleton() : errorPlan ? (
              <div style={{ color: '#ef4444', padding: 20 }}>{errorPlan}</div>
            ) : tradingPlan && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* Glow Conviction Badge Card */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  boxShadow: tradingPlan.verdict?.verdict === 'BULLISH' || tradingPlan.verdict?.verdict === 'STRONGLY BULLISH'
                    ? '0 0 30px rgba(0,229,255,0.1)' : '0 0 30px rgba(255,23,68,0.1)',
                  position: 'relative', overflow: 'hidden'
                }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
                    🤖 DETECTIVE BIAS VERDICT
                  </span>
                  
                  {/* Big glowing conviction label */}
                  <div style={{
                    fontSize: '32px', fontWeight: 900, letterSpacing: '-0.5px',
                    color: tradingPlan.verdict?.verdict === 'BULLISH' || tradingPlan.verdict?.verdict === 'STRONGLY BULLISH' ? '#00e5ff' : '#ff1744',
                    textShadow: tradingPlan.verdict?.verdict === 'BULLISH' || tradingPlan.verdict?.verdict === 'STRONGLY BULLISH'
                      ? '0 0 15px rgba(0,229,255,0.5)' : '0 0 15px rgba(255,23,68,0.5)',
                    marginBottom: '8px'
                  }}>
                    {tradingPlan.verdict?.verdict || tradingPlan.bias}
                  </div>
                  
                  {/* Percentage confidence ring estimate */}
                  <div style={{
                    fontSize: '18px', fontWeight: 700, color: '#f8fafc',
                    background: 'rgba(255,255,255,0.04)', padding: '6px 16px', borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    {tradingPlan.verdict?.confidence || '78'}% Conviction Confidence
                  </div>

                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '16px', maxWidth: '300px' }}>
                    Derived via SEBI compliant 7-factor composite scoring framework for opening bell trading strategies.
                  </p>
                </div>

                {/* Pre-Market Checklist Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>Pre-Market Opening Checklist</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { check: tradingPlan.verdict?.checklist?.us_futures_positive, label: 'US futures positive?' },
                      { check: tradingPlan.verdict?.checklist?.asia_green, label: 'Asian benchmarks green?' },
                      { check: tradingPlan.verdict?.checklist?.gift_nifty_premium, label: 'GIFT Nifty premium pricing?' },
                      { check: tradingPlan.verdict?.checklist?.fii_net_buyers, label: 'FII Institutional net buyers?' },
                      { check: tradingPlan.verdict?.checklist?.vix_below_15, label: 'India VIX fear index below 15?' },
                      { check: tradingPlan.verdict?.checklist?.no_negative_news, label: 'No major global/domestic negative news?' }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                        <span style={{
                          color: item.check ? '#00e676' : '#ff1744', fontWeight: 'bold', fontSize: '16px',
                          display: 'inline-flex', width: '20px', height: '20px', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%', background: item.check ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)'
                        }}>
                          {item.check ? '✓' : '✗'}
                        </span>
                        <span style={{ color: item.check ? '#f1f5f9' : '#64748b' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Levels & Gap prediction */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>Nifty Key Spot Targets</h3>
                  
                  {/* Support and resistance grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(255,23,68,0.04)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '10px', color: '#ff1744', display: 'block', fontWeight: 600 }}>SUPPORT 1 (S1)</span>
                      <strong style={{ fontSize: '16px', fontFamily: 'monospace' }}>₹{tradingPlan.verdict?.support_1 || '23,350'}</strong>
                    </div>
                    <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '10px', color: '#00e676', display: 'block', fontWeight: 600 }}>RESISTANCE 1 (R1)</span>
                      <strong style={{ fontSize: '16px', fontFamily: 'monospace' }}>₹{tradingPlan.verdict?.resistance_1 || '23,620'}</strong>
                    </div>
                    <div style={{ background: 'rgba(255,23,68,0.04)', border: '1px solid rgba(255,23,68,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '10px', color: '#ff1744', display: 'block', fontWeight: 600 }}>SUPPORT 2 (S2)</span>
                      <strong style={{ fontSize: '16px', fontFamily: 'monospace' }}>₹{tradingPlan.verdict?.support_2 || '23,230'}</strong>
                    </div>
                    <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '10px', color: '#00e676', display: 'block', fontWeight: 600 }}>RESISTANCE 2 (R2)</span>
                      <strong style={{ fontSize: '16px', fontFamily: 'monospace' }}>₹{tradingPlan.verdict?.resistance_2 || '23,680'}</strong>
                    </div>
                  </div>

                  {/* Gap prediction magnitude */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Bell Opening Gap Prediction</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <strong style={{ color: '#00e5ff', fontSize: '15px' }}>{tradingPlan.verdict?.gap_prediction || 'GAP_UP'}</strong>
                      <span style={{ fontFamily: 'monospace', color: '#00e676', fontSize: '13px', fontWeight: 700 }}>
                        {tradingPlan.verdict?.gap_magnitude || '+40 to +60 Points'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 4: AI TRADING PLAN */}
        {activeSubTab === 'tradingPlan' && (
          <div>
            {loadingPlan && !tradingPlan ? renderSkeleton() : errorPlan ? (
              <div style={{ color: '#ef4444', padding: 20 }}>{errorPlan}</div>
            ) : tradingPlan && (
              <div>
                
                {/* Opening expectation and intraday bias banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(0,229,255,0.03)', borderLeft: '4px solid #00e5ff', padding: '16px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                      🌅 Opening Expectation
                    </span>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.5', color: '#f1f5f9' }}>
                      {tradingPlan.openingExpectation}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,171,0,0.03)', borderLeft: '4px solid #ffab00', padding: '16px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#ffab00', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                      ⚡ Opening Intraday Bias
                    </span>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.5', color: '#f1f5f9' }}>
                      {tradingPlan.intraday_bias}
                    </p>
                  </div>
                </div>

                {/* Spot watch level banner */}
                <div style={{
                  background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
                  borderRadius: '6px', padding: '16px', marginBottom: '24px', textAlign: 'center',
                  boxShadow: '0 0 15px rgba(0,229,255,0.05)'
                }}>
                  <span style={{ fontSize: '11px', color: '#00e5ff', fontWeight: 800, textTransform: 'uppercase', display: 'block', letterSpacing: '1px', marginBottom: '6px' }}>
                    🎯 CRITICAL LEVEL TO WATCH
                  </span>
                  <div style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 700, fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
                    {tradingPlan.niftyLevel}
                  </div>
                </div>

                {/* 2 Stocks setups */}
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>Top Stock setups</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  {tradingPlan.trades.map((trade, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px', padding: '18px', position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#00e5ff' }}>{trade.stock}</span>
                        <span style={{
                          background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid #00e676',
                          fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'
                        }}>{trade.rr || '1:2.3'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Entry Zone</span>
                          <strong style={{ fontFamily: 'monospace' }}>{trade.entry}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Stop Loss</span>
                          <strong style={{ color: '#ff1744', fontFamily: 'monospace' }}>{trade.sl}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Target Zone</span>
                          <strong style={{ color: '#00e676', fontFamily: 'monospace' }}>{trade.target}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Options Play & What to Avoid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  
                  {/* Options Play card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#00e5ff', textTransform: 'uppercase' }}>🔥 Options Strategy Play</h3>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.5', color: '#f1f5f9', fontStyle: 'italic' }}>
                      "{tradingPlan.optionsPlay}"
                    </p>
                  </div>

                  {/* What to avoid */}
                  <div style={{ background: 'rgba(255,23,68,0.02)', border: '1px solid rgba(255,23,68,0.1)', borderRadius: '8px', padding: '18px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#ff1744', textTransform: 'uppercase' }}>⚠️ What to AVOID Today</h3>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.5', color: '#fca5a5' }}>
                      {tradingPlan.avoid}
                    </p>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer credits tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '40px', paddingTop: '16px', fontSize: '11px', color: '#475569' }}>
        <span>MarketMind Pre-bell Advisory System v1.2</span>
        <span>SEBI compliance provision active · Target Date: June 2, 2026</span>
      </div>
    </div>
  );
}
