/**
 * LiveChart.jsx
 * Professional live candlestick chart for Clue Board tab.
 * Canvas-based — no external chart library required.
 *
 * Architecture:
 *   LiveTickEngine      — polls Yahoo Finance, assembles live OHLCV candles
 *   CandlestickRenderer — HTML5 Canvas 60fps renderer with EMA/VWAP/Volume/Crosshair
 *   LiveChart           — React component wiring engine → renderer → Pre-Market Intel
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ── CSS injected ONCE at module level — never inside render ──────────────────
// Injecting inside JSX causes a new <style> tag every re-render → visual flicker
(function injectLiveChartStyles() {
  if (typeof document === 'undefined') return;
  const ID = 'lc-global-styles-v3';
  if (document.getElementById(ID)) return;
  const s = document.createElement('style');
  s.id = ID;
  s.textContent = `
    @keyframes lcSpin {
      to { transform: rotate(360deg); }
    }
    .live-chart-wrapper-border {
      border: 1px solid #1E2230;
      box-sizing: border-box;
    }
    /* Focus pulse — fires on click/touch, lasts exactly 1.5s, stops. */
    /* Uses only border-color + box-shadow — no transform/opacity on canvas */
    @keyframes pulse-glow-cyan {
      0%   { box-shadow: 0 0  0px 0px rgba(0,255,209,0);   border-color: #1E2230; }
      25%  { box-shadow: 0 0 16px 4px rgba(0,255,209,0.5); border-color: rgba(0,255,209,0.7); }
      60%  { box-shadow: 0 0 20px 6px rgba(0,255,209,0.35);border-color: rgba(0,255,209,0.5); }
      100% { box-shadow: 0 0  0px 0px rgba(0,255,209,0);   border-color: #1E2230; }
    }
    @keyframes pulse-glow-amber {
      0%   { box-shadow: 0 0  0px 0px rgba(255,191,0,0);   border-color: #1E2230; }
      25%  { box-shadow: 0 0 16px 4px rgba(255,191,0,0.5); border-color: rgba(255,191,0,0.7); }
      60%  { box-shadow: 0 0 20px 6px rgba(255,191,0,0.35);border-color: rgba(255,191,0,0.5); }
      100% { box-shadow: 0 0  0px 0px rgba(255,191,0,0);   border-color: #1E2230; }
    }
    .animate-pulse-glow-cyan {
      animation: pulse-glow-cyan 1.5s ease-out forwards !important;
    }
    .animate-pulse-glow-amber {
      animation: pulse-glow-amber 1.5s ease-out forwards !important;
    }
    .animate-pulse-glow {
      animation: pulse-glow-cyan 1.5s ease-out forwards !important;
    }
  `;
  document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const YF_SYMBOL_MAP = {
  'NIFTY':      '^NSEI',
  'BANKNIFTY':  '^NSEBANK',
  'FINNIFTY':   'NIFTY_FIN_SERVICE.NS',
  'SENSEX':     '^BSESN',
  'MIDCPNIFTY': '^NSEMDCP50',
  'RELIANCE':   'RELIANCE.NS',
  'HDFCBANK':   'HDFCBANK.NS',
  'ICICIBANK':  'ICICIBANK.NS',
  'INFY':       'INFY.NS',
  'TCS':        'TCS.NS',
  'WIPRO':      'WIPRO.NS',
  'SBIN':       'SBIN.NS',
  'TATAMOTORS': 'TATAMOTORS.NS',
  'BAJFINANCE': 'BAJFINANCE.NS',
  'AXISBANK':   'AXISBANK.NS',
  'KOTAKBANK':  'KOTAKBANK.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'ITC':        'ITC.NS',
  'LT':         'LT.NS',
  'MARUTI':     'MARUTI.NS',
  'HINDUNILVR': 'HINDUNILVR.NS',
};

const INTERVAL_MAP_YF = {
  '1m': '1m', '5m': '5m', '10m': '5m', '15m': '15m',
  '30m': '30m', '1h': '60m', '1d': '1d',
};

const RANGE_MAP_YF = {
  '1m': '1d', '5m': '1d', '10m': '5d', '15m': '5d',
  '30m': '5d', '1h': '1mo', '1d': '1y',
};

const POLL_MS = {
  '1m': 2000,
  '5m': 4000,
  '10m': 5000,
  '15m': 6000,
  '30m': 10000,
  '1h': 15000,
  '1d': 30000,
};

const TF_MS = {
  '1m': 60000, '5m': 300000, '10m': 600000, '15m': 900000,
  '30m': 1800000, '1h': 3600000, '1d': 86400000,
};

// ─────────────────────────────────────────────────────────────────────────────
// YAHOO FINANCE FETCH
// ─────────────────────────────────────────────────────────────────────────────

async function fetchYahooCandles(symbol, timeframe, bars = 150) {
  const yfSym = YF_SYMBOL_MAP[symbol.toUpperCase()] ?? `${symbol}.NS`;
  const interval = INTERVAL_MAP_YF[timeframe] ?? '15m';
  const range = RANGE_MAP_YF[timeframe] ?? '5d';

  // Route through our proxy to avoid CORS
  const url = `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw = json?.candles ?? [];
    if (raw.length === 0) throw new Error('Empty candles array');

    return raw
      .filter(c => c && c.open > 0 && c.close > 0 && c.high >= c.low)
      .map(c => ({
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume) || 0,
        isLive: false,
      }))
      .slice(-bars);
  } catch (proxyErr) {
    // Direct Yahoo fallback if proxy fails
    console.warn('[LiveChart] Proxy failed, trying Yahoo direct:', proxyErr.message);
    const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=${interval}&range=${range}&includePrePost=false`;
    const res = await fetch(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) throw new Error('No Yahoo data');

    const ts = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};

    let candles = ts
      .map((t, i) => ({
        time: t,
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
        isLive: false,
      }))
      .filter(c => c.open > 0 && c.close > 0 && c.high >= c.low);

    // Aggregate 5m → 10m if needed
    if (timeframe === '10m') {
      const groups = {};
      candles.forEach(c => {
        const key = Math.floor((c.time - 300) / 600) * 600 + 300;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      candles = Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b)
        .map(key => {
          const g = groups[key];
          return {
            time: key,
            open: g[0].open,
            close: g[g.length - 1].close,
            high: Math.max(...g.map(c => c.high)),
            low: Math.min(...g.map(c => c.low)),
            volume: g.reduce((s, c) => s + c.volume, 0),
            isLive: false,
          };
        });
    }

    return candles.slice(-bars);
  }
}

async function fetchLatestPrice(symbol) {
  const yfSym = YF_SYMBOL_MAP[symbol.toUpperCase()] ?? `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1m&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const q = json?.chart?.result?.[0]?.indicators?.quote?.[0];
    const closes = (q?.close ?? []).filter(c => c != null);
    return closes[closes.length - 1] ?? 0;
  } catch (e) {
    console.warn('[LiveChart] Latest price fetch failed:', e.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE TICK ENGINE
// ─────────────────────────────────────────────────────────────────────────────

class LiveTickEngine extends EventTarget {
  symbol = '';
  timeframe = '15m';
  candles = [];
  tickTimer = null;

  async init(symbol, timeframe) {
    this.symbol = symbol.toUpperCase();
    this.timeframe = timeframe;
    this.stop();

    try {
      this.candles = await fetchYahooCandles(this.symbol, this.timeframe, 150);
      if (this.candles.length > 0) {
        this.candles[this.candles.length - 1].isLive = true;
      }
      this._emit('CANDLES_LOADED', [...this.candles]);
    } catch (err) {
      console.error('[LiveTickEngine] Failed to load candles:', err);
      this._emit('ERROR', { message: err.message });
      return;
    }

    this._startTickPolling();
  }

  _startTickPolling() {
    const ms = POLL_MS[this.timeframe] ?? 30000;
    let failCount = 0;

    const poll = async () => {
      const backoffMs = Math.min(ms * Math.pow(1.5, Math.min(failCount, 4)), ms * 5);
      try {
        const latestCandles = await fetchYahooCandles(this.symbol, this.timeframe, 150);
        if (latestCandles.length > 0) {
          this.candles = latestCandles.map((c, idx) => {
            if (idx === latestCandles.length - 1) {
              return { ...c, isLive: true };
            }
            return c;
          });
          const lastCandle = this.candles[this.candles.length - 1];
          const price = lastCandle.close;

          const first = this.candles[0];
          const change = first ? price - first.close : 0;
          const changePct = first && first.close > 0 ? (change / first.close) * 100 : 0;

          this._emit('TICK', {
            candle: { ...lastCandle },
            price,
            change,
            changePct,
          });
          failCount = 0;
        }
      } catch (e) {
        failCount++;
      }

      if (this.tickTimer !== null) {
        this.tickTimer = setTimeout(poll, backoffMs);
      }
    };

    this.tickTimer = setTimeout(poll, ms);
  }

  getAllCandles() {
    return [...this.candles];
  }

  stop() {
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERER
// ─────────────────────────────────────────────────────────────────────────────

class CandlestickRenderer {
  canvas;
  ctx;
  candles = [];
  animFrame = 0;
  destroyed = false;
  resizeObserver = null;
  timeframe = '15m';

  view = { startIndex: 0, visibleCount: 80 };
  mouse = { x: 0, y: 0, down: false, downX: 0, startIndex: 0 };

  C = {
    bg:          '#0A0C10',
    grid:        '#1A1F2E',
    gridText:    '#4A5060',
    bull:        '#00FF88',
    bear:        '#FF4444',
    wick:        '#555',
    volBull:     'rgba(0,255,136,0.25)',
    volBear:     'rgba(255,68,68,0.25)',
    crosshair:   '#FFB800',
    liveGlow:    '#FFFFFF',
    vwap:        '#FFB800',
    ema9:        '#FFFFFF',
    ema21:       '#FF8800',
    ema50:       '#8888FF',
    priceTag:    '#0A0C10',
    border:      '#1E2230',
  };

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.timeframe = '15m';
    this._bindEvents();
    this._bindResize();
  }

  draw(candles, timeframe) {
    this.candles = candles;
    if (timeframe) {
      this.timeframe = timeframe;
    }
    cancelAnimationFrame(this.animFrame);
    if (!this.destroyed) {
      this.animFrame = requestAnimationFrame(() => this._render());
    }
  }

  scrollToLatest() {
    const len = this.candles.length;
    this.view.startIndex = Math.max(0, len - this.view.visibleCount);
    if (!this.destroyed) this._render();
  }

  _render() {
    if (this.destroyed) return;
    const { canvas, ctx, C } = this;
    const W = canvas.width;
    const H = canvas.height;
    if (W < 10 || H < 10) return;

    const PAD = { top: 40, right: 82, bottom: 36, left: 8 };
    const VOL_H = Math.max(40, Math.floor(H * 0.12));
    const CHART_H = H - PAD.top - PAD.bottom - VOL_H - 6;
    const VOL_TOP = H - PAD.bottom - VOL_H;

    // Clear
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Visible slice
    const si = Math.max(0, Math.min(this.view.startIndex, Math.max(0, this.candles.length - 1)));
    const ei = Math.min(si + this.view.visibleCount, this.candles.length);
    const visible = this.candles.slice(si, ei);
    if (visible.length === 0) return;

    // Price range
    const maxP = Math.max(...visible.map(c => c.high)) * 1.001;
    const minP = Math.min(...visible.map(c => c.low)) * 0.999;
    const priceRange = maxP - minP || 1;

    const pToY = p => PAD.top + (1 - (p - minP) / priceRange) * CHART_H;

    const totalW = W - PAD.left - PAD.right;
    const candleW = totalW / Math.max(visible.length, 1);
    const bodyW = Math.max(1.5, candleW * 0.65);
    const iToX = i => PAD.left + (i + 0.5) * candleW;

    // Grid
    this._drawGrid(ctx, W, H, PAD, CHART_H, minP, maxP, priceRange, pToY, visible, iToX, candleW);

    // Volume
    const maxVol = Math.max(...visible.map(c => c.volume), 1);
    visible.forEach((c, i) => {
      if (!c.volume) return;
      const x = iToX(i);
      const vh = (c.volume / maxVol) * VOL_H;
      ctx.fillStyle = c.close >= c.open ? C.volBull : C.volBear;
      ctx.fillRect(x - bodyW / 2, VOL_TOP + VOL_H - vh, bodyW, vh);
    });

    // EMA lines
    this._drawEMA(ctx, visible, 50, C.ema50, pToY, iToX);
    this._drawEMA(ctx, visible, 21, C.ema21, pToY, iToX);
    this._drawEMA(ctx, visible, 9,  C.ema9,  pToY, iToX);

    // VWAP
    this._drawVWAP(ctx, visible, pToY, iToX);

    // Candles
    visible.forEach((c, i) => {
      const x = iToX(i);
      const bull = c.close >= c.open;
      const color = bull ? C.bull : C.bear;

      const openY  = pToY(c.open);
      const closeY = pToY(c.close);
      const highY  = pToY(c.high);
      const lowY   = pToY(c.low);
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(1, Math.abs(closeY - openY));

      // Live candle glow
      if (c.isLive) {
        ctx.shadowColor = C.liveGlow;
        ctx.shadowBlur = 10;
      }

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, candleW < 4 ? 0.5 : 1);
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      if (bodyH > 2 && !bull) {
        ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
      } else if (bodyH > 2 && bull) {
        // Hollow bullish
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
      } else {
        ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, Math.max(1.5, bodyH));
      }

      ctx.shadowBlur = 0;
    });

    // Current price line
    const last = visible[visible.length - 1];
    if (last) {
      const py = pToY(last.close);
      const bull = last.close >= last.open;
      const col = bull ? C.bull : C.bear;

      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, py);
      ctx.lineTo(W - PAD.right, py);
      ctx.stroke();
      ctx.setLineDash([]);

      const label = `₹${last.close.toLocaleString('en-IN', { minimumFractionDigits: last.close < 1000 ? 2 : 0 })}`;
      ctx.font = 'bold 10px "JetBrains Mono",monospace';
      const tw = ctx.measureText(label).width;
      const boxW = tw + 10;
      const boxH = 17;
      const bx = W - PAD.right + 2;
      ctx.fillStyle = col;
      ctx.fillRect(bx, py - boxH / 2, boxW, boxH);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.fillText(label, bx + 5, py + 4);
    }

    // Crosshair
    if (this.mouse.x > PAD.left && this.mouse.x < W - PAD.right &&
        this.mouse.y > PAD.top && this.mouse.y < VOL_TOP) {
      this._drawCrosshair(ctx, W, H, PAD, CHART_H, visible, minP, priceRange, pToY, iToX, candleW, VOL_TOP);
    }
  }

  _drawGrid(ctx, W, H, PAD, CHART_H, minP, maxP, priceRange, pToY, visible, iToX, candleW) {
    const { C } = this;

    // Horizontal price lines
    const levels = 6;
    for (let i = 0; i <= levels; i++) {
      const p = minP + (priceRange * i) / levels;
      const y = pToY(p);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = C.gridText;
      ctx.font = '9px "JetBrains Mono",monospace';
      ctx.textAlign = 'right';
      const fmt = p >= 10000
        ? p.toLocaleString('en-IN', { maximumFractionDigits: 0 })
        : p.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      ctx.fillText(`₹${fmt}`, W - 2, y + 3);
    }

    // Vertical time labels
    let lastDatePrinted = null;
    const step = Math.max(1, Math.floor(visible.length / 8));
    visible.forEach((c, i) => {
      if (i % step !== 0) return;
      const x = iToX(i);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, H - PAD.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      const d = new Date(c.time * 1000);
      const ist = d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit',
      });
      const dateStr = d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric',
      });

      let label = '';
      if (this.timeframe === '1d') {
        label = dateStr;
      } else {
        if (lastDatePrinted === null || dateStr !== lastDatePrinted) {
          label = `${dateStr} ${ist}`;
          lastDatePrinted = dateStr;
        } else {
          label = ist;
        }
      }

      ctx.fillStyle = C.gridText;
      ctx.font = '8px "JetBrains Mono",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, H - PAD.bottom + 13);
    });
  }

  _drawEMA(ctx, candles, period, color, pToY, iToX) {
    if (candles.length < period) return;
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    const pts = candles.map((c, i) => {
      ema = c.close * k + ema * (1 - k);
      return { x: iToX(i), y: pToY(ema) };
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  _drawVWAP(ctx, candles, pToY, iToX) {
    let tpv = 0, vol = 0;
    ctx.strokeStyle = this.C.vwap;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    candles.forEach((c, i) => {
      const tp = (c.high + c.low + c.close) / 3;
      tpv += tp * (c.volume || 1);
      vol += c.volume || 1;
      const v = tpv / vol;
      const x = iToX(i);
      const y = pToY(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawCrosshair(ctx, W, H, PAD, CHART_H, visible, minP, priceRange, pToY, iToX, candleW, VOL_TOP) {
    const { mouse: m, C } = this;
    ctx.strokeStyle = C.crosshair;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([4, 4]);

    // Vertical
    ctx.beginPath();
    ctx.moveTo(m.x, PAD.top);
    ctx.lineTo(m.x, VOL_TOP);
    ctx.stroke();

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(PAD.left, m.y);
    ctx.lineTo(W - PAD.right, m.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    const price = minP + (1 - (m.y - PAD.top) / CHART_H) * priceRange;
    const pLabel = `₹${price.toLocaleString('en-IN', { maximumFractionDigits: price < 1000 ? 2 : 0 })}`;
    ctx.font = '9px "JetBrains Mono",monospace';
    const tw = ctx.measureText(pLabel).width;
    ctx.fillStyle = C.crosshair;
    ctx.fillRect(W - PAD.right + 2, m.y - 8, tw + 10, 16);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.fillText(pLabel, W - PAD.right + 7, m.y + 4);

    // Candle tooltip
    const rawIdx = (m.x - PAD.left) / candleW;
    const idx = Math.max(0, Math.min(Math.floor(rawIdx), visible.length - 1));
    const c = visible[idx];
    if (c) {
      const vol = c.volume >= 1000000
        ? `${(c.volume / 1000000).toFixed(1)}M`
        : c.volume >= 1000 ? `${(c.volume / 1000).toFixed(0)}K`
        : `${c.volume}`;
      const tip = `O:${c.open.toFixed(0)}  H:${c.high.toFixed(0)}  L:${c.low.toFixed(0)}  C:${c.close.toFixed(0)}  V:${vol}`;
      ctx.font = '9px "JetBrains Mono",monospace';
      const tw2 = ctx.measureText(tip).width;
      ctx.fillStyle = 'rgba(30,34,48,0.92)';
      ctx.fillRect(PAD.left, 4, tw2 + 16, 18);
      ctx.fillStyle = C.crosshair;
      ctx.fillText(tip, PAD.left + 8, 16);
    }
  }

  _bindEvents() {
    const el = this.canvas;

    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      if (this.mouse.down) {
        const cw = (el.width - 90) / Math.max(this.view.visibleCount, 1);
        const dIdx = Math.round((e.clientX - this.mouse.downX) / cw);
        const max = Math.max(0, this.candles.length - this.view.visibleCount);
        this.view.startIndex = Math.max(0, Math.min(this.mouse.startIndex - dIdx, max));
      }
      if (!this.destroyed) this._render();
    });

    el.addEventListener('mouseleave', () => {
      this.mouse.x = 0; this.mouse.y = 0;
      if (!this.destroyed) this._render();
    });

    el.addEventListener('mousedown', e => {
      this.mouse.down = true;
      this.mouse.downX = e.clientX;
      this.mouse.startIndex = this.view.startIndex;
    });

    el.addEventListener('mouseup', () => { this.mouse.down = false; });

    el.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 6 : -6;
      this.view.visibleCount = Math.max(20, Math.min(200, this.view.visibleCount + delta));
      this.view.startIndex = Math.max(0, this.candles.length - this.view.visibleCount);
      if (!this.destroyed) this._render();
    }, { passive: false });

    // Touch
    let lastTX = 0;
    el.addEventListener('touchstart', e => { lastTX = e.touches[0].clientX; });
    el.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - lastTX;
      const cw = (el.width - 90) / Math.max(this.view.visibleCount, 1);
      const dIdx = Math.round(dx / cw);
      const max = Math.max(0, this.candles.length - this.view.visibleCount);
      this.view.startIndex = Math.max(0, Math.min(this.view.startIndex - dIdx, max));
      lastTX = e.touches[0].clientX;
      if (!this.destroyed) this._render();
    });
  }

  _bindResize() {
    const resize = () => {
      const p = this.canvas.parentElement;
      if (!p || this.destroyed) return;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.floor(p.clientWidth * dpr);
      const targetH = Math.floor(p.clientHeight * dpr);
      if (this.canvas.width === targetW && this.canvas.height === targetH) {
        this._render();
        return;
      }
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.canvas.style.width = p.clientWidth + 'px';
      this.canvas.style.height = p.clientHeight + 'px';
      this.ctx.scale(dpr, dpr);
      this._render();
    };

    this.resizeObserver = new ResizeObserver(resize);
    if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
    resize();
  }

  scrollToLatest() {
    this.view.startIndex = Math.max(0, this.candles.length - this.view.visibleCount);
    if (!this.destroyed) this._render();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animFrame);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveChart({
  symbol,
  timeframe = '15m',
  height = 460,
  onCandlesUpdate,
  onTickUpdate,
}) {
  const canvasRef    = useRef(null);
  const rendererRef  = useRef(null);
  const engineRef    = useRef(null);
  const wrapperRef   = useRef(null);   // outer border div — focus pulse target
  const focusTimerRef = useRef(null);  // setTimeout handle for removing class
  const holdTimerRef  = useRef(null);  // setInterval handle for touch-hold repeat

  const [status,    setStatus]    = useState('loading'); // 'loading'|'live'|'error'
  const [ltp,       setLtp]       = useState(0);
  const [change,    setChange]    = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [lastTime,  setLastTime]  = useState('');

  // Store callbacks in refs to prevent the recreation of the `init` callback from re-triggering loading states
  const onCandlesUpdateRef = useRef(onCandlesUpdate);
  const onTickUpdateRef = useRef(onTickUpdate);

  useEffect(() => {
    onCandlesUpdateRef.current = onCandlesUpdate;
  }, [onCandlesUpdate]);

  useEffect(() => {
    onTickUpdateRef.current = onTickUpdate;
  }, [onTickUpdate]);
  const [errorMsg,  setErrorMsg]  = useState('');

  const activeSymbol = useMemo(() => {
    if (!symbol) return 'NIFTY';
    return symbol
      .toUpperCase()
      .replace('^NSEI', 'NIFTY')
      .replace('^NSEBANK', 'BANKNIFTY')
      .replace('^BSESN', 'SENSEX')
      .replace('.NS', '')
      .replace('.BO', '')
      .replace('^', '');
  }, [symbol]);

  // ── Focus pulse animation ─────────────────────────────────────────────────
  // Fires ONLY on user click/touch. Lasts exactly 1.5s. Repeats only on hold.
  const triggerFocusPulse = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const isSensex = activeSymbol === 'SENSEX';
    const activeClass = isSensex ? 'animate-pulse-glow-amber' : 'animate-pulse-glow-cyan';
    const inactiveClass = isSensex ? 'animate-pulse-glow-cyan' : 'animate-pulse-glow-amber';
    
    // Remove then re-add to restart animation from 0% (forced reflow)
    el.classList.remove(activeClass, inactiveClass, 'lc-focus-active');
    void el.offsetWidth; // reflow — forces browser to restart animation
    el.classList.add(activeClass);
    
    clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      el?.classList.remove(activeClass);
    }, 1500);
  }, [activeSymbol]);

  const onChartMouseDown = useCallback(() => {
    triggerFocusPulse(); // single 1.5s pulse on click
  }, [triggerFocusPulse]);

  const onChartTouchStart = useCallback(() => {
    triggerFocusPulse();
    clearInterval(holdTimerRef.current);
    // Repeat every 1.5s while finger is held
    holdTimerRef.current = setInterval(triggerFocusPulse, 1500);
  }, [triggerFocusPulse]);

  const onChartTouchEnd = useCallback(() => {
    clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  const init = useCallback(async () => {
    if (!canvasRef.current) return;

    setStatus('loading');
    setLtp(0);
    setChange(0);
    setChangePct(0);
    setErrorMsg('');

    // Snapshot the current renderer/engine before replacing them,
    // so any in-flight callbacks from the OLD engine can be ignored.
    const prevEngine   = engineRef.current;
    const prevRenderer = rendererRef.current;

    // Increment init generation — listeners created below capture this id.
    // Any TICK/CANDLES_LOADED from a previous generation will see a stale id
    // and bail out immediately, preventing old data from overwriting the new chart.
    if (!rendererRef.__initGen) rendererRef.__initGen = 0;
    const myGen = ++rendererRef.__initGen;
    const isStale = () => rendererRef.__initGen !== myGen;

    // Stop old instances AFTER capturing references
    if (prevRenderer) prevRenderer.destroy();
    if (prevEngine)   prevEngine.stop();

    // ── 15-second loading guard ──────────────────────────────────────────
    // If neither CANDLES_LOADED nor ERROR fires within 15s, force error state.
    // This prevents the chart from being stuck on the loading spinner forever.
    let loadGuardId = setTimeout(() => {
      if (isStale() || !canvasRef.current) return;
      setStatus('error');
      setErrorMsg('Chart data timed out. Check proxy server.');
    }, 15000);

    // New renderer — timeframe set immediately so _drawGrid uses it from first paint
    rendererRef.current = new CandlestickRenderer(canvasRef.current);
    rendererRef.current.timeframe = timeframe;

    // New engine
    const engine = new LiveTickEngine();
    engineRef.current = engine;

    engine.addEventListener('CANDLES_LOADED', e => {
      if (isStale()) return;   // ignore if a newer init() has since run
      clearTimeout(loadGuardId);
      const candles = e.detail;
      // Re-assert timeframe in case anything changed since listener was registered
      if (rendererRef.current) rendererRef.current.timeframe = timeframe;
      rendererRef.current?.draw(candles, timeframe);
      rendererRef.current?.scrollToLatest();
      onCandlesUpdateRef.current?.(candles);
      setStatus('live');
    });

    engine.addEventListener('TICK', e => {
      if (isStale()) return;   // ignore stale polls from previous engine
      const { price, change: ch, changePct: chp } = e.detail;
      const all = engine.getAllCandles();
      if (rendererRef.current) rendererRef.current.timeframe = timeframe;
      rendererRef.current?.draw(all, timeframe);
      setLtp(price);
      setChange(ch);
      setChangePct(chp);
      setLastTime(new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
      onTickUpdateRef.current?.(price, ch);
      onCandlesUpdateRef.current?.(all);
    });

    engine.addEventListener('ERROR', e => {
      if (isStale()) return;
      clearTimeout(loadGuardId);
      setStatus('error');
      setErrorMsg(e.detail?.message ?? 'Failed to load chart data');
    });

    try {
      await engine.init(activeSymbol, timeframe);
    } catch (err) {
      if (isStale()) return;
      clearTimeout(loadGuardId);
      setStatus('error');
      setErrorMsg(err.message ?? 'Failed to load chart data');
    }
  }, [symbol, timeframe, activeSymbol]);

  useEffect(() => {
    init();
    return () => {
      engineRef.current?.stop();
      rendererRef.current?.destroy();
      clearTimeout(focusTimerRef.current);
      clearInterval(holdTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  const bull = change >= 0;
  const sym  = activeSymbol;

  return (
    <div
      ref={wrapperRef}
      onMouseDown={onChartMouseDown}
      onTouchStart={onChartTouchStart}
      onTouchEnd={onChartTouchEnd}
      onTouchCancel={onChartTouchEnd}
      className="live-chart-wrapper-border"
      style={{
        width: '100%',
        height: `${height}px`,
        background: '#0A0C10',
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"JetBrains Mono", monospace',
        // NO will-change, NO transform — keeps Canvas GPU path clean
      }}
    >
      {/* ── HEADER ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        borderBottom: '1px solid #1A1F2E',
        flexShrink: 0,
        background: '#0D1017',
        minHeight: 38,
      }}>
        {/* Left: symbol + price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            color: '#FFFFFF', fontSize: 12, fontWeight: 700,
            letterSpacing: 1,
          }}>
            {sym}
          </span>
          {ltp > 0 && (
            <>
              <span style={{
                color: bull ? '#00FF88' : '#FF4444',
                fontSize: 16, fontWeight: 700,
              }}>
                ₹{ltp.toLocaleString('en-IN', {
                  minimumFractionDigits: ltp < 1000 ? 2 : 0,
                  maximumFractionDigits: ltp < 1000 ? 2 : 0,
                })}
              </span>
              <span style={{
                color: bull ? '#00FF88' : '#FF4444',
                fontSize: 11,
              }}>
                {bull ? '+' : ''}{change.toFixed(2)}
                &nbsp;({bull ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </>
          )}
        </div>

        {/* Right: status indicator + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: status === 'live' ? '#00FF88'
              : status === 'loading' ? '#FFB800' : '#FF4444',
            boxShadow: status === 'live'
              ? '0 0 6px #00FF88' : 'none',
          }} />
          <span style={{ color: '#4A5060', fontSize: 9, letterSpacing: 0.5 }}>
            {status === 'live' ? 'LIVE' : status === 'loading' ? 'LOADING' : 'OFFLINE'}
          </span>
          {lastTime && (
            <span style={{ color: '#333', fontSize: 9 }}>IST {lastTime}</span>
          )}
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            {[['EMA9', '#FFFFFF'], ['EMA21', '#FF8800'], ['EMA50', '#8888FF'], ['VWAP', '#FFB800']].map(([l, c]) => (
              <span key={l} style={{ fontSize: 8, color: c, opacity: 0.8 }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CANVAS AREA ─── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Loading overlay */}
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: '#0A0C10',
          }}>
            <div style={{
              width: 28, height: 28,
              border: '2px solid #1E2230',
              borderTop: '2px solid #FFFFFF',
              borderRadius: '50%',
              animation: 'lcSpin 0.8s linear infinite',
            }} />
            {/* NOTE: lcSpin is defined in the module-level style tag above — NOT here */}
            <span style={{ color: '#4A5060', fontSize: 11 }}>
              Loading {sym} candles…
            </span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#0A0C10',
          }}>
            <span style={{ color: '#FF4444', fontSize: 13 }}>⚠ {errorMsg || 'Chart data unavailable'}</span>
            <button
              onClick={init}
              style={{
                background: 'transparent',
                border: '1px solid #2A2F40',
                color: '#888',
                padding: '5px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: '"JetBrains Mono",monospace',
                fontSize: 11,
              }}
            >
              ↺ Retry
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            display: status === 'error' ? 'none' : 'block',
          }}
        />
      </div>
    </div>
  );
}
