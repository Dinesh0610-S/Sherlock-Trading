import React, { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Backtester() {
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestStats, setBacktestStats] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestAiAnalysis, setBacktestAiAnalysis] = useState(null);
  const [backtestAiLoading, setBacktestAiLoading] = useState(false);
  const [backtestSubTab, setBacktestSubTab] = useState('summary');
  const [backtestConfig, setBacktestConfig] = useState({
    ticker: 'RELIANCE.NS',
    period: '6mo',
    interval: '1d',
    strategy: 'ALL',
    slPct: '1.2',
    t1Pct: '1.8',
    t2Pct: '3.0',
    t1ExitPct: '50',
    capital: '100000',
    maxHold: '5',
    cooldown: '2'
  });

  const STOCK_UNIVERSE = {
    'RELIANCE.NS': 'Reliance',
    'TCS.NS': 'TCS',
    'HDFCBANK.NS': 'HDFC Bank',
    'INFY.NS': 'Infosys',
    'ICICIBANK.NS': 'ICICI Bank',
    'HINDUNILVR.NS': 'HUL',
    'SBIN.NS': 'SBI',
    'BHARTIARTL.NS': 'Bharti Airtel',
    'ITC.NS': 'ITC',
    'LT.NS': 'L&T',
    'KOTAKBANK.NS': 'Kotak Bank',
    'AXISBANK.NS': 'Axis Bank',
    'ASIANPAINT.NS': 'Asian Paint',
    'MARUTI.NS': 'Maruti',
    'TITAN.NS': 'Titan',
    'SUNPHARMA.NS': 'Sun Pharma',
    'WIPRO.NS': 'Wipro',
    'HCLTECH.NS': 'HCL Tech',
    'BAJFINANCE.NS': 'Bajaj Fin',
    'POWERGRID.NS': 'Power Grid',
    '^NSEI': 'Nifty 50',
    '^NSEBANK': 'Bank Nifty'
  };

  const handleConfigChange = (key, val) => {
    setBacktestConfig(prev => ({ ...prev, [key]: val }));
  };

  const runBacktest = async () => {
    setBacktestLoading(true);
    setBacktestResult(null);
    setBacktestStats(null);
    setBacktestAiAnalysis(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: backtestConfig.ticker,
          period: backtestConfig.period,
          interval: backtestConfig.interval,
          strategy: backtestConfig.strategy,
          sl_pct: parseFloat(backtestConfig.slPct),
          t1_pct: parseFloat(backtestConfig.t1Pct),
          t2_pct: parseFloat(backtestConfig.t2Pct),
          t1_exit_pct: parseFloat(backtestConfig.t1ExitPct),
          capital: parseFloat(backtestConfig.capital),
          max_hold: parseInt(backtestConfig.maxHold, 10),
          cooldown: parseInt(backtestConfig.cooldown, 10)
        })
      });
      if (res.ok) {
        const json = await res.json();
        setBacktestResult(json.trades || []);
        setBacktestStats(json.stats || null);
        setBacktestSubTab('summary');
      } else {
        const err = await res.json();
        alert(`Backtest error: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Error running backtest:', e);
      alert('Failed to connect to backtest server.');
    } finally {
      setBacktestLoading(false);
    }
  };

  const fetchBacktestAi = async () => {
    if (!backtestResult || backtestResult.length === 0 || !backtestStats) return;
    setBacktestAiLoading(true);
    try {
      const res = await fetch('/api/backtest/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trades: backtestResult,
          stats: backtestStats,
          ticker: backtestConfig.ticker,
          period: backtestConfig.period,
          interval: backtestConfig.interval,
          strategy: backtestConfig.strategy
        })
      });
      if (res.ok) {
        const json = await res.json();
        setBacktestAiAnalysis(json);
      }
    } catch (e) {
      console.error('Error fetching backtest AI analysis:', e);
    } finally {
      setBacktestAiLoading(false);
    }
  };

  // Group by result for display
  let tradesByResult = [];
  let tradesBySignal = [];
  let stdDev = 0;
  let sharpeRatio = 0;
  let calmarRatio = 0;
  let consistencyScore = 0;

  if (backtestResult && backtestResult.length > 0) {
    const results = {};
    const signals = {};

    backtestResult.forEach(t => {
      if (!results[t.result]) {
        results[t.result] = { count: 0, sum: 0 };
      }
      results[t.result].count += 1;
      results[t.result].sum += t.pnl_inr;

      if (!signals[t.sig_name]) {
        signals[t.sig_name] = { count: 0, wins: 0, sum: 0 };
      }
      signals[t.sig_name].count += 1;
      signals[t.sig_name].sum += t.pnl_inr;
      if (t.pnl_inr > 0) {
        signals[t.sig_name].wins += 1;
      }
    });

    tradesByResult = Object.keys(results).map(r => ({
      result: r,
      count: results[r].count,
      total_pnl: results[r].sum,
      avg_pnl: results[r].sum / results[r].count
    }));

    tradesBySignal = Object.keys(signals).map(s => ({
      signal: s,
      trades: signals[s].count,
      win_rate: (signals[s].wins / signals[s].count) * 100,
      total_pnl: signals[s].sum,
      avg_pnl: signals[s].sum / signals[s].count
    }));

    const pnlPctValues = backtestResult.map(t => parseFloat(t.pnl_pct) || 0);
    const totalTrades = backtestResult.length;
    const avgReturn = pnlPctValues.reduce((sum, val) => sum + val, 0) / totalTrades;
    const variance = pnlPctValues.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / totalTrades;
    stdDev = Math.sqrt(variance);
    
    const cv = avgReturn !== 0 ? stdDev / Math.abs(avgReturn) : 0;
    sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    const capital = parseFloat(backtestConfig.capital) || 100000.0;
    const totalReturnPct = backtestStats ? (backtestStats.total_pnl / capital) * 100 : 0;
    const maxDrawdownPct = backtestStats ? parseFloat(backtestStats.max_drawdown_pct) : 0;
    calmarRatio = maxDrawdownPct > 0 ? totalReturnPct / maxDrawdownPct : (totalReturnPct > 0 ? 99.9 : 0);
    
    const winRate = backtestStats ? parseFloat(backtestStats.win_rate) : 0;
    const cvFactor = 1 / (1 + cv);
    consistencyScore = Math.max(0, Math.min(100, winRate * cvFactor));
  }

  // Build charts data
  let equityChartData = null;
  let pnlChartData = null;
  let ddChartData = null;

  if (backtestResult && backtestResult.length > 0 && backtestStats) {
    const labels = backtestResult.map((t, idx) => `Trade #${idx + 1} (${t.date})`);
    const capital = parseFloat(backtestConfig.capital);
    
    const equities = backtestResult.map(t => t.capital_after);
    equityChartData = {
      labels: ['Start', ...labels],
      datasets: [{
        label: 'Portfolio Equity (₹)',
        data: [capital, ...equities],
        borderColor: '#00e676',
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 3
      }]
    };

    const pnls = backtestResult.map(t => t.pnl_inr);
    pnlChartData = {
      labels: labels,
      datasets: [{
        label: 'Trade P&L (₹)',
        data: pnls,
        backgroundColor: pnls.map(p => p >= 0 ? 'rgba(0, 230, 118, 0.65)' : 'rgba(255, 77, 77, 0.65)'),
        borderColor: pnls.map(p => p >= 0 ? '#00e676' : '#ff4d4d'),
        borderWidth: 1,
        borderRadius: 4
      }]
    };

    let peak = 0;
    const drawdowns = backtestResult.map((t, idx) => {
      const cumPnl = backtestResult.slice(0, idx + 1).reduce((acc, curr) => acc + curr.pnl_inr, 0);
      if (cumPnl > peak) peak = cumPnl;
      return cumPnl - peak;
    });

    ddChartData = {
      labels: labels,
      datasets: [{
        label: 'Drawdown (₹)',
        data: drawdowns,
        borderColor: '#ff4d4d',
        backgroundColor: 'rgba(255, 77, 77, 0.15)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.1,
        pointRadius: 2
      }]
    };
  }

  const downloadCSV = () => {
    if (!backtestResult || backtestResult.length === 0) return;
    const headers = ['Date', 'Ticker', 'Signal', 'Strategy', 'Entry', 'SL', 'T1', 'T2', 'Exit Price', 'Result', 'P&L %', 'P&L INR', 'Shares', 'RSI', 'Vol Ratio', 'Trend'];
    const rows = backtestResult.map(t => [
      t.date, t.ticker, t.signal, t.sig_name, t.entry, t.sl, t.t1, t.t2, t.exit_price, t.result, t.pnl_pct, t.pnl_inr, t.shares, t.rsi_entry, t.vol_ratio, t.ema_cross
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sherlock_backtest_${backtestConfig.ticker}_${backtestConfig.period}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full box-border">
      {/* Configuration panel */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">🔬 Backtest Configuration Panel</div>
        </div>
        <div className="card-body" style={{ padding: 20 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 w-full box-border">
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Stock / Index</label>
              <select value={backtestConfig.ticker} onChange={(e) => handleConfigChange('ticker', e.target.value)} style={{ width: '100%', padding: '6px 10px' }}>
                {Object.keys(STOCK_UNIVERSE).map(k => (
                  <option key={k} value={k}>{STOCK_UNIVERSE[k]} ({k})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Lookback Period</label>
              <select value={backtestConfig.period} onChange={(e) => handleConfigChange('period', e.target.value)} style={{ width: '100%', padding: '6px 10px' }}>
                <option value="1mo">1 Month</option>
                <option value="3mo">3 Months</option>
                <option value="6mo">6 Months</option>
                <option value="1y">1 Year</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Interval</label>
              <select value={backtestConfig.interval} onChange={(e) => handleConfigChange('interval', e.target.value)} style={{ width: '100%', padding: '6px 10px' }}>
                <option value="1d">Daily (swing)</option>
                <option value="1h">Hourly (intraday)</option>
                <option value="15m">15-minute (intraday)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Strategy</label>
              <select value={backtestConfig.strategy} onChange={(e) => handleConfigChange('strategy', e.target.value)} style={{ width: '100%', padding: '6px 10px' }}>
                <option value="ALL">ALL signals</option>
                <option value="EMA_CROSSOVER">EMA Crossover</option>
                <option value="VWAP_BOUNCE">VWAP Bounce</option>
                <option value="RSI_MOMENTUM">RSI Momentum</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4 w-full box-border">
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Capital (₹)</label>
              <input type="number" value={backtestConfig.capital} onChange={(e) => handleConfigChange('capital', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Stop-loss %</label>
              <input type="number" step="0.1" value={backtestConfig.slPct} onChange={(e) => handleConfigChange('slPct', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Target 1 %</label>
              <input type="number" step="0.1" value={backtestConfig.t1Pct} onChange={(e) => handleConfigChange('t1Pct', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Target 2 %</label>
              <input type="number" step="0.1" value={backtestConfig.t2Pct} onChange={(e) => handleConfigChange('t2Pct', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>T1 Exit %</label>
              <input type="number" value={backtestConfig.t1ExitPct} onChange={(e) => handleConfigChange('t1ExitPct', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: 12 }}>
              <div style={{ width: 140 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Max hold (bars)</label>
                <input type="number" value={backtestConfig.maxHold} onChange={(e) => handleConfigChange('maxHold', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
              </div>
              <div style={{ width: 140 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Cooldown (bars)</label>
                <input type="number" value={backtestConfig.cooldown} onChange={(e) => handleConfigChange('cooldown', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
              </div>
            </div>

            <button className="btn btn-gold" onClick={runBacktest} disabled={backtestLoading} style={{ minWidth: 200, height: 38 }}>
              {backtestLoading ? '🔍 Running Simulation...' : '▶ Run Backtest'}
            </button>
          </div>
        </div>
      </div>

      {/* Backtest Results Display */}
      {!backtestResult && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Configure the backtester parameters above and click "Run Backtest" to begin investigation.
        </div>
      )}

      {backtestResult && (
        <div>
          {/* Results Tab Controls */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">🔍 Backtest Output: {STOCK_UNIVERSE[backtestConfig.ticker]} ({backtestConfig.ticker})</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['summary', 'equity', 'log', 'ai'].map(tab => (
                  <button key={tab}
                    className={`btn btn-sm ${backtestSubTab === tab ? 'btn-gold' : 'btn-secondary'}`}
                    onClick={() => setBacktestSubTab(tab)}>
                    {tab === 'summary' ? 'Summary' : tab === 'equity' ? 'Equity Curve'
                      : tab === 'log' ? 'Trade Log' : 'AI Verdict'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SUB-TAB: SUMMARY */}
          {backtestSubTab === 'summary' && (
            <div>
              {backtestStats && (
                <div>
                  {/* Row 1 Metrics */}
                  <div className="metric-grid w-full box-border" style={{ marginBottom: 16 }}>
                    <div className="metric-card">
                      <div className="metric-label">Total Trades</div>
                      <div className="metric-value">{backtestStats.total}</div>
                      <div className="metric-sub">Over series</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Win Rate</div>
                      <div className={`metric-value ${backtestStats.win_rate >= 50 ? 'metric-val-green' : backtestStats.win_rate >= 40 ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {backtestStats.win_rate}%
                      </div>
                      <div className="metric-sub">{backtestStats.wins}W / {backtestStats.losses}L</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Total P&L</div>
                      <div className={`metric-value ${backtestStats.total_pnl >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                        {backtestStats.total_pnl >= 0 ? '+' : ''}₹{backtestStats.total_pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="metric-sub">Net profit</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Profit Factor</div>
                      <div className={`metric-value ${backtestStats.profit_factor >= 1.5 ? 'metric-val-green' : backtestStats.profit_factor >= 1.0 ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {backtestStats.profit_factor}
                      </div>
                      <div className="metric-sub">&gt;1.5 = edge exists</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Expectancy / Trade</div>
                      <div className={`metric-value ${backtestStats.expectancy >= 0 ? 'metric-val-green' : 'metric-val-red'}`}>
                        ₹{backtestStats.expectancy.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="metric-sub">Expected trade P&L</div>
                    </div>
                  </div>

                  {/* Row 2 Metrics */}
                  <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="metric-card">
                      <div className="metric-label">Avg Win</div>
                      <div className="metric-value metric-val-green">₹{backtestStats.avg_win.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="metric-sub">Per winning trade</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Avg Loss</div>
                      <div className="metric-value metric-val-red">₹{backtestStats.avg_loss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="metric-sub">Per losing trade</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Max Drawdown</div>
                      <div className="metric-value metric-val-red">
                        {backtestStats.max_drawdown_pct}%
                      </div>
                      <div className="metric-sub">₹{backtestStats.max_drawdown_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} peak-to-trough</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Best Trade</div>
                      <div className="metric-value metric-val-green">₹{backtestStats.best_trade.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="metric-sub">Single highest profit</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Worst Trade</div>
                      <div className="metric-value metric-val-red">₹{backtestStats.worst_trade.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="metric-sub">Single largest loss</div>
                    </div>
                  </div>

                  {/* Row 3 Institutional Metrics */}
                  <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="metric-card">
                      <div className="metric-label">Sharpe Ratio</div>
                      <div className={`metric-value ${sharpeRatio >= 1.5 ? 'metric-val-green' : sharpeRatio >= 1.0 ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {sharpeRatio.toFixed(2)}
                      </div>
                      <div className="metric-sub">Avg Return / Volatility</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Calmar Ratio</div>
                      <div className={`metric-value ${calmarRatio >= 2.0 ? 'metric-val-green' : calmarRatio >= 1.0 ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {calmarRatio.toFixed(2)}
                      </div>
                      <div className="metric-sub">Total Return / Max DD</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Consistency Score</div>
                      <div className={`metric-value ${consistencyScore >= 60 ? 'metric-val-green' : consistencyScore >= 40 ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {consistencyScore.toFixed(1)}%
                      </div>
                      <div className="metric-sub">Win% & CV adjusted</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Return Volatility</div>
                      <div className="metric-value metric-val-gold">
                        {stdDev.toFixed(2)}%
                      </div>
                      <div className="metric-sub">Std Dev of trade returns</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Breakdown tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border" style={{ marginTop: 20 }}>
                {/* Signal Type Table */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-header">
                    <div className="card-title">By Signal Type</div>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Signal</th>
                            <th>Trades</th>
                            <th>Win Rate</th>
                            <th>Avg P&L</th>
                            <th>Total P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradesBySignal.map(ts => (
                            <tr key={ts.signal}>
                              <td style={{ fontWeight: 600 }}>{ts.signal}</td>
                              <td>{ts.trades}</td>
                              <td>{ts.win_rate.toFixed(1)}%</td>
                              <td style={{ color: ts.avg_pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {ts.avg_pnl >= 0 ? '+' : ''}₹{ts.avg_pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td style={{ color: ts.total_pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {ts.total_pnl >= 0 ? '+' : ''}₹{ts.total_pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                          {tradesBySignal.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No signal breakdown data available.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Trade Result Table */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-header">
                    <div className="card-title">By Trade Result</div>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Result</th>
                            <th>Count</th>
                            <th>Avg P&L</th>
                            <th>Total P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradesByResult.map(tr => (
                            <tr key={tr.result}>
                              <td style={{ fontWeight: 600, color: tr.result === 'T2' ? 'var(--green)' : tr.result === 'SL' ? 'var(--red)' : 'var(--gold)' }}>
                                {tr.result === 'T2' ? 'T2 (full target)' : tr.result === 'T1' ? 'T1 (partial exit)' : tr.result === 'SL' ? 'SL (stopped out)' : 'TIMEOUT'}
                              </td>
                              <td>{tr.count}</td>
                              <td style={{ color: tr.avg_pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {tr.avg_pnl >= 0 ? '+' : ''}₹{tr.avg_pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td style={{ color: tr.total_pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {tr.total_pnl >= 0 ? '+' : ''}₹{tr.total_pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                          {tradesByResult.length === 0 && (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No result breakdown data available.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB: EQUITY CURVE */}
          {backtestSubTab === 'equity' && (
            <div>
              {equityChartData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                      <div className="card-title">💹 Equity Growth Curve</div>
                    </div>
                    <div className="card-body" style={{ height: 320 }}>
                      <Line
                        data={equityChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } },
                            y: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } }
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                      <div className="card-title">📊 Per-Trade P&L (INR)</div>
                    </div>
                    <div className="card-body" style={{ height: 220 }}>
                      <Bar
                        data={pnlChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } },
                            y: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } }
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                      <div className="card-title">📉 Drawdown from Peak</div>
                    </div>
                    <div className="card-body" style={{ height: 180 }}>
                      <Line
                        data={ddChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } },
                            y: { grid: { color: '#1e2d3d' }, ticks: { color: '#8a9ab0', font: { family: 'IBM Plex Mono', size: 9 } } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: TRADE LOG */}
          {backtestSubTab === 'log' && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">📋 Full Simulation Trade Log</div>
                <button className="btn btn-secondary btn-sm" onClick={downloadCSV}>
                  ⬇ Download CSV Log
                </button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Dir</th>
                        <th>Signal</th>
                        <th>Entry</th>
                        <th>SL</th>
                        <th>T1</th>
                        <th>T2</th>
                        <th>Exit Price</th>
                        <th>Result</th>
                        <th>P&L %</th>
                        <th>P&L ₹</th>
                        <th>RSI</th>
                        <th>VolRatio</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestResult.map((t, idx) => (
                        <tr key={idx}>
                          <td>{t.date}</td>
                          <td style={{ fontWeight: 'bold', color: t.signal === 'LONG' ? 'var(--green)' : 'var(--red)' }}>{t.signal}</td>
                          <td>{t.sig_name}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{t.entry}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{t.sl}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{t.t1}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{t.t2}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{t.exit_price}</td>
                          <td style={{
                            fontWeight: 'bold',
                            color: t.result === 'T2' ? 'var(--green)' : t.result === 'SL' ? 'var(--red)' : 'var(--gold)'
                          }}>
                            {t.result}
                          </td>
                          <td style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            color: t.pnl_pct >= 0 ? 'var(--green)' : 'var(--red)'
                          }}>
                            {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct}%
                          </td>
                          <td style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontWeight: 'bold',
                            color: t.pnl_inr >= 0 ? 'var(--green)' : 'var(--red)'
                          }}>
                            {t.pnl_inr >= 0 ? '+' : ''}₹{t.pnl_inr.toLocaleString('en-IN')}
                          </td>
                          <td>{t.rsi_entry}</td>
                          <td>{t.vol_ratio}</td>
                          <td>{t.ema_cross}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB: AI ANALYSIS */}
          {backtestSubTab === 'ai' && (
            <div>
              {!backtestAiAnalysis && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13.5 }}>
                      Watson, we have compiling data. Let me run a quantitative analysis of these signals.
                    </p>
                    <button className="btn btn-gold" onClick={fetchBacktestAi} disabled={backtestAiLoading} style={{ minWidth: 240 }}>
                      {backtestAiLoading ? '🕵️‍♂️ Analyzing Evidence...' : '🧠 Run AI Analysis'}
                    </button>
                  </div>
                </div>
              )}

              {backtestAiAnalysis && (
                <div>
                  {/* Verdict Banner */}
                  {(() => {
                    const v = backtestAiAnalysis.verdict || 'REJECT';
                    const vColor = v === 'DEPLOY' ? 'var(--green)' : v === 'PAPER_TRADE_FIRST' ? 'var(--gold)' : v === 'NEEDS_OPTIMISATION' ? 'var(--gold-bright)' : 'var(--red)';
                    const vBg = v === 'DEPLOY' ? 'rgba(0,201,167,0.12)' : v === 'PAPER_TRADE_FIRST' ? 'rgba(201,168,76,0.12)' : v === 'NEEDS_OPTIMISATION' ? 'rgba(201,168,76,0.06)' : 'rgba(255,77,77,0.1)';
                    const vBorder = v === 'DEPLOY' ? 'rgba(0,201,167,0.3)' : v === 'PAPER_TRADE_FIRST' ? 'rgba(201,168,76,0.3)' : v === 'NEEDS_OPTIMISATION' ? 'rgba(201,168,76,0.2)' : 'rgba(255,77,77,0.2)';
                    return (
                      <div style={{
                        background: vBg, border: `1px solid ${vBorder}`, borderRadius: 8, padding: '22px 26px', marginBottom: 20
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Deductive Strategy Verdict</div>
                            <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: vColor, fontSize: 22, fontWeight: 'bold' }}>
                              {v.replace(/_/g, ' ')}
                            </h2>
                          </div>
                          <div style={{
                            border: `1px solid ${vColor}`, color: vColor, borderRadius: 4, padding: '4px 12px', fontSize: 11, fontWeight: 'bold', letterSpacing: '1px'
                          }}>
                            EDGE: {backtestAiAnalysis.edge_strength || 'UNKNOWN'}
                          </div>
                        </div>
                        <p style={{ margin: '14px 0 0 0', color: 'var(--text-primary)', fontSize: 14, lineHeight: '1.6', fontWeight: 500 }}>
                          "{backtestAiAnalysis.verdict_reason}"
                        </p>
                      </div>
                    );
                  })()}

                  {/* 3 Metrics row */}
                  <div className="metric-grid w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="metric-card">
                      <div className="metric-label">Edge Strength</div>
                      <div className={`metric-value ${backtestAiAnalysis.edge_strength === 'STRONG' ? 'metric-val-green' : backtestAiAnalysis.edge_strength === 'MODERATE' ? 'metric-val-gold' : 'metric-val-red'}`}>
                        {backtestAiAnalysis.edge_strength || '—'}
                      </div>
                      <div className="metric-sub">Expected margin of safety</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Best Performing Signal</div>
                      <div className="metric-value metric-val-green" style={{ fontSize: 16 }}>
                        {backtestAiAnalysis.best_performing_signal || '—'}
                      </div>
                      <div className="metric-sub">Highest cumulative returns</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Worst Performing Signal</div>
                      <div className="metric-value metric-val-red" style={{ fontSize: 16 }}>
                        {backtestAiAnalysis.worst_performing_signal || '—'}
                      </div>
                      <div className="metric-sub">Largest drag on equity curve</div>
                    </div>
                  </div>

                  {/* Recommended Signal Filter */}
                  <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                      <div className="card-title">🔦 Recommended Signal Filter</div>
                    </div>
                    <div className="card-body">
                      <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 13, lineHeight: '1.5' }}>
                        {backtestAiAnalysis.recommended_signal_filter}
                      </p>
                    </div>
                  </div>

                  {/* Key findings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 w-full box-border">
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Finding I</div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: '1.5' }}>{backtestAiAnalysis.key_finding_1}</p>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Finding II</div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: '1.5' }}>{backtestAiAnalysis.key_finding_2}</p>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Finding III</div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: '1.5' }}>{backtestAiAnalysis.key_finding_3}</p>
                    </div>
                  </div>

                  {/* Target/SL assessments */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Stop-Loss Assessment</div>
                      </div>
                      <div className="card-body">
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {backtestAiAnalysis.stop_loss_assessment}
                        </p>
                      </div>
                    </div>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Target parameters Assessment</div>
                      </div>
                      <div className="card-body">
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {backtestAiAnalysis.target_assessment}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position sizing & market condition */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border" style={{ marginBottom: 20 }}>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">💰 Position Sizing & Capital Allocation</div>
                      </div>
                      <div className="card-body">
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {backtestAiAnalysis.suggested_position_size}
                        </p>
                      </div>
                    </div>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">⚖️ Optimal Market Environment</div>
                      </div>
                      <div className="card-body">
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                          {backtestAiAnalysis.market_condition_note}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Improvement Rule */}
                  <div style={{ background: 'rgba(255, 77, 77, 0.05)', border: '1px solid rgba(255, 77, 77, 0.2)', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ color: 'var(--red)', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>⚡ Critical Optimization Rule</div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: 14 }}>{backtestAiAnalysis.improvement_rule}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: '1.5' }}>
                      Expected Improvement: {backtestAiAnalysis.expected_improvement}
                    </p>
                  </div>

                  {/* Summary final word */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(0,201,167,0.04) 100%)',
                    border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '18px 22px'
                  }}>
                    <div style={{ color: 'var(--gold)', fontWeight: 'bold', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>🕵️‍♂️</span> Sherlock's Final Recommendation
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, lineHeight: '1.6', fontStyle: 'italic' }}>
                      "{backtestAiAnalysis.sherlock_summary}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
