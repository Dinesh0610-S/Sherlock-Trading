import React, { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import './ClueBoard.css';

// Import subcomponents
import SetupBlockerBanner from './SetupBlockerBanner';
import MetricGrid from './MetricGrid';
import BiasMatrix from './BiasMatrix';
import QuantitativeFootprintPanel from './QuantitativeFootprintPanel';
import InstitutionalChecklist from './InstitutionalChecklist';
import TradeQualityScore from './TradeQualityScore';
import SectoralMarketMap from './SectoralMarketMap';
import InstitutionalPatternEnginePanel from './InstitutionalPatternEnginePanel';

// Map selectedAsset standard ticker to Clean / Isolated symbol name
const mapAssetToCleanSymbol = (asset) => {
  const assetMap = {
    '^NSEI': 'NIFTY',
    'NIFTY': 'NIFTY',
    '^NSEBANK': 'BANKNIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    '^BSESN': 'SENSEX',
    'SENSEX': 'SENSEX',
    'NIFTY_FIN_SERVICE.NS': 'FINNIFTY',
    'NIFTY_FIN_SERVICE': 'FINNIFTY',
    '^CNXFIN': 'FINNIFTY',
    'CNXFIN': 'FINNIFTY',
    'FINNIFTY': 'FINNIFTY',
    '^NSEMDCP50': 'MIDCPNIFTY',
    'NSEMDCP50': 'MIDCPNIFTY',
    'NIFTYMID50': 'MIDCPNIFTY',
    'NIFTYMID50.NS': 'MIDCPNIFTY',
    'NSEMDCP50.NS': 'MIDCPNIFTY',
    'MIDCPNIFTY': 'MIDCPNIFTY',
    'RELIANCE.NS': 'RELIANCE',
    'HDFCBANK.NS': 'HDFCBANK',
    'TCS.NS': 'TCS',
    'INFY.NS': 'INFY',
    'ICICIBANK.NS': 'ICICIBANK',
    'SBIN.NS': 'SBIN',
    'BHARTIARTL.NS': 'BHARTIARTL',
    'ITC.NS': 'ITC',
    'LT.NS': 'LT',
    'KOTAKBANK.NS': 'KOTAKBANK',
  };
  return assetMap[asset] || assetMap[asset.toUpperCase()] || asset.toUpperCase().replace('.NS', '').replace('.BO', '').replace('^', '');
};

// Map selectedAsset standard ticker to NSE symbol
const mapAssetToNseSymbol = (asset) => {
  const nseSymbolMap = {
    '^NSEI': 'NIFTY',
    'NIFTY': 'NIFTY',
    '^NSEBANK': 'BANKNIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    'NIFTY_FIN_SERVICE.NS': 'FINNIFTY',
    'NIFTY_FIN_SERVICE': 'FINNIFTY',
    '^CNXFIN': 'FINNIFTY',
    'CNXFIN': 'FINNIFTY',
    'FINNIFTY': 'FINNIFTY',
    '^NSEMDCP50': 'MIDCPNIFTY',
    'NSEMDCP50': 'MIDCPNIFTY',
    'NIFTYMID50': 'MIDCPNIFTY',
    'NIFTYMID50.NS': 'MIDCPNIFTY',
    'NSEMDCP50.NS': 'MIDCPNIFTY',
    'MIDCPNIFTY': 'MIDCPNIFTY',
    'RELIANCE.NS': 'RELIANCE',
    'HDFCBANK.NS': 'HDFCBANK',
    'TCS.NS': 'TCS',
    'INFY.NS': 'INFY',
    'ICICIBANK.NS': 'ICICIBANK',
    'SBIN.NS': 'SBIN',
    'BHARTIARTL.NS': 'BHARTIARTL',
    'ITC.NS': 'ITC',
    'LT.NS': 'LT',
    'KOTAKBANK.NS': 'KOTAKBANK',
  };
  return nseSymbolMap[asset] || nseSymbolMap[asset.toUpperCase()] || asset.toUpperCase().replace('.NS', '').replace('.BO', '').replace('^', '');
};

const cleanSymbol = (sym) => {
  if (!sym) return 'NIFTY';
  const s = sym.toUpperCase();
  if (s.includes('NIFTY 50') || s.includes('^NSEI') || s === 'NIFTY') return 'NIFTY';
  if (s.includes('NIFTY BANK') || s.includes('^NSEBANK') || s === 'BANKNIFTY') return 'BANKNIFTY';
  if (s.includes('SENSEX') || s.includes('BSESN') || s === '^BSESN') return 'SENSEX';
  if (s.includes('NIFTY FIN') || s.includes('FINNIFTY') || s.includes('NIFTY_FIN_SERVICE')) return 'FINNIFTY';
  if (s.includes('MIDCAP') || s.includes('MIDCPNIFTY') || s.includes('NSEMDCP50') || s.includes('NIFTYMID50')) return 'MIDCPNIFTY';
  return s.replace('.NS', '').replace('.BO', '').replace('^', '');
};

// Client-side EMA
function computeEMA(prices, period) {
  if (prices.length < period) return Array(prices.length).fill(0);
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// Client-side RSI
function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return Array(prices.length).fill(50);
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  const padding = Array(period).fill(50);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return [...padding, ...rsi];
}

// Client-side MACD
function computeMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const ema12 = computeEMA(prices, shortPeriod);
  const ema26 = computeEMA(prices, longPeriod);
  const macdLine = ema12.map((val, idx) => val - ema26[idx]);
  const signalLine = computeEMA(macdLine, signalPeriod);
  const hist = macdLine.map((val, idx) => val - signalLine[idx]);
  return { macd: macdLine, signal: signalLine, hist };
}

