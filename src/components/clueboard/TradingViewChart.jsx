// TradingViewChart.jsx
// Professional trading chart using TradingView lightweight-charts (MIT)
// Connected to local UDF backend via custom datafeed object.
//
// DATAFEED PIPELINE:
//   User selects symbol/resolution
//   → Datafeed.getBars() called
//   → GET /udf/history?symbol=NIFTY&resolution=5&from=xxx&to=xxx
//   → Server fetches Yahoo Finance (or live broker API) → returns UDF table
//   → getBars callback passes bars into lightweight-charts engine
//   → Canvas renders candlestick chart in real-time
//
// To wire a live broker (e.g. Zerodha), only the SERVER-SIDE /udf/history
// endpoint needs updating — no changes required here on the frontend.

import {
  useEffect, useRef, useState, useCallback, useMemo
} from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
} from 'lightweight-charts';
import './TradingViewChart.css';

// ── Timeframe config ────────────────────────────────────────────────────────
// Maps UI button label → UDF resolution param → display name
const TIMEFRAMES = [
  { label: '1m',   resolution: '1',  display: '1 Min'   },
  { label: '5m',   resolution: '5',  display: '5 Min'   },
  { label: '10m',  resolution: '10', display: '10 Min'  },
  { label: '15m',  resolution: '15', display: '15 Min'  },
  { label: '30m',  resolution: '30', display: '30 Min'  },
  { label: '1hr',  resolution: '60', display: '1 Hour'  },
  { label: '1day', resolution: 'D',  display: 'Daily'   },
];

// ── EMA helper ──────────────────────────────────────────────────────────────
function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = null;
  for (const bar of data) {
    if (ema === null) {
      ema = bar.close;
    } else {
      ema = bar.close * k + ema * (1 - k);
    }
    result.push({ time: bar.time, value: parseFloat(ema.toFixed(2)) });
  }
  return result;
}

