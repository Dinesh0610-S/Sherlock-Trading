import React, { useState, useEffect, useRef } from 'react';
import { useMarketStatus } from '../hooks/useMarketStatus';
import { useNSELiveData } from '../hooks/useNSELiveData';

export default function NavBar({ activeTab, onTabChange }) {
  const [proxyHealth, setProxyHealth] = useState('CHECKING');
  const marketStatus = useMarketStatus();
  const [marketTime, setMarketTime] = useState(() => new Date().toTimeString().split(' ')[0]);

  // NSE Live Data for indices and ticker tape
  const nseData = useNSELiveData('NIFTY');

  const [tickerTape, setTickerTape] = useState([
    { symbol: 'NIFTY 50', price: '23,242.10', change: '+0.52%' },
    { symbol: 'BANK NIFTY', price: '55,194.50', change: '+0.17%' },
    { symbol: 'RELIANCE', price: '1,269.20', change: '+0.33%' },
    { symbol: 'HDFC BANK', price: '738.35', change: '+0.15%' },
    { symbol: 'TCS', price: '2,151.00', change: '+0.25%' },
    { symbol: 'INFY', price: '1,180.30', change: '-0.10%' }
  ]);

  const [tickerFlash, setTickerFlash] = useState({});
  const prevTickerPricesRef = useRef({});

  // Proxy Health poll
  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' || data.status === 'OK') {
            setProxyHealth('ONLINE');
            return;
          }
        }
        setProxyHealth('OFFLINE');
      } catch (err) {
        setProxyHealth('OFFLINE');
      }
    };
    pollHealth();
    const id = setInterval(pollHealth, 10000);
    return () => clearInterval(id);
  }, []);

  // Market clock tick
  useEffect(() => {
    const updateClock = () => {
      setMarketTime(new Date().toTimeString().split(' ')[0]);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ticker Tape updates from nseData.indices
  useEffect(() => {
    if (!nseData.indices || nseData.indices.length === 0) return;

    // build index lookup
    const lookup = {};
    nseData.indices.forEach(idx => {
      lookup[idx.name] = idx;
      if (idx.name === 'NIFTY 50') lookup['NIFTY 50'] = idx;
      if (idx.name === 'NIFTY BANK') lookup['BANK NIFTY'] = idx;
    });

    // Tick/flash detections
    const newFlash = {};
    let anyFlash = false;
    Object.entries(lookup).forEach(([displayName, idx]) => {
      const newPrice  = idx.last;
      const prevPrice = prevTickerPricesRef.current[displayName];
      if (
        typeof newPrice === 'number' && isFinite(newPrice) && newPrice > 0 &&
        prevPrice !== undefined && newPrice !== prevPrice
      ) {
        newFlash[displayName] = newPrice > prevPrice ? 'flash-green-text' : 'flash-red-text';
        anyFlash = true;
      }
      if (typeof newPrice === 'number' && isFinite(newPrice) && newPrice > 0) {
        prevTickerPricesRef.current[displayName] = newPrice;
      }
    });

    if (anyFlash) {
      setTickerFlash(newFlash);
      setTimeout(() => setTickerFlash({}), 800);
    }

    setTickerTape(prev => prev.map(item => {
      const match = lookup[item.symbol];
      if (match && typeof match.last === 'number' && isFinite(match.last) && match.last > 0) {
        return {
          ...item,
          price:    match.last.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          change:   `${match.percentChange >= 0 ? '+' : ''}${match.percentChange.toFixed(2)}%`,
          realData: true
        };
      }
      return item;
    }));
  }, [nseData.indices]);

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="brand-logo">🕵️‍♂️</span>
          <span className="brand-title">Sherlock Holmes Deductive Trading Engine</span>
        </div>
        <div className="header-meta">
          <div className="meta-item">
            <span className="badge-live">Live</span>
          </div>
          <div className="meta-item">
            <span style={{
              background: proxyHealth === 'ONLINE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: proxyHealth === 'ONLINE' ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4, padding: '2px 8px', fontSize: 10,
              color: proxyHealth === 'ONLINE' ? '#22c55e' : '#ef4444',
              fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              transition: 'all 0.3s ease'
            }}>
              🔌 PROXY: {proxyHealth}
            </span>
          </div>
          {nseData.isLive && (
            <div className="meta-item">
              <span style={{
                background: 'rgba(0,201,167,0.15)', border: '1px solid rgba(0,201,167,0.4)',
                borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#00c9a7',
                fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase'
              }}>
                📡 NSE LIVE
              </span>
            </div>
          )}
          {nseData.error && (
            <div className="meta-item">
              <span style={{
                background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)',
                borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#ffaa00',
                fontWeight: 600, letterSpacing: '0.5px'
              }}>
                ⚠️ NSE Fallback
              </span>
            </div>
          )}
          <div className="meta-item">
            <span id="header-market-status" className={`badge-market-status ${marketStatus.status.toLowerCase()}`}>
              <span className="dot"></span>
              Market: {marketStatus.status}
            </span>
          </div>
          <div className="meta-item">
            <span>Market Time:</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{marketTime}</span>
          </div>
        </div>
      </header>

      {/* Ticker Tape */}
      <div className="ticker-tape">
        <div className="ticker-wrap">
          <div className="ticker-container">
            {tickerTape.concat(tickerTape).map((item, idx) => {
              const flashCls = tickerFlash[item.symbol] || '';
              return (
                <div className="ticker-item" key={idx}>
                  <span className="ticker-name">{item.symbol}</span>
                  <span
                    className={`ticker-val ${flashCls}`}
                    style={{ color: item.change.startsWith('+') ? 'var(--green)' : 'var(--red)' }}
                  >
                    {item.price} ({item.change})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="container" style={{ paddingBottom: 0 }}>
        <nav className="nav-tabs" style={{ marginBottom: 16 }}>
          <button 
            className={`nav-tab ${activeTab === 'clueBoard' ? 'active' : ''}`} 
            onClick={() => onTabChange('clueBoard')}
            title="Clue Board (press 1)"
          >
            🔎 Clue Board
          </button>
          <button 
            className={`nav-tab ${activeTab === 'sherlockAnalysis' ? 'active' : ''}`} 
            onClick={() => onTabChange('sherlockAnalysis')}
            title="Sherlock Verdict (press 2)"
          >
            🔬 Sherlock Verdict
          </button>
          <button 
            id="rr-calculator-tab" 
            className={`nav-tab ${activeTab === 'rrCalculator' ? 'active' : ''}`} 
            onClick={() => onTabChange('rrCalculator')}
            title="RR Calculator (press 3)"
          >
            ⚖️ RR Calculator
          </button>
          <button 
            className={`nav-tab ${activeTab === 'optionChain' ? 'active' : ''}`} 
            onClick={() => onTabChange('optionChain')}
            title="Option Intelligence (press 4)"
          >
            📊 Option Intelligence
          </button>
          <button 
            id="journal-tab" 
            className={`nav-tab ${activeTab === 'journal' ? 'active' : ''}`} 
            onClick={() => onTabChange('journal')}
            title="Trade Journal (press 5)"
          >
            📁 Trade Journal
          </button>
          <button 
            id="fii-dii-tab" 
            className={`nav-tab ${activeTab === 'fiiDii' ? 'active' : ''}`} 
            onClick={() => onTabChange('fiiDii')}
            title="FII/DII Flow (press 6)"
          >
            💰 FII/DII Flow
          </button>
          <button 
            id="morning-brief-tab" 
            className={`nav-tab ${activeTab === 'morningBrief' ? 'active' : ''}`} 
            onClick={() => onTabChange('morningBrief')}
            title="Morning Brief (press 7)"
          >
            🌅 Morning Brief
          </button>
          <button 
            id="pre-market-tab" 
            className={`nav-tab ${activeTab === 'preMarket' ? 'active' : ''}`} 
            onClick={() => onTabChange('preMarket')}
            title="Pre-Market Intel (press 8)"
          >
            ⚡ Pre-Market Intel
          </button>
          <button 
            id="backtester-tab" 
            className={`nav-tab ${activeTab === 'backtester' ? 'active' : ''}`} 
            onClick={() => onTabChange('backtester')}
            title="Backtester (press 9)"
          >
            🔬 Backtester
          </button>
          <button 
            id="sherlock-bot-tab" 
            className={`nav-tab ${activeTab === 'sherlockBot' ? 'active' : ''}`} 
            onClick={() => onTabChange('sherlockBot')}
            title="Holmes AI (press 0)"
          >
            🕵️ Holmes AI
          </button>
        </nav>
      </div>
    </>
  );
}