// Date parser helper
const parseExpiryDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const month = months[parts[1].toLowerCase()];
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
};

const getDTE = (expiryStr) => {
  const expiryDate = parseExpiryDate(expiryStr);
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

const getWeekNumber = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const buildWeeklyCandle = (weekCandles) => {
  const open = weekCandles[0].open;
  const close = weekCandles[weekCandles.length - 1].close;
  const high = Math.max(...weekCandles.map(c => c.high));
  const low = Math.min(...weekCandles.map(c => c.low));
  const volume = weekCandles.reduce((sum, c) => sum + (c.volume || 0), 0);
  const time = weekCandles[0].time;
  return { time, open, high, low, close, volume };
};

const aggregateWeeklyCandles = (dailyCandles) => {
  if (!dailyCandles || dailyCandles.length === 0) return [];
  const weekly = [];
  let currentWeek = [];

  dailyCandles.forEach(c => {
    const date = new Date(c.time * 1000);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekId = `${year}-w${week}`;

    if (currentWeek.length === 0) {
      currentWeek.push(c);
    } else {
      const prevDate = new Date(currentWeek[0].time * 1000);
      const prevWeekId = `${prevDate.getFullYear()}-w${getWeekNumber(prevDate)}`;
      if (weekId === prevWeekId) {
        currentWeek.push(c);
      } else {
        weekly.push(buildWeeklyCandle(currentWeek));
        currentWeek = [c];
      }
    }
  });
  if (currentWeek.length > 0) {
    weekly.push(buildWeeklyCandle(currentWeek));
  }
  return weekly;
};

// High-Performance Live Data Update Engine
class LiveDataEngine {
  constructor() {
    this.subscribers = new Map();
    this.cache = new Map();
    this.lastUpdate = new Map();
    this.ws = null;
    this.currentSubscription = null;
  }

  subscribe(key, cb) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(cb);
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(cb);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  connectWebSocket(url) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.syncSubscription();
      return;
    }

    console.log(`[LiveDataEngine WS] Connecting to ${url}...`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[LiveDataEngine WS] Connected');
      this.syncSubscription();
    };

    this.ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'tick') {
          this.processTickPayload(payload);
        }
      } catch (err) {
        console.warn('[LiveDataEngine WS] Processing failed:', err);
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connectWebSocket(url), 500);
    };
  }

  setSubscriptionSymbol(symbol) {
    this.currentSubscription = symbol;
    this.syncSubscription();
  }

  syncSubscription() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentSubscription) {
      this.ws.send(JSON.stringify({ subscribe: this.currentSubscription }));
    }
  }

  processTick(tick) {
    console.log('[processTick] called with tick keys:', Object.keys(tick));
    Object.entries(tick).forEach(([key, value]) => {
      // Accumulate tick list on LTP updates
      if (key.endsWith('.ltp')) {
        const cleanSym = key.split('.')[0];
        const prevLtp = this.cache.get(key);
        if (value && value !== prevLtp) {
          const tickListKey = `${cleanSym}.tickList`;
          const currentTickList = this.cache.get(tickListKey) || [];
          const isUptick = prevLtp ? value > prevLtp : true;
          const newTickList = [...currentTickList, isUptick];
          if (newTickList.length > 20) newTickList.shift();
          this.cache.set(tickListKey, newTickList);
        }
      }

      if (this.cache.get(key) !== value) {
        this.cache.set(key, value);
        this.lastUpdate.set(key, Date.now());
        this.subscribers.get(key)?.forEach(cb => cb(value));
      }
    });
  }

  processTickPayload(payload) {
    const rawSym = payload.quote?.symbol || this.currentSubscription;
    const cleanSym = cleanSymbol(rawSym);
    const updates = {
      [`${cleanSym}.ltp`]: payload.quote?.lastPrice ?? null,
      [`${cleanSym}.change`]: payload.quote?.change ?? 0,
      [`${cleanSym}.pChange`]: payload.quote?.pChange ?? 0,
      [`${cleanSym}.prevClose`]: payload.quote?.previousClose ?? 0,
      [`${cleanSym}.dayHigh`]: payload.quote?.dayHigh ?? null,
      [`${cleanSym}.dayLow`]: payload.quote?.dayLow ?? null,
      [`${cleanSym}.totalTradedVolume`]: payload.quote?.totalTradedVolume ?? payload.quote?.volume ?? 0,
    };

    if (payload.pcr !== undefined && payload.pcr !== null) {
      updates[`${cleanSym}.pcrOi`] = payload.pcr;
      updates[`${cleanSym}.pcrVol`] = payload.pcr * 0.95;
    }
    if (payload.maxPain !== undefined && payload.maxPain !== null) {
      updates[`${cleanSym}.maxPain`] = payload.maxPain;
    }

    this.processTick(updates);

    const ltp = updates[`${cleanSym}.ltp`];
    const vol = updates[`${cleanSym}.totalTradedVolume`];
    if (ltp) {
      this.updateVWAP(cleanSym, ltp, vol);
    }
  }

  updateVWAP(cleanSym, ltp, volume) {
    const vwapKey = `${cleanSym}.vwap`;
    const volSumKey = `${cleanSym}.vwapVolSum`;
    const priceVolSumKey = `${cleanSym}.vwapPriceVolSum`;
    const prevVolKey = `${cleanSym}.prevVol`;

    let vwapVolSum = this.cache.get(volSumKey) || 0;
    let vwapPriceVolSum = this.cache.get(priceVolSumKey) || 0;
    let prevVol = this.cache.get(prevVolKey) || 0;

    if (ltp && volume) {
      if (vwapVolSum === 0) {
        vwapVolSum = volume;
        vwapPriceVolSum = ltp * volume;
        prevVol = volume;
      } else {
        const diffVol = volume - prevVol;
        if (diffVol > 0) {
          vwapPriceVolSum += ltp * diffVol;
          vwapVolSum += diffVol;
          prevVol = volume;
        }
      }
      this.cache.set(volSumKey, vwapVolSum);
      this.cache.set(priceVolSumKey, vwapPriceVolSum);
      this.cache.set(prevVolKey, prevVol);

      const vwapVal = vwapVolSum > 0 ? vwapPriceVolSum / vwapVolSum : ltp;
      if (ltp && Math.abs(vwapVal - ltp) / ltp > 0.20) {
        console.warn('VWAP sanity check failed:', { vwapVal, ltp });
        this.processTick({ [vwapKey]: null });
      } else {
        this.processTick({ [vwapKey]: vwapVal });
      }
    } else if (ltp) {
      // Mock tick-based VWAP accumulation for BSE / index updates without volume
      if (vwapVolSum === 0) {
        vwapVolSum = 100;
        vwapPriceVolSum = ltp * 100;
      } else {
        vwapPriceVolSum += ltp * 100;
        vwapVolSum += 100;
      }
      this.cache.set(volSumKey, vwapVolSum);
      this.cache.set(priceVolSumKey, vwapPriceVolSum);

      const vwapVal = vwapVolSum > 0 ? vwapPriceVolSum / vwapVolSum : ltp;
      if (ltp && Math.abs(vwapVal - ltp) / ltp > 0.20) {
        console.warn('VWAP sanity check failed:', { vwapVal, ltp });
        this.processTick({ [vwapKey]: null });
      } else {
        this.processTick({ [vwapKey]: vwapVal });
      }
    }
  }
}

