import React, { useState, useEffect } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
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

export default function TradeJournal() {
  const [trades, setTrades] = usePersistedState('tradeJournal', []);
  const [metrics, setMetrics] = useState({
    total_pnl: 0,
    win_rate: 0,
    total_trades: 0,
    wins: 0,
    losses: 0,
    current_streak: '0 Wins 🧊',
    equity_curve: [],
    strategy_performance: []
  });

  const [tradeForm, setTradeForm] = useState({
    ticker: 'NIFTY',
    trade_type: 'LONG',
    setup_type: 'EMA Cross',
    quantity: '10',
    entry_price: '23664.00',
    conviction: 'Medium',
    setup_grade: 'A+'
  });

  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closeTradeForm, setCloseTradeForm] = useState({
    exitPrice: '',
    exitReason: '',
    mistake: 'None',
    maxLoss: '',
    maxProfit: '',
    followedPlan: true,
    movedSL: false,
    enteredAfterLimit: false
  });

  const fetchTrades = async () => {
    try {
      const res = await fetch(`/api/trades?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setTrades(json.trades || []);
        if (json.metrics) {
          setMetrics(json.metrics);
        }
      }
    } catch (e) {
      console.error('Error fetching trades:', e);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleAddTrade = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: tradeForm.ticker,
          trade_type: tradeForm.trade_type,
          setup_type: tradeForm.setup_type,
          quantity: parseInt(tradeForm.quantity) || 1,
          entry_price: parseFloat(tradeForm.entry_price) || 0.0,
          conviction: tradeForm.conviction,
          setup_grade: tradeForm.setup_grade
        })
      });
      if (res.ok) {
        fetchTrades();
        setTradeForm(prev => ({
          ...prev,
          setup_type: 'EMA Cross',
          quantity: '10'
        }));
      }
    } catch (e) {
      console.error('Error adding trade:', e);
    }
  };

  const handleConfirmClose = async (id) => {
    const exitPrice = parseFloat(closeTradeForm.exitPrice);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      alert("Watson, please enter a valid numeric Exit Price.");
      return;
    }
    
    const trade = trades.find(t => t.id === id);
    const hasSetupGrade = trade && trade.setup_grade && trade.setup_grade !== 'None' && trade.setup_grade !== 'UNGRADED';
    
    let adherenceScore = 0;
    if (closeTradeForm.followedPlan) adherenceScore += 40;
    if (!closeTradeForm.movedSL) adherenceScore += 30;
    if (!closeTradeForm.enteredAfterLimit) adherenceScore += 20;
    if (hasSetupGrade) adherenceScore += 10;

    try {
      const res = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          exit_price: exitPrice,
          exit_reason: closeTradeForm.exitReason || "Closed via dashboard",
          mistake: closeTradeForm.mistake || "None",
          max_loss: parseFloat(closeTradeForm.maxLoss) || 0.0,
          max_profit: parseFloat(closeTradeForm.maxProfit) || 0.0,
          adherence_score: adherenceScore,
          followed_plan: closeTradeForm.followedPlan ? 1 : 0,
          moved_sl: closeTradeForm.movedSL ? 1 : 0,
          entered_after_limit: closeTradeForm.enteredAfterLimit ? 1 : 0
        })
      });
      if (res.ok) {
        setClosingTradeId(null);
        setCloseTradeForm({
          exitPrice: '',
          exitReason: '',
          mistake: 'None',
          maxLoss: '',
          maxProfit: '',
          followedPlan: true,
          movedSL: false,
          enteredAfterLimit: false
        });
        fetchTrades();
      }
    } catch (e) {
      console.error("Error closing trade:", e);
    }
  };

  const handleStartClose = (trade) => {
    setClosingTradeId(trade.id);
    setCloseTradeForm({
      exitPrice: trade.entry_price.toString(),
      exitReason: '',
      mistake: 'None',
      maxLoss: trade.entry_price.toString(),
      maxProfit: trade.entry_price.toString(),
      followedPlan: true,
      movedSL: false,
      enteredAfterLimit: false
    });
  };

  const handleDeleteTrade = async (id) => {
    try {
      const res = await fetch(`/api/trades?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTrades();
      }
    } catch (e) {
      console.error('Error deleting trade:', e);
    }
  };

  const handleClearTrades = async () => {
    try {
      const res = await fetch('/api/trades', { method: 'DELETE' });
      if (res.ok) {
        setTrades([]);
        setMetrics({
          total_pnl: 0,
          win_rate: 0,
          total_trades: 0,
          wins: 0,
          losses: 0,
          current_streak: '0 Wins 🧊',
          equity_curve: [],
          strategy_performance: []
        });
      }
    } catch (e) {
      console.error('Error clearing trades:', e);
    }
  };

  const equityCurveData = {
    labels: metrics.equity_curve.map(pt => pt.timestamp),
    datasets: [
      {
        label: 'Cumulative P&L (INR)',
        data: metrics.equity_curve.map(pt => pt.cum_pnl),
        borderColor: '#c9a84c',
        backgroundColor: 'rgba(201, 168, 76, 0.1)',
        borderWidth: 2,
        pointRadius: metrics.equity_curve.length > 20 ? 1 : 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.15
      }
    ]
  };

  const equityCurveOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2130',
        titleColor: '#fff',
        bodyColor: '#e8dfc8',
        borderColor: '#1e2d3d',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 45, 61, 0.3)' },
        ticks: { color: '#8a9ab0', font: { size: 9, family: 'IBM Plex Mono' } }
      },
      y: {
        grid: { color: 'rgba(30, 45, 61, 0.3)' },
        ticks: { color: '#8a9ab0', font: { size: 10, family: 'IBM Plex Mono' } }
      }
    }
  };

  const strategyPerformanceData = {
    labels: metrics.strategy_performance.map(pt => pt.setup_type),
    datasets: [
      {
        label: 'Realised P&L (INR)',
        data: metrics.strategy_performance.map(pt => pt.total_pnl),
        backgroundColor: metrics.strategy_performance.map(pt => pt.total_pnl >= 0 ? 'rgba(0, 230, 118, 0.65)' : 'rgba(255, 77, 77, 0.65)'),
        borderColor: metrics.strategy_performance.map(pt => pt.total_pnl >= 0 ? '#00e676' : '#ff4d4d'),
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  const strategyPerformanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2130',
        titleColor: '#fff',
        bodyColor: '#e8dfc8',
        borderColor: '#1e2d3d',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8a9ab0', font: { size: 10, family: 'IBM Plex Mono' } }
      },
      y: {
        grid: { color: 'rgba(30, 45, 61, 0.3)' },
        ticks: { color: '#8a9ab0', font: { size: 10, family: 'IBM Plex Mono' } }
      }
    }
  };

  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const leakCount = closedTrades.filter(t => t.mistake && t.mistake !== 'None').length;
  const totalAdherence = closedTrades.reduce((acc, t) => acc + (t.adherence_score || 0), 0);
  const avgAdherence = closedTrades.length > 0 ? Math.round(totalAdherence / closedTrades.length) : 100;

  const getSlotHeatmap = () => {
    let morningPnl = 0, morningCount = 0;
    let middayPnl = 0, middayCount = 0;
    let afternoonPnl = 0, afternoonCount = 0;
    
    closedTrades.forEach(t => {
      if (!t.timestamp) return;
      const date = new Date(t.timestamp);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeNum = hours * 60 + minutes;
      
      const pnl = t.realised_pnl || 0;
      
      if (timeNum >= 9*60+15 && timeNum < 11*60+30) {
        morningPnl += pnl;
        morningCount++;
      } else if (timeNum >= 11*60+30 && timeNum < 13*60+30) {
        middayPnl += pnl;
        middayCount++;
      } else if (timeNum >= 13*60+30 && timeNum <= 15*60+30) {
        afternoonPnl += pnl;
        afternoonCount++;
      } else {
        morningPnl += pnl;
        morningCount++;
      }
    });
    
    return {
      morning: { pnl: morningPnl, count: morningCount },
      midday: { pnl: middayPnl, count: middayCount },
      afternoon: { pnl: afternoonPnl, count: afternoonCount }
    };
  };
  const heatmapSlots = getSlotHeatmap();

  return (
    <div className="w-full box-border" style={{ padding: '0 0 40px 0' }}>
      {/* Top Row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5 w-full box-border">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Cumulative P&L</div>
            <div id="metric-cumulative-pnl" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: metrics.total_pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {metrics.total_pnl >= 0 ? '+' : ''}₹{metrics.total_pnl.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Win Rate %</div>
            <div id="metric-win-rate" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
              {metrics.win_rate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Executed Trades</div>
            <div id="metric-total-trades" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
              {metrics.total_trades}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Current Streak</div>
            <div id="metric-current-streak" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: metrics.current_streak.includes('Wins') ? 'var(--green)' : 'var(--red)' }}>
              {metrics.current_streak}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full box-border" style={{ marginTop: 15 }}>
        {/* Left Column: Visualizations and Archive */}
        <div className="lg:col-span-2 flex flex-col gap-5 w-full box-border">
          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border">
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div className="card-title">Cumulative Equity Curve</div>
              </div>
              <div className="card-body" style={{ height: 260 }}>
                {metrics.equity_curve && metrics.equity_curve.length > 1 ? (
                  <Line data={equityCurveData} options={equityCurveOptions} />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No closed trades found to plot account growth.
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div className="card-title">Strategy Performance</div>
              </div>
              <div className="card-body" style={{ height: 260 }}>
                {metrics.strategy_performance && metrics.strategy_performance.length > 0 ? (
                  <Bar data={strategyPerformanceData} options={strategyPerformanceOptions} />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No strategy data to display.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Adherence & Heatmap Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full box-border">
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div className="card-title">🛡️ Adherence & Capital Leakage</div>
              </div>
              <div className="card-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Avg Plan Adherence Score:</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: avgAdherence >= 80 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                    {avgAdherence}/100
                  </span>
                </div>
                
                <div className="confidence-bar-track" style={{ height: 6 }}>
                  <div
                    className="confidence-bar-fill"
                    style={{
                      width: `${avgAdherence}%`,
                      background: avgAdherence >= 80 ? '#22c55e' : '#ef4444'
                    }}
                  />
                </div>

                {leakCount > 0 ? (
                  <div className="leakage-banner" style={{ margin: 0, padding: '8px 12px' }}>
                    <span>⚠️</span>
                    <span>Watson, {leakCount} execution leaks detected! Rule breaches compromise capital.</span>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e', padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                    ✓ Perfect execution record. No capital leakage detected.
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div className="card-title">⏰ Time-of-Day Heatmap</div>
              </div>
              <div className="card-body" style={{ padding: '8px 16px' }}>
                <table className="heatmap-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Time Window</th>
                      <th>Trades</th>
                      <th>Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={heatmapSlots.morning.pnl >= 0 ? 'heatmap-cell-good' : 'heatmap-cell-bad'}>
                      <td>Morning (09:15 - 11:30)</td>
                      <td>{heatmapSlots.morning.count}</td>
                      <td>{heatmapSlots.morning.pnl >= 0 ? '+' : ''}₹{heatmapSlots.morning.pnl.toFixed(2)}</td>
                    </tr>
                    <tr className={heatmapSlots.midday.pnl >= 0 ? 'heatmap-cell-good' : 'heatmap-cell-bad'}>
                      <td>Midday (11:30 - 13:30)</td>
                      <td>{heatmapSlots.midday.count}</td>
                      <td>{heatmapSlots.midday.pnl >= 0 ? '+' : ''}₹{heatmapSlots.midday.pnl.toFixed(2)}</td>
                    </tr>
                    <tr className={heatmapSlots.afternoon.pnl >= 0 ? 'heatmap-cell-good' : 'heatmap-cell-bad'}>
                      <td>Afternoon (13:30 - 15:30)</td>
                      <td>{heatmapSlots.afternoon.count}</td>
                      <td>{heatmapSlots.afternoon.pnl >= 0 ? '+' : ''}₹{heatmapSlots.afternoon.pnl.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Closed Cases Archive */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Closed Trade Journal Case Files</div>
              <button className="btn btn-secondary btn-sm" onClick={handleClearTrades}>
                Clear Trades Journal
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Ticker</th>
                      <th>Type</th>
                      <th>Setup Grade</th>
                      <th>Qty</th>
                      <th>Entry (₹)</th>
                      <th>Exit (₹)</th>
                      <th>Realised PnL</th>
                      <th>Adherence</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.filter(t => t.status === 'CLOSED').map((trade) => (
                      <tr key={trade.id}>
                        <td>{new Date(trade.timestamp).toLocaleString()}</td>
                        <td className="highlight">{trade.ticker}</td>
                        <td>
                          <span className={`badge ${trade.trade_type === 'LONG' ? 'badge-buy' : 'badge-sell'}`}>
                            {trade.trade_type}
                          </span>
                        </td>
                        <td><span className="badge badge-strong" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>{trade.setup_grade || 'A+'}</span></td>
                        <td>{trade.quantity}</td>
                        <td>{parseFloat(trade.entry_price).toFixed(2)}</td>
                        <td>{parseFloat(trade.exit_price).toFixed(2)}</td>
                        <td className={trade.realised_pnl >= 0 ? 'up' : 'down'} style={{ fontWeight: 600 }}>
                          {trade.realised_pnl >= 0 ? '+' : ''}₹{parseFloat(trade.realised_pnl).toFixed(2)}
                        </td>
                        <td style={{ color: trade.adherence_score >= 80 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>{trade.adherence_score}/100</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteTrade(trade.id)} style={{ padding: '2px 6px' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {trades.filter(t => t.status === 'CLOSED').length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                          No closed trade history found. Watson, log and close some trades!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Logger and Active Open Trades */}
        <div className="lg:col-span-1 flex flex-col gap-5 w-full box-border">
          {/* Form */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">File New Trade Case</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddTrade}>
                <div className="form-group">
                  <label className="form-label">Ticker Symbol</label>
                  <input
                    type="text"
                    id="tradeFormTicker"
                    className="form-control"
                    value={tradeForm.ticker}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full box-border">
                  <div className="form-group">
                    <label className="form-label">Trade Type</label>
                    <select
                      id="tradeFormType"
                      value={tradeForm.trade_type}
                      onChange={(e) => setTradeForm(prev => ({ ...prev, trade_type: e.target.value }))}
                    >
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conviction</label>
                    <select
                      id="tradeFormConviction"
                      value={tradeForm.conviction}
                      onChange={(e) => setTradeForm(prev => ({ ...prev, conviction: e.target.value }))}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Setup Grade</label>
                    <select
                      id="tradeFormSetupGrade"
                      value={tradeForm.setup_grade || 'A+'}
                      onChange={(e) => setTradeForm(prev => ({ ...prev, setup_grade: e.target.value }))}
                    >
                      <option value="A+">A+</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Setup Pattern / Strategy</label>
                  <input
                    type="text"
                    id="tradeFormSetup"
                    className="form-control"
                    value={tradeForm.setup_type}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, setup_type: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full box-border">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      id="tradeFormQty"
                      className="form-control"
                      value={tradeForm.quantity}
                      onChange={(e) => setTradeForm(prev => ({ ...prev, quantity: e.target.value }))}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Entry Price (₹)</label>
                    <input
                      type="number"
                      id="tradeFormEntry"
                      className="form-control"
                      value={tradeForm.entry_price}
                      onChange={(e) => setTradeForm(prev => ({ ...prev, entry_price: e.target.value }))}
                      step="any"
                      required
                    />
                  </div>
                </div>

                <button id="btn-save-open-trade" className="btn btn-gold" type="submit" style={{ width: '100%' }}>
                  Save Open Trade
                </button>
              </form>
            </div>
          </div>

          {/* Open Active trades */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Active Open Trades</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Entry (₹)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.filter(t => t.status === 'OPEN').map((trade) => (
                      <tr key={trade.id}>
                        <td className="highlight">{trade.ticker}</td>
                        <td>
                          <span className={`badge ${trade.trade_type === 'LONG' ? 'badge-buy' : 'badge-sell'}`}>
                            {trade.trade_type}
                          </span>
                        </td>
                        <td>{trade.quantity}</td>
                        <td>{parseFloat(trade.entry_price).toFixed(2)}</td>
                        <td>
                          <button
                            className="btn btn-gold btn-sm btn-close-trade"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => handleStartClose(trade)}
                            disabled={closingTradeId === trade.id}
                          >
                            {closingTradeId === trade.id ? 'Closing...' : 'Close Trade'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {trades.filter(t => t.status === 'OPEN').length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                          No active open trades.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Close active trade case form */}
              {closingTradeId && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 12 }}>
                    🔒 Close Active Trade Case (ID: {closingTradeId})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5 w-full box-border">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10 }}>Exit Price (₹)</label>
                      <input
                        type="number"
                        className="form-control exit-price-input"
                        value={closeTradeForm.exitPrice}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, exitPrice: e.target.value }))}
                        step="any"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Max Loss (MAE - ₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={closeTradeForm.maxLoss}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, maxLoss: e.target.value }))}
                        step="any"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Max Profit (MFE - ₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={closeTradeForm.maxProfit}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, maxProfit: e.target.value }))}
                        step="any"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5 w-full box-border">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10 }}>Exit Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        value={closeTradeForm.exitReason}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, exitReason: e.target.value }))}
                        placeholder="e.g. Target reached / Trailing SL"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10 }}>Mistake Category</label>
                      <select
                        value={closeTradeForm.mistake}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, mistake: e.target.value }))}
                      >
                        <option value="None">None (Perfect Execution)</option>
                        <option value="FOMO">FOMO Entry</option>
                        <option value="Overtrading">Overtrading</option>
                        <option value="Moved SL">Moved SL (Rule Breach)</option>
                        <option value="Hasty Exit">Hasty Exit</option>
                        <option value="Late Entry">Late Entry</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={closeTradeForm.followedPlan}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, followedPlan: e.target.checked }))}
                      />
                      Followed Plan (+40)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={closeTradeForm.movedSL}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, movedSL: e.target.checked }))}
                      />
                      Moved SL (Breach -30)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={closeTradeForm.enteredAfterLimit}
                        onChange={(e) => setCloseTradeForm(prev => ({ ...prev, enteredAfterLimit: e.target.checked }))}
                      />
                      Entered Late (Breach -20)
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-gold btn-sm btn-confirm-close-trade"
                      style={{ flex: 1 }}
                      onClick={() => handleConfirmClose(closingTradeId)}
                    >
                      Confirm Case Close
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setClosingTradeId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