// ── Candle time helper ──────────────────────────────────────────────────────
function getCandleTime(timestampSeconds, resolution) {
  if (resolution === 'D') {
    const d = new Date(timestampSeconds * 1000);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  const resMin = parseInt(resolution, 10);
  if (isNaN(resMin)) return timestampSeconds;
  const resSec = resMin * 60;
  return Math.floor(timestampSeconds / resSec) * resSec;
}

// ── Format bar time for lightweight-charts ──────────────────────────────────
function formatBarTime(timestampSeconds, resolution) {
  if (resolution === 'D') {
    const d = new Date(timestampSeconds * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return timestampSeconds;
}

// ── Symbol → NSE display name ────────────────────────────────────────────────
const SYMBOL_DISPLAY = {
  NIFTY:      'NIFTY 50',
  BANKNIFTY:  'BANK NIFTY',
  FINNIFTY:   'FIN NIFTY',
  SENSEX:     'SENSEX',
  MIDCPNIFTY: 'MIDCP NIFTY',
};

// ── Left-toolbar icons (SVG paths) ─────────────────────────────────────────
const TOOLBAR_TOOLS = [
  { title: 'Crosshair',      icon: '⊕' },
  { title: 'Trend Line',     icon: '╱' },
  { title: 'Horizontal',     icon: '─' },
  { title: 'Rectangle',      icon: '▭' },
  { title: 'Fibonacci',      icon: 'ᶠ' },
  { title: 'Text',           icon: 'T' },
  { title: 'Measure',        icon: '↔' },
  { title: 'Zoom',           icon: '⌕' },
];

// ════════════════════════════════════════════════════════════════════════════
// TradingViewChart — Main Component
// ════════════════════════════════════════════════════════════════════════════
export default function TradingViewChart({
  selectedAsset = 'NIFTY',
  timeframe     = '15m',
  onIntervalChange,
  spotPrice     = null,
  onCandlesUpdate = null,
  onTickUpdate    = null,
}) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef = useRef(null);  // DOM container for the chart
  const chartRef     = useRef(null);  // lightweight-charts IChartApi instance
  const candleRef    = useRef(null);  // ISeriesApi<'Candlestick'>
  const volumeRef    = useRef(null);  // ISeriesApi<'Histogram'>
  const ema9Ref      = useRef(null);
  const ema21Ref     = useRef(null);
  const ema50Ref     = useRef(null);
  const resizeObRef  = useRef(null);
  const tickTimerRef = useRef(null);
  const barsDataRef  = useRef([]);    // cached bars for EMA recalculation
  const lastSeriesTimeRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeResolution, setActiveResolution] = useState(() => {
    // Map incoming timeframe label → resolution string
    const tf = TIMEFRAMES.find(t => t.label === timeframe);
    return tf?.resolution ?? '15';
  });
  const [ohlc,    setOhlc]    = useState(null);   // { o, h, l, c, v }
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [symInfo, setSymInfo] = useState(null);

  // Keep symbol string: strip UI labels to server key
  const symbol = useMemo(() => {
    return selectedAsset?.toUpperCase()
      .replace('NSE:', '').replace('BSE:', '')
      .trim();
  }, [selectedAsset]);

  // ── Chart theme ──────────────────────────────────────────────────────────
  const CHART_THEME = {
    background:    '#0B0E17',
    textColor:     '#9BA3B2',
    gridColor:     '#1A1F2E',
    borderColor:   '#1E2336',
    bull:          '#26A69A',   // teal green  (TradingView default)
    bear:          '#EF5350',   // vivid red
    bullWick:      '#26A69A',
    bearWick:      '#EF5350',
    ema9:          '#F7B731',   // golden
    ema21:         '#00D2FF',   // cyan
    ema50:         '#9B59B6',   // purple
    volume:        '#1E2D3D',
    crosshair:     '#444C5C',
    priceLabel:    '#F0B429',
  };

  // ════════════════════════════════════════════════════════════════════════
  // DATAFEED OBJECT — implements the UDF protocol on the client side.
  // getBars() is the critical bridge: it fetches from /udf/history and
  // delivers parsed bars to the lightweight-charts engine.
  // ════════════════════════════════════════════════════════════════════════
  const buildDatafeed = useCallback((sym, resolution) => {
    return {
      // ── onReady ─────────────────────────────────────────────────────────
      // Called once when the datafeed is first attached.
      // Fetch /udf/config and pass supported resolutions to callback.
      onReady(callback) {
        fetch('/udf/config')
          .then(r => r.json())
          .then(cfg => {
            setTimeout(() => callback({
              supported_resolutions: cfg.supported_resolutions,
              supports_search:       cfg.supports_search,
              supports_marks:        cfg.supports_marks,
            }), 0);
          })
          .catch(() => {
            setTimeout(() => callback({
              supported_resolutions: ['1','5','10','15','30','60','D'],
            }), 0);
          });
      },

      // ── resolveSymbol ────────────────────────────────────────────────────
      // Called when the user sets a new symbol (or on initial load).
      // Fetch /udf/symbols?symbol=XXX and return the full symbol info object.
      resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        fetch(`/udf/symbols?symbol=${encodeURIComponent(sym)}`)
          .then(r => r.json())
          .then(info => {
            setSymInfo(info);
            setTimeout(() => onSymbolResolvedCallback({
              name:           info.name,
              ticker:         info.ticker,
              description:    info.description,
              type:           info.type,
              session:        info.session,
              timezone:       info.timezone,
              exchange:       info.exchange,
              has_intraday:   true,
              supported_resolutions: info.supported_resolutions,
              pricescale:     info.pricescale,
              minmov:         info.minmov ?? 1,
              volume_precision: 0,
              data_status:    'streaming',
            }), 0);
          })
          .catch(err => onResolveErrorCallback(`Symbol resolve error: ${err.message}`));
      },

      // ── getBars ──────────────────────────────────────────────────────────
      // THE CORE METHOD — called by the chart engine when it needs historical data.
      //
      // Pipeline:
      //   1. Build the UDF URL with from/to UNIX timestamps
      //   2. GET /udf/history → { s:'ok', t:[], o:[], h:[], l:[], c:[], v:[] }
      //   3. Zip the arrays into bar objects: { time, open, high, low, close }
      //   4. Pass bars[] to onHistoryCallback
      //
      // ── To integrate a live broker API: ──────────────────────────────────
      //   Only the SERVER endpoint /udf/history needs changing.
      //   The frontend getBars() method stays identical — it just consumes UDF.
      getBars(symbolInfo, resolutionParam, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to, firstDataRequest } = periodParams;
        const url = `/udf/history?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}`;

        setLoading(true);
        fetch(url)
          .then(r => r.json())
          .then(data => {
            setLoading(false);
            if (data.s === 'no_data' || !data.t?.length) {
              onHistoryCallback([], { noData: true });
              return;
            }
            if (data.s !== 'ok') {
              onErrorCallback(`UDF error: ${data.s}`);
              return;
            }

            // ── Zip UDF arrays → bar objects ──────────────────────────────
            // data.t[i], data.o[i], data.h[i], data.l[i], data.c[i], data.v[i]
            // are parallel arrays. lightweight-charts needs { time, open, high, low, close }
            const offset = resolution === 'D' ? 0 : 19800;
            const bars = data.t.map((ts, i) => ({
              time:   ts + offset,       // UNIX seconds
              open:   data.o[i],
              high:   data.h[i],
              low:    data.l[i],
              close:  data.c[i],
              volume: data.v[i],
            }));

            // Cache the bars so EMA lines can be recalculated
            barsDataRef.current = bars;

            // Update OHLC display with the latest bar
            const last = bars[bars.length - 1];
            if (last) setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });

            onHistoryCallback(bars, { noData: false });
          })
          .catch(err => {
            setLoading(false);
            setError(err.message);
            onErrorCallback(err.message);
          });
      },

      // ── subscribeBars ────────────────────────────────────────────────────
      // Called when the chart wants live updates. In a real broker integration,
      // set up a WebSocket here and call onRealtimeCallback on each tick.
      // For now we poll the UDF endpoint every 15 seconds.
      subscribeBars(symbolInfo, resolutionParam, onRealtimeCallback, subscriberUID) {
        // Polling fallback — replace with WebSocket for production
      },

      // ── unsubscribeBars ──────────────────────────────────────────────────
      unsubscribeBars(subscriberUID) {
        // Clean up WebSocket subscription here
      },

      // ── searchSymbols ────────────────────────────────────────────────────
      searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        fetch(`/udf/search?query=${encodeURIComponent(userInput)}&type=${symbolType}&limit=10`)
          .then(r => r.json())
          .then(results => onResultReadyCallback(results))
          .catch(() => onResultReadyCallback([]));
      },
    };
  }, [symbol, activeResolution]);

  // ════════════════════════════════════════════════════════════════════════
  // CHART INITIALIZATION
  // Creates the lightweight-charts instance, attaches all series, and
  // loads initial data via the datafeed object.
  // ════════════════════════════════════════════════════════════════════════
  const initChart = useCallback(async () => {
    if (!containerRef.current) return;

    // ── Destroy any existing chart instance (prevent memory leaks) ────────
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    setLoading(true);
    setError('');

    const W = containerRef.current.clientWidth  || 800;
    const H = containerRef.current.clientHeight || 420;

    // ── Create chart ──────────────────────────────────────────────────────
    const chart = createChart(containerRef.current, {
      width:  W,
      height: H,
      layout: {
        background:     { color: CHART_THEME.background },
        textColor:      CHART_THEME.textColor,
        fontFamily:     '"JetBrains Mono", "Roboto Mono", monospace',
        fontSize:       11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: CHART_THEME.gridColor, style: LineStyle.Dotted },
        horzLines: { color: CHART_THEME.gridColor, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color:         CHART_THEME.crosshair,
          width:         1,
          style:         LineStyle.Dashed,
          labelBackgroundColor: '#2A3042',
        },
        horzLine: {
          color:         CHART_THEME.crosshair,
          width:         1,
          style:         LineStyle.Dashed,
          labelBackgroundColor: '#2A3042',
        },
      },
      rightPriceScale: {
        borderColor:   CHART_THEME.borderColor,
        scaleMargins:  { top: 0.05, bottom: 0.25 },  // leave room for volume
        mode:          PriceScaleMode.Normal,
        textColor:     CHART_THEME.textColor,
      },
      timeScale: {
        borderColor:     CHART_THEME.borderColor,
        timeVisible:     activeResolution !== 'D',
        secondsVisible:  activeResolution === '1',
        rightOffset:     5,
        fixLeftEdge:     false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll:   true,
      handleScale:    true,
    });
    chartRef.current = chart;

    // ── Candlestick series ────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:          CHART_THEME.bull,
      downColor:        CHART_THEME.bear,
      borderUpColor:    CHART_THEME.bull,
      borderDownColor:  CHART_THEME.bear,
      wickUpColor:      CHART_THEME.bullWick,
      wickDownColor:    CHART_THEME.bearWick,
      priceLineVisible: true,
      priceLineColor:   CHART_THEME.priceLabel,
      priceLineWidth:   1,
      priceLineStyle:   LineStyle.Dashed,
      lastValueVisible: true,
    });
    candleRef.current = candleSeries;

    // ── Volume series (overlaid at bottom, separate price scale) ─────────
    const volSeries = chart.addSeries(HistogramSeries, {
      color:     CHART_THEME.volume,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeRef.current = volSeries;

    // ── EMA lines ─────────────────────────────────────────────────────────
    ema9Ref.current = chart.addSeries(LineSeries, {
      color:            CHART_THEME.ema9,
      lineWidth:        1,
      title:            'EMA9',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema21Ref.current = chart.addSeries(LineSeries, {
      color:            CHART_THEME.ema21,
      lineWidth:        1,
      title:            'EMA21',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color:            CHART_THEME.ema50,
      lineWidth:        1,
      title:            'EMA50',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Crosshair move → update OHLC readout ─────────────────────────────
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData) return;
      const bar = param.seriesData.get(candleSeries);
      if (bar) {
        setOhlc({
          o: bar.open,
          h: bar.high,
          l: bar.low,
          c: bar.close,
          v: param.seriesData.get(volSeries)?.value ?? 0,
        });
      }
    });

    // ── Load data via datafeed ────────────────────────────────────────────
    await loadBars(candleSeries, volSeries);

    // ── Resize observer — keep chart sized to parent ───────────────────────
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);
    resizeObRef.current = ro;

  }, [symbol, activeResolution]);

  // ── Load bars from UDF endpoint ─────────────────────────────────────────
  const loadBars = useCallback(async (candleSeries, volSeries) => {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - 365 * 24 * 3600;  // request up to 1 year back
    const url  = `/udf/history?symbol=${encodeURIComponent(symbol)}&resolution=${activeResolution}&from=${from}&to=${now}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();

      if (data.s === 'no_data' || !data.t?.length) {
        setLoading(false);
        setError('No data available for this symbol/resolution.');
        return;
      }

      // ── Build bar objects from UDF parallel arrays ──────────────────────
      const offset = activeResolution === 'D' ? 0 : 19800;
      const bars = data.t.map((ts, i) => ({
        time:   ts + offset,
        open:   data.o[i],
        high:   data.h[i],
        low:    data.l[i],
        close:  data.c[i],
        volume: data.v[i] ?? 0,
      })).filter(b => b.open > 0);

      if (bars.length === 0) {
        setLoading(false);
        setError('Empty data returned from server.');
        return;
      }

      // ── Push data into chart series ───────────────────────────────────
      const candleBars = bars.map(b => ({
        time:  formatBarTime(b.time, activeResolution),
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      }));

      const volBars = bars.map(b => ({
        time:  formatBarTime(b.time, activeResolution),
        value: b.volume,
        color: b.close >= b.open ? CHART_THEME.bull + '55' : CHART_THEME.bear + '55',
      }));

      // lightweight-charts v5: use .setData()
      if (!chartRef.current) return;
      if (candleSeries) candleSeries.setData(candleBars);
      if (volSeries)    volSeries.setData(volBars);

      // ── Calculate and push EMAs ─────────────────────────────────────────
      barsDataRef.current = bars;
      const lastBar = bars[bars.length - 1];
      if (lastBar) {
        lastSeriesTimeRef.current = lastBar.time;
      }
      if (onCandlesUpdate) onCandlesUpdate(bars);
      const ema9Data  = calcEMA(bars, 9);
      const ema21Data = calcEMA(bars, 21);
      const ema50Data = calcEMA(bars, 50);
      if (!chartRef.current) return;
      if (ema9Ref.current)  ema9Ref.current.setData(ema9Data);
      if (ema21Ref.current) ema21Ref.current.setData(ema21Data);
      if (ema50Ref.current) ema50Ref.current.setData(ema50Data);

      // ── Scroll chart to show latest bars ─────────────────────────────
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToPosition(0, false);
        chartRef.current.timeScale().fitContent();
      }

      // ── Update OHLC readout with latest bar ──────────────────────────
      const last = bars[bars.length - 1];
      if (last) {
        setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });
      }

      setLoading(false);
      setError('');

      // ── Start live tick polling ────────────────────────────────────────
      startTickPoll();

    } catch (err) {
      setLoading(false);
      setError(`Failed to load chart data: ${err.message}`);
    }
  }, [symbol, activeResolution]);

  // ── Live tick polling (15-second interval) ───────────────────────────────
  // In production, replace this with a WebSocket connection to your broker.
  const startTickPoll = useCallback(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    const pollMs = activeResolution === '1' ? 5000 : activeResolution === '5' ? 10000 : 15000;

    tickTimerRef.current = setInterval(async () => {
      try {
        const now  = Math.floor(Date.now() / 1000);
        const from = now - 3600; // fetch last hour only for live updates
        const url  = `/udf/history?symbol=${encodeURIComponent(symbol)}&resolution=${activeResolution}&from=${from}&to=${now}`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.s !== 'ok' || !data.t?.length) return;

        const offset = activeResolution === 'D' ? 0 : 19800;
        const bars = data.t.map((ts, i) => ({
          time:   ts + offset,
          open:   data.o[i],
          high:   data.h[i],
          low:    data.l[i],
          close:  data.c[i],
          volume: data.v[i] ?? 0,
        }));

        const last = bars[bars.length - 1];
        if (!last || !candleRef.current) return;

        if (lastSeriesTimeRef.current && last.time < lastSeriesTimeRef.current) {
          return;
        }

        if (!chartRef.current) return;

        // Update last bar (or add if new timestamp)
        candleRef.current.update({
          time: formatBarTime(last.time, activeResolution), open: last.open,
          high: last.high, low: last.low, close: last.close,
        });
        if (volumeRef.current) {
          volumeRef.current.update({
            time:  formatBarTime(last.time, activeResolution),
            value: last.volume,
            color: last.close >= last.open ? CHART_THEME.bull + '55' : CHART_THEME.bear + '55',
          });
        }
        setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });
        if (onCandlesUpdate) onCandlesUpdate(bars);
        if (onTickUpdate) {
          const prevClose = bars[bars.length - 2]?.close || last.open;
          onTickUpdate(last.close, last.close - prevClose);
        }
        lastSeriesTimeRef.current = Math.max(lastSeriesTimeRef.current || 0, last.time);
      } catch (_) {}
    }, pollMs);
  }, [symbol, activeResolution]);

  // ── Handle timeframe button click ─────────────────────────────────────────
  const handleTimeframeClick = useCallback((tf) => {
    setActiveResolution(tf.resolution);
    if (onIntervalChange) onIntervalChange(tf.label);
  }, [onIntervalChange]);

  // ── Effect: init/reinit chart when symbol or resolution changes ───────────
  useEffect(() => {
    barsDataRef.current = [];
    lastSeriesTimeRef.current = null;
    initChart();
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (resizeObRef.current)  resizeObRef.current.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, activeResolution]);

  // ── Sync external timeframe prop ──────────────────────────────────────────
  useEffect(() => {
    const tf = TIMEFRAMES.find(t => t.label === timeframe);
    if (tf && tf.resolution !== activeResolution) {
      setActiveResolution(tf.resolution);
    }
  }, [timeframe]);

  // ── Sync live tick (spotPrice) from WebSocket stream to chart series ─────────
  useEffect(() => {
    if (spotPrice == null || !candleRef.current || barsDataRef.current.length === 0) return;

    const price = parseFloat(spotPrice);
    if (isNaN(price) || price <= 0) return;

    const offset = activeResolution === 'D' ? 0 : 19800;
    const nowSec = Math.floor(Date.now() / 1000) + offset;
    const bars = barsDataRef.current;
    const lastBar = bars[bars.length - 1];

    if (!lastBar) return;

    const lastBarTimeRounded = getCandleTime(lastBar.time, activeResolution);
    const currentTimeRounded = getCandleTime(nowSec, activeResolution);

    let updatedBar;

    if (currentTimeRounded === lastBarTimeRounded) {
      // Update the existing last bar
      lastBar.high = Math.max(lastBar.high, price);
      lastBar.low = Math.min(lastBar.low, price);
      lastBar.close = price;
      updatedBar = lastBar;
    } else if (currentTimeRounded > lastBarTimeRounded) {
      // It's a new candle interval!
      const newBar = {
        time: currentTimeRounded,
        open: lastBar.close,
        high: Math.max(lastBar.close, price),
        low: Math.min(lastBar.close, price),
        close: price,
        volume: 0,
      };
      bars.push(newBar);
      updatedBar = newBar;
    }

    if (updatedBar) {
      if (lastSeriesTimeRef.current && updatedBar.time < lastSeriesTimeRef.current) {
        return;
      }

      candleRef.current.update({
        time: formatBarTime(updatedBar.time, activeResolution),
        open: updatedBar.open,
        high: updatedBar.high,
        low: updatedBar.low,
        close: updatedBar.close,
      });

      if (volumeRef.current) {
        volumeRef.current.update({
          time: formatBarTime(updatedBar.time, activeResolution),
          value: updatedBar.volume || 0,
          color: updatedBar.close >= updatedBar.open ? CHART_THEME.bull + '55' : CHART_THEME.bear + '55',
        });
      }

      setOhlc({
        o: updatedBar.open,
        h: updatedBar.high,
        l: updatedBar.low,
        c: updatedBar.close,
        v: updatedBar.volume,
      });

      if (onCandlesUpdate) {
        onCandlesUpdate([...bars]);
      }
      if (onTickUpdate) {
        const prevClose = lastBar?.close || updatedBar.open;
        onTickUpdate(updatedBar.close, updatedBar.close - prevClose);
      }
      lastSeriesTimeRef.current = Math.max(lastSeriesTimeRef.current || 0, updatedBar.time);
    }
  }, [spotPrice, activeResolution]);

  // ── Format helpers ────────────────────────────────────────────────────────
  const fmt = (v) => {
    if (v == null || isNaN(v)) return '—';
    return v >= 10000
      ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      : v.toFixed(2);
  };
  const fmtVol = (v) => {
    if (!v || v === 0) return '—';
    if (v >= 1e7) return (v / 1e7).toFixed(2) + 'Cr';
    if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
    return v.toLocaleString('en-IN');
  };

  const change = ohlc && ohlc.c && ohlc.o
    ? (ohlc.c - ohlc.o)
    : (spotPrice && ohlc?.c ? spotPrice - ohlc.c : 0);
  const changePct = ohlc?.o && ohlc.o > 0 ? (change / ohlc.o) * 100 : 0;
  const isBull    = change >= 0;
  const displayName = SYMBOL_DISPLAY[symbol] || symbol;

  // ── Resolve active timeframe label ────────────────────────────────────────
  const activeTF = TIMEFRAMES.find(t => t.resolution === activeResolution);

  return (
    <div className="tv-chart-wrapper">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="tv-header">
        {/* Symbol & resolution info */}
        <div className="tv-symbol-info">
          <span className="tv-exchange">NSE:</span>
          <span className="tv-symbol">{displayName}</span>
          <span className="tv-res">· {activeTF?.display ?? activeResolution}</span>
          <span className="tv-type">· INDEX</span>
        </div>

        {/* OHLCV readout */}
        <div className="tv-ohlc">
          {ohlc ? (
            <>
              <span className="tv-ohlc-label">O:</span>
              <span className="tv-ohlc-val">{fmt(ohlc.o)}</span>
              <span className="tv-ohlc-label">H:</span>
              <span className="tv-ohlc-val tv-bull">{fmt(ohlc.h)}</span>
              <span className="tv-ohlc-label">L:</span>
              <span className="tv-ohlc-val tv-bear">{fmt(ohlc.l)}</span>
              <span className="tv-ohlc-label">C:</span>
              <span className={`tv-ohlc-val ${isBull ? 'tv-bull' : 'tv-bear'}`}>{fmt(ohlc.c)}</span>
              <span className={`tv-ohlc-change ${isBull ? 'tv-bull' : 'tv-bear'}`}>
                {isBull ? '+' : ''}{fmt(change)} ({isBull ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </>
          ) : (
            <span className="tv-ohlc-placeholder">Loading…</span>
          )}
        </div>

        {/* Indicator legend */}
        <div className="tv-indicators">
          <span className="tv-ind" style={{ color: CHART_THEME.ema9  }}>EMA9</span>
          <span className="tv-ind" style={{ color: CHART_THEME.ema21 }}>EMA21</span>
          <span className="tv-ind" style={{ color: CHART_THEME.ema50 }}>EMA50</span>
          <span className="tv-ind" style={{ color: '#888' }}>Vol</span>
        </div>
      </div>

      {/* ── Toolbar row (timeframe buttons) ─────────────────────────────── */}
      <div className="tv-toolbar">
        <div className="tv-tf-buttons">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.resolution}
              className={`tv-tf-btn ${activeResolution === tf.resolution ? 'active' : ''}`}
              onClick={() => handleTimeframeClick(tf)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="tv-toolbar-right">
          <span className="tv-chart-type">Candlesticks</span>
          {loading && <span className="tv-loading-dot" />}
        </div>
      </div>

      {/* ── Body: left tools + chart canvas ─────────────────────────────── */}
      <div className="tv-body">
        {/* Left sidebar tools */}
        <div className="tv-left-toolbar">
          {TOOLBAR_TOOLS.map(t => (
            <button key={t.title} className="tv-tool-btn" title={t.title}>
              {t.icon}
            </button>
          ))}
        </div>

        {/* Chart canvas container */}
        <div className="tv-chart-area">
          <div className="tv-canvas-container" ref={containerRef} />

          {/* Loading overlay */}
          {loading && (
            <div className="tv-overlay">
              <div className="tv-spinner" />
              <span className="tv-overlay-text">Fetching {displayName} data…</span>
            </div>
          )}

          {/* Error overlay */}
          {!loading && error && (
            <div className="tv-overlay">
              <span className="tv-error-icon">⚠</span>
              <span className="tv-overlay-text">{error}</span>
              <button className="tv-retry-btn" onClick={initChart}>Retry</button>
            </div>
          )}

          {/* Watermark */}
          <div className="tv-watermark">
            <span className="tv-wm-text">NIFTY TRADING TERMINAL</span>
          </div>
        </div>
      </div>

      {/* ── Footer status bar ────────────────────────────────────────────── */}
      <div className="tv-footer">
        <span className="tv-footer-session">
          🟢 NSE · Asia/Kolkata · 09:15–15:30 IST
        </span>
        <span className="tv-footer-vol">
          Vol: {fmtVol(ohlc?.v)}
        </span>
        <span className="tv-footer-powered">
          Powered by lightweight-charts
        </span>
      </div>
    </div>
  );
}