const engine = new LiveDataEngine();
if (typeof window !== 'undefined') {
  window.engine = engine;
}

// Staggered drift-free fetch loop helper with abort signal and request ID checks
async function fetchLoop(key, interval, fetchFn, activeRef, signal, fetchId, fetchRef) {
  while (activeRef.current && !signal.aborted) {
    const start = Date.now();
    try {
      const updates = await fetchFn(signal);
      if (updates && activeRef.current && fetchId === fetchRef.current) {
        engine.processTick(updates);
      }
    } catch (e) {
      console.log(`[fetchLoop ${key}] caught error: name=${e.name} msg=${e.message}`);
      if (e.name === 'AbortError') return;
      console.warn(`[fetchLoop ${key}] error:`, e);
    }
    const elapsed = Date.now() - start;
    const waitTime = Math.max(0, interval - elapsed);
    await new Promise(resolve => {
      const timer = setTimeout(resolve, waitTime);
      signal.addEventListener('abort', () => clearTimeout(timer));
    });
  }
}

function sanitizePrice(raw) {
  const parsed = parseFloat(raw);
  // Only reject truly invalid values — not low prices
  if (isNaN(parsed)) return null;         // not a number → null
  if (parsed <= 0) return null;           // negative/zero → null
  if (parsed > 200000) return null;       // impossibly high → null
  return parsed;                          // ₹1, ₹50, ₹242, ₹50000 — ALL valid
}

export default function ClueBoardTab({
  selectedAsset,
  period,
  chartInterval,
  direction = 'LONG',
  rrRatio = 2.0,
}) {
  const [chartTimeframe, setChartTimeframe] = useState(chartInterval || '15m');
  const [candles, setCandles] = useState([]);
  const [checklistScore, setChecklistScore] = useState(0);

  useEffect(() => {
    if (chartInterval) {
      setChartTimeframe(chartInterval);
    }
  }, [chartInterval]);

  const fetchRef = useRef(0);

  const nseSymbol = mapAssetToNseSymbol(selectedAsset);
  const activeSymbol = mapAssetToCleanSymbol(selectedAsset);

  // Bind values from LiveDataEngine cache via useSyncExternalStore
  const useEngineValue = (key, fallbackValue = null) => {
    return useSyncExternalStore(
      useCallback((cb) => engine.subscribe(key, cb), [key]),
      useCallback(() => {
        const val = engine.cache.get(key);
        return val !== undefined ? val : fallbackValue;
      }, [key, fallbackValue])
    );
  };

  const useEngineTimestamp = (key) => {
    return useSyncExternalStore(
      useCallback((cb) => engine.subscribe(key, cb), [key]),
      useCallback(() => engine.lastUpdate.get(key) || null, [key])
    );
  };

  const ltp = useEngineValue(`${activeSymbol}.ltp`, null);
  const change = useEngineValue(`${activeSymbol}.change`, null);
  const pChange = useEngineValue(`${activeSymbol}.pChange`, null);
  const prevClose = useEngineValue(`${activeSymbol}.prevClose`, null);
  const dayHigh = useEngineValue(`${activeSymbol}.dayHigh`, null);
  const dayLow = useEngineValue(`${activeSymbol}.dayLow`, null);
  const vwapVal = useEngineValue(`${activeSymbol}.vwap`, null);
  const totalVolume = useEngineValue(`${activeSymbol}.totalTradedVolume`, 0);

  const optionChain = useEngineValue(`${activeSymbol}.optionChain`, null);
  const pcrOi = useEngineValue(`${activeSymbol}.pcrOi`, null);
  const pcrVol = useEngineValue(`${activeSymbol}.pcrVol`, null);
  const maxPain = useEngineValue(`${activeSymbol}.maxPain`, null);
  const currentIv = useEngineValue(`${activeSymbol}.iv`, null);

  const mtfSignals = useEngineValue(`${activeSymbol}.mtfSignals`, {});
  const biasLabel = useEngineValue(`${activeSymbol}.biasLabel`, 'NEUTRAL');
  const finalBiasScore = useEngineValue(`${activeSymbol}.biasScore`, 0);

  // Global derived and reference values
  const indices = useEngineValue('global.indices', []);
  const fiiNet = useEngineValue('global.fiiNet', 0);

  const tickList = useEngineValue(`${activeSymbol}.tickList`, []);
  const uptickRatio = tickList.length > 0
    ? tickList.filter(Boolean).length / tickList.length
    : 0.5;

  const timestamps = {
    ltp: useEngineTimestamp(`${activeSymbol}.ltp`),
    oi: useEngineTimestamp(`${activeSymbol}.pcrOi`),
    pcr: useEngineTimestamp(`${activeSymbol}.pcrVol`),
    vwap: useEngineTimestamp(`${activeSymbol}.vwap`),
    checklist: useEngineTimestamp(`${activeSymbol}.mtfSignals`),
    iv: useEngineTimestamp(`${activeSymbol}.iv`),
    fii_dii: useEngineTimestamp('global.fiiNet'),
    sector_map: useEngineTimestamp('global.indices'),
  };

  // Load initial quote data immediately on symbol change (avoiding blank states before first tick)
  const loadInitialQuote = useCallback(async (sig) => {
    try {
      const cleanSym = activeSymbol;
      const url = cleanSym === 'SENSEX'
        ? `/api/bse/index/SENSEX?_t=${Date.now()}`
        : `/nse/quote?symbol=${nseSymbol}&_t=${Date.now()}`;
      const res = await fetch(url, { signal: sig });
      if (res.ok) {
        const data = await res.json();
        const price = cleanSym === 'SENSEX' ? data.ltp : data.lastPrice;
        const cleanLtp = sanitizePrice(price);
        if (cleanLtp !== null) {
          engine.processTick(cleanSym === 'SENSEX' ? {
            [`${cleanSym}.ltp`]: cleanLtp,
            [`${cleanSym}.change`]: data.change,
            [`${cleanSym}.pChange`]: data.pChange,
            [`${cleanSym}.prevClose`]: cleanLtp - data.change,
            [`${cleanSym}.dayHigh`]: cleanLtp,
            [`${cleanSym}.dayLow`]: cleanLtp,
          } : {
            [`${cleanSym}.ltp`]: cleanLtp,
            [`${cleanSym}.change`]: data.change,
            [`${cleanSym}.pChange`]: data.pChange ?? data.changePct,
            [`${cleanSym}.prevClose`]: data.previousClose,
            [`${cleanSym}.dayHigh`]: data.dayHigh,
            [`${cleanSym}.dayLow`]: data.dayLow,
            [`${cleanSym}.totalTradedVolume`]: data.volume || data.totalTradedVolume || 0,
          });
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[Clueboard] Failed to load initial quote:', err);
    }
  }, [nseSymbol, activeSymbol]);

  useEffect(() => {
    const controller = new AbortController();
    loadInitialQuote(controller.signal);
    return () => controller.abort();
  }, [loadInitialQuote]);

  // Establish WebSocket client for Live updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${host}:3001`;
    engine.connectWebSocket(wsUrl);
  }, []);

  // Update subscription symbol when symbol changes
  useEffect(() => {
    engine.setSubscriptionSymbol(nseSymbol);
  }, [nseSymbol]);

  // Launch Staggered Fetch Fallback Loops keyed on active symbol
  useEffect(() => {
    const cleanSym = activeSymbol;
    
    // Reset symbol-specific states to null to prevent stale leakage
    engine.cache.set(`${cleanSym}.ltp`, null);
    engine.cache.set(`${cleanSym}.change`, null);
    engine.cache.set(`${cleanSym}.pChange`, null);
    engine.cache.set(`${cleanSym}.prevClose`, null);
    engine.cache.set(`${cleanSym}.dayHigh`, null);
    engine.cache.set(`${cleanSym}.dayLow`, null);
    engine.cache.set(`${cleanSym}.vwap`, null);
    engine.cache.set(`${cleanSym}.vwapVolSum`, 0);
    engine.cache.set(`${cleanSym}.vwapPriceVolSum`, 0);
    engine.cache.set(`${cleanSym}.prevVol`, 0);
    engine.cache.set(`${cleanSym}.optionChain`, null);
    engine.cache.set(`${cleanSym}.pcrOi`, null);
    engine.cache.set(`${cleanSym}.pcrVol`, null);
    engine.cache.set(`${cleanSym}.maxPain`, null);
    engine.cache.set(`${cleanSym}.iv`, null);
    engine.cache.set(`${cleanSym}.tickList`, []);

    const currentFetchId = ++fetchRef.current;
    console.log('[useEffect] Starting loops for cleanSym:', cleanSym, 'nseSymbol:', nseSymbol, 'fetchId:', currentFetchId);
    const controller = new AbortController();
    const signal = controller.signal;

    const activeRef = { current: true };

    const fetchLTP = async (sig) => {
      if (cleanSym === 'SENSEX') {
        const res = await fetch(`/api/bse/index/SENSEX?_t=${Date.now()}`, { signal: sig });
        if (!res.ok) throw new Error('BSE Sensex quote fetch failed');
        const data = await res.json();
        const cleanLtp = sanitizePrice(data.ltp);
        if (cleanLtp === null) throw new Error('Invalid Sensex price');
        return {
          [`${cleanSym}.ltp`]: cleanLtp,
          [`${cleanSym}.change`]: data.change,
          [`${cleanSym}.pChange`]: data.pChange,
          [`${cleanSym}.prevClose`]: cleanLtp - data.change,
          [`${cleanSym}.dayHigh`]: cleanLtp,
          [`${cleanSym}.dayLow`]: cleanLtp,
        };
      } else {
        const res = await fetch(`/nse/quote?symbol=${nseSymbol}&_t=${Date.now()}`, { signal: sig });
        if (!res.ok) throw new Error('NSE quote fetch failed');
        const data = await res.json();
        const cleanLtp = sanitizePrice(data.lastPrice);
        if (cleanLtp === null) throw new Error('Invalid NSE price');
        return {
          [`${cleanSym}.ltp`]: cleanLtp,
          [`${cleanSym}.change`]: data.change,
          [`${cleanSym}.pChange`]: data.pChange ?? data.changePct,
          [`${cleanSym}.prevClose`]: data.previousClose,
          [`${cleanSym}.dayHigh`]: data.dayHigh,
          [`${cleanSym}.dayLow`]: data.dayLow,
          [`${cleanSym}.totalTradedVolume`]: data.volume || data.totalTradedVolume || 0,
        };
      }
    };

    const fetchPCR = async (sig) => {
      console.log('[fetchPCR] called. nseSymbol:', nseSymbol, 'cleanSym:', cleanSym);
      const url = cleanSym === 'SENSEX'
        ? `/api/bse/option-chain?_t=${Date.now()}`
        : `/api/nse/option-chain?symbol=${nseSymbol}&_t=${Date.now()}`;
      const res = await fetch(url, { signal: sig });
      if (!res.ok) throw new Error('Option chain fetch failed');
      const data = await res.json();
      const updates = {
        [`${cleanSym}.optionChain`]: data,
        [`${cleanSym}.pcrOi`]: data.pcr ?? null,
        [`${cleanSym}.pcrVol`]: data.pcr !== null && data.pcr !== undefined ? data.pcr * 0.95 : null,
        [`${cleanSym}.maxPain`]: data.maxPain?.strike ?? data.max_pain ?? null,
        [`${cleanSym}.iv`]: data.atmIV ?? data.atm_iv ?? null,
        [`${cleanSym}.oiChange`]: data.oiChange ?? 0,
      };
      console.log('[fetchPCR] updates created:', updates);
      return updates;
    };

    const fetchVWAP = async (sig) => {
      const currentLtp = engine.cache.get(`${cleanSym}.ltp`);
      const vol = engine.cache.get(`${cleanSym}.totalTradedVolume`);
      if (currentLtp) {
        engine.updateVWAP(cleanSym, currentLtp, vol);
      }
      return null;
    };

    const fetchChecklist = async (sig) => {
      const tfs = ['15m', '1h', '1d'];
      const results = {};

      await Promise.all(tfs.map(async tf => {
        const res = await fetch(`/api/candles?symbol=${nseSymbol}&interval=${tf}&_t=${Date.now()}`, { signal: sig });
        if (res.ok) {
          const data = await res.json();
          results[tf] = data.candles || [];
        }
      }));

      if (results['1d'] && results['1d'].length > 0) {
        results['1w'] = aggregateWeeklyCandles(results['1d']);
      }

      const newSignals = {};
      const tfList = ['15m', '1h', '1d', '1w'];

      tfList.forEach(tf => {
        const tfCandles = results[tf];
        if (!tfCandles || tfCandles.length < 20) {
          newSignals[tf] = { rsi: 0, macd: 0, ema: 0, volume: 0, priceAction: 0 };
          return;
        }

        const closes = tfCandles.map(c => c.close);
        const highs = tfCandles.map(c => c.high);
        const lows = tfCandles.map(c => c.low);
        const vols = tfCandles.map(c => c.volume);
        
        const latestClose = closes[closes.length - 1];
        const prevCloseVal = closes[closes.length - 2];

        const rsiArray = computeRSI(closes, 14);
        const latestRsi = rsiArray[rsiArray.length - 1];
        let rsiSignal = 0;
        if (latestRsi > 70) rsiSignal = -1;
        else if (latestRsi < 30) rsiSignal = 1;
        else rsiSignal = latestClose > prevCloseVal ? 1 : -1;

        const macdObj = computeMACD(closes);
        const lMacd = macdObj.macd[macdObj.macd.length - 1];
        const lSig = macdObj.signal[macdObj.signal.length - 1];
        const lHist = macdObj.hist[macdObj.hist.length - 1];
        const pHist = macdObj.hist[macdObj.hist.length - 2];
        
        let macdSignal = 0;
        if (lMacd > lSig && lHist > pHist) macdSignal = 1;
        else if (lMacd < lSig && lHist < pHist) macdSignal = -1;

        const ema9Arr = computeEMA(closes, 9);
        const ema21Arr = computeEMA(closes, 21);
        const ema50Arr = computeEMA(closes, 50);

        const lEma9 = ema9Arr[ema9Arr.length - 1];
        const lEma21 = ema21Arr[ema21Arr.length - 1];
        const lEma50 = ema50Arr[ema50Arr.length - 1];

        let emaSignal = 0;
        if (latestClose > lEma9 && latestClose > lEma21 && latestClose > lEma50) emaSignal = 1;
        else if (latestClose < lEma9 && latestClose < lEma21 && latestClose < lEma50) emaSignal = -1;

        const avgVol20 = vols.slice(-20).reduce((a,b)=>a+b, 0)/20;
        const latestVol = vols[vols.length - 1];
        let volSignal = 0;
        if (latestVol > avgVol20) {
          volSignal = latestClose > prevCloseVal ? 1 : -1;
        }

        const lHigh = highs[highs.length - 1];
        const lLow = lows[lows.length - 1];
        const pHigh = highs[highs.length - 2];
        const pLow = lows[lows.length - 2];

        let paSignal = 0;
        if (lHigh > pHigh && lLow > pLow) paSignal = 1;
        else if (lHigh < pHigh && lLow < pLow) paSignal = -1;

        newSignals[tf] = {
          rsi: rsiSignal,
          macd: macdSignal,
          ema: emaSignal,
          volume: volSignal,
          priceAction: paSignal
        };
      });

      let weightedSum = 0;
      let maxWeightSum = 0;
      const weights = { '15m': 1, '1h': 2, '1d': 3, '1w': 4 };
      ['15m', '1h', '1d', '1w'].forEach(tf => {
        const data = newSignals[tf] || { rsi: 0, macd: 0, ema: 0, volume: 0, priceAction: 0 };
        const score = Object.values(data).reduce((a,b)=>a+b, 0);
        weightedSum += score * weights[tf];
        maxWeightSum += 5 * weights[tf];
      });
      const finalBiasScore = maxWeightSum > 0 ? (weightedSum / maxWeightSum) * 10 : 0;

      let biasLabel = 'NEUTRAL';
      if (finalBiasScore >= 6.0) biasLabel = 'STRONGLY BULLISH';
      else if (finalBiasScore >= 1.5) biasLabel = 'BULLISH';
      else if (finalBiasScore <= -6.0) biasLabel = 'STRONGLY BEARISH';
      else if (finalBiasScore <= -1.5) biasLabel = 'BEARISH';

      return {
        [`${cleanSym}.mtfSignals`]: newSignals,
        [`${cleanSym}.biasScore`]: finalBiasScore,
        [`${cleanSym}.biasLabel`]: biasLabel,
      };
    };

    const fetchReference = async (sig) => {
      let fii = 0;
      try {
        const res = await fetch(`/api/fiidii/today?_t=${Date.now()}`, { signal: sig });
        if (res.ok) {
          const data = await res.json();
          fii = data?.fii?.net ?? 0;
        }
      } catch(e) {
        if (e.name !== 'AbortError') console.warn('FII/DII fetch failed:', e);
      }

      let sectorIndices = [];
      try {
        const res = await fetch(`/api/nse/indices?_t=${Date.now()}`, { signal: sig });
        if (res.ok) {
          const data = await res.json();
          sectorIndices = data.indices || [];
        }
      } catch(e) {
        if (e.name !== 'AbortError') console.warn('Indices fetch failed:', e);
      }

      return {
        'global.fiiNet': fii,
        'global.indices': sectorIndices,
      };
    };

    fetchLoop('ltp', 300, fetchLTP, activeRef, signal, currentFetchId, fetchRef);
    fetchLoop('pcr', 800, fetchPCR, activeRef, signal, currentFetchId, fetchRef);
    fetchLoop('vwap', 500, fetchVWAP, activeRef, signal, currentFetchId, fetchRef);
    fetchLoop('checklist', 2000, fetchChecklist, activeRef, signal, currentFetchId, fetchRef);
    fetchLoop('reference', 30000, fetchReference, activeRef, signal, currentFetchId, fetchRef);

    return () => {
      activeRef.current = false;
      controller.abort();
    };
  }, [nseSymbol, activeSymbol]);

  // Fetch Chart Candles
  useEffect(() => {
    const controller = new AbortController();
    const loadChartCandles = async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${nseSymbol}&interval=${chartTimeframe}&_t=${Date.now()}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.candles) {
            setCandles(data.candles);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Clueboard] Failed chart candles:', err);
        }
      }
    };
    loadChartCandles();
    return () => {
      controller.abort();
    };
  }, [nseSymbol, chartTimeframe]);

  // Update latest candle on live ltp change
  useEffect(() => {
    if (ltp && candles.length > 0) {
      const updated = [...candles];
      const last = { ...updated[updated.length - 1] };
      
      last.close = ltp;
      if (ltp > last.high) last.high = ltp;
      if (ltp < last.low) last.low = ltp;
      
      updated[updated.length - 1] = last;
      setCandles(updated);
    }
  }, [ltp]);

  const currentClose = candles[candles.length - 1]?.close || ltp || (activeSymbol === 'SENSEX' ? 74600 : activeSymbol === 'NIFTY' ? 23000 : activeSymbol === 'BANKNIFTY' ? 51000 : 100);
  const vwapDist = vwapVal ? Math.abs(currentClose - vwapVal) / vwapVal : 0;

  const sessionVwapAbovePct = candles.length > 0
    ? candles.filter(c => c.close > (c.vwap || vwapVal || c.close)).length / candles.length
    : 0.5;

  const dte = getDTE(optionChain?.expiry);

  const expiryDate = parseExpiryDate(optionChain?.expiry);
  const nowTime = new Date();
  const expiryMinutes = expiryDate ? Math.max(0, (expiryDate.getTime() - nowTime.getTime()) / (1000 * 60)) : null;

  const fairValue = (ltp !== null && dte !== null)
    ? ltp + (ltp * (activeSymbol === 'SENSEX' ? 0.068 : 0.065) * dte / 365)
    : null;

  // Time-adjusted expected volume: compares running volume against what we'd
  // EXPECT to have accumulated so far in the session (not the full-day average).
  // NSE session = 9:15 → 15:30 IST = 375 minutes total.
  // We distribute volume linearly (crude but better than a fixed constant).
  const avg20DayVolume = (() => {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMins = utcMins + istOffset;
    const sessionStart = 9 * 60 + 15;  // 9:15 IST
    const sessionEnd   = 15 * 60 + 30; // 15:30 IST
    const fullDayAvg   = 1_200_000;
    const elapsed = Math.max(0, Math.min(istMins - sessionStart, sessionEnd - sessionStart));
    const sessionLength = sessionEnd - sessionStart; // 375 min
    const fraction = elapsed / sessionLength;
    // If outside session (pre-market / post-market) return the full average
    // so the ratio doesn't blow up; but guard against returning 0
    if (fraction <= 0) return fullDayAvg;
    return Math.max(10_000, fullDayAvg * fraction);
  })();

  return (
    <div className="clueboard-wrapper">
      {/* ROW 1: Smart Setup Blocker Banner */}
      <SetupBlockerBanner
        score={checklistScore}
        bias={biasLabel}
        direction={direction}
        volumeRatio={totalVolume / avg20DayVolume}
        ivPercentile={currentIv > 20 ? 80 : 45}
        dte={dte}
        expiryMinutes={expiryMinutes}
        pcr={pcrOi}
        rrRatio={rrRatio}
        vwapDistancePct={vwapDist}
      />

      {/* ROW 2: 6-Cell Metrics Grid Bar */}
      <MetricGrid
        ltp={ltp}
        prevClose={prevClose}
        dayHigh={dayHigh}
        dayLow={dayLow}
        pcrOi={pcrOi}
        pcrVol={pcrVol}
        vwap={vwapVal}
        vwapValid={vwapVal !== null}
        fairValue={fairValue}
        dte={dte}
        riskFreeRate={activeSymbol === 'SENSEX' ? 0.068 : 0.065}
        maxPain={maxPain}
        timestamps={timestamps}
        activeSymbol={activeSymbol}
      />

      {/* ROW 3: Left 60% vs Right 40% Column main grid */}
      <div className="clueboard-grid">
        {/* Left 60% */}
        <div className="clueboard-left">
          {/* Bias Matrix */}
          <BiasMatrix signals={mtfSignals} />

          {/* Quantitative Footprint Chart — live canvas chart */}
          <QuantitativeFootprintPanel
            candles={candles}
            optionChain={optionChain}
            spotPrice={ltp}
            selectedAsset={selectedAsset}
            timeframe={chartTimeframe}
            onIntervalChange={setChartTimeframe}
            onCandlesUpdate={(updatedCandles) => {
              // Bridge live candles to Pre-Market Intel CE/PE signal engine
              window.__sharedChartData = {
                symbol:    activeSymbol,
                timeframe: chartTimeframe,
                candles:   updatedCandles,
                updatedAt: Date.now(),
              };
            }}
            onTickUpdate={(price, change) => {
              // Bridge live LTP to Pre-Market Intel
              window.__sharedLTP = {
                symbol:    activeSymbol,
                price,
                change,
                updatedAt: Date.now(),
              };
            }}
          />
        </div>

        {/* Right 40% */}
        <div className="clueboard-right">
          {/* Scored Institutional Checklist */}
          <InstitutionalChecklist
            direction={direction}
            ltp={ltp || currentClose || 0}
            ema9={candles[candles.length-1]?.ema9 || currentClose || 0}
            ema21={candles[candles.length-1]?.ema21 || currentClose || 0}
            ema50={currentClose ? currentClose * 0.99 : 0}
            currentVolume={totalVolume || 0}
            avgVolume={avg20DayVolume}
            vwap={vwapVal || currentClose || 0}
            sessionVwapAbovePct={sessionVwapAbovePct || 0.5}
            pcr={pcrOi !== null ? pcrOi : 1.0}
            pcrChange={0}
            fiiNet={fiiNet || 0}
            priceChange={(ltp !== null && prevClose !== null) ? ltp - prevClose : 0}
            uptickRatio={uptickRatio || 0.5}
            onScoreUpdate={setChecklistScore}
          />

          {/* Trade Quality Score Gate */}
          <TradeQualityScore
            direction={direction}
            checklistScore={checklistScore}
            pcr={pcrOi}
            ivPercentile={currentIv > 20 ? 80 : 45}
            rrRatio={rrRatio}
            vwapDistancePct={vwapDist}
          />
        </div>
      </div>
      
      {/* ROW 3.5: Institutional Candlestick Pattern Signal Engine */}
      <InstitutionalPatternEnginePanel
        activeSymbol={activeSymbol}
        spotPrice={ltp}
        iv={currentIv ? currentIv / 100 : null} // convert percentage IV to decimal
        dte={dte}
      />

      {/* ROW 4: Upgraded Sectoral Market Map */}
      <SectoralMarketMap indices={indices} />
    </div>
  );
}
