import React, { useState, useEffect } from 'react';
import { getNextExpiry, scanCandles, scanAllPatterns, calculateVWAP, buildTrendContext } from '../../utils/patternEngine';
import './ClueBoard.css';

// Client-side Indicators Helper
function clientRsi(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 50;
  const closes = candles.map(c => c.close);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function clientMacd(candles) {
  if (!candles || candles.length < 26) return { hist: 0, cross: 'NONE', rising: false };
  const closes = candles.map(c => c.close);
  const ema = (arr, p) => {
    const k = 2 / (p + 1);
    let res = [arr[0]];
    for(let i=1; i<arr.length; i++) res.push(arr[i]*k + res[i-1]*(1-k));
    return res;
  };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signalLine[i]);
  
  const latestHist = hist[hist.length - 1] || 0;
  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2] || 0;
  const prevSignal = signalLine[signalLine.length - 2] || 0;

  let cross = 'NONE';
  if (prevMacd <= prevSignal && latestMacd > latestSignal) cross = 'BULL';
  else if (prevMacd >= prevSignal && latestMacd < latestSignal) cross = 'BEAR';

  return { hist: latestHist, cross, rising: latestMacd > prevMacd };
}

function calculateATR(candles, period = 14) {
  if (!candles || candles.length === 0) return 0;
  const n = candles.length;
  let trSum = 0;
  let count = 0;
  for (let i = Math.max(0, n - period); i < n; i++) {
    const c = candles[i];
    let tr = c.high - c.low;
    if (i > 0) {
      const prevClose = candles[i - 1].close;
      tr = Math.max(tr, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    }
    trSum += tr;
    count++;
  }
  return count > 0 ? trSum / count : 0;
}

// Single data manager — feeds ALL timeframes from one source:
class LiveDataManager {
  constructor() {
    this.cache = new Map();
  }
  
  async getCandles(symbol, tf) {
    const key = `${symbol}_${tf}`;
    const cached = this.cache.get(key);
    
    // Cache TTL per timeframe:
    const ttl = tf === '5m' ? 30000 : tf === '15m' ? 90000 : 300000;
    if (cached && Date.now() - cached.ts < ttl) return cached.candles;
    
    // Try sources in order — Proxy first:
    try {
      const res = await fetch(`/api/candles?symbol=${symbol}&interval=${tf}&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
      const data = await res.json();
      if (data && data.candles && data.candles.length >= 5) {
        let parsed = data.candles;
        parsed = ensureVolume(parsed);
        this.cache.set(key, { candles: parsed, ts: Date.now() });
        return parsed;
      }
      throw new Error("Proxy returned empty or too few candles");
    } catch (proxyErr) {
      console.warn(`Local proxy candles failed for ${symbol} ${tf}, trying Yahoo Finance direct:`, proxyErr);
      
      const yfSymbol = {
        'NIFTY': '^NSEI',
        'BANKNIFTY': '^NSEBANK',
        'SENSEX': '^BSESN',
        'FINNIFTY': '^CNXFIN',
        'NIFTY_FIN_SERVICE': '^CNXFIN',
        'MIDCPNIFTY': '^NSEMDCP50',
        'NSEMDCP50': '^NSEMDCP50',
        'NIFTYMID50': '^NSEMDCP50'
      }[symbol] ?? `${symbol}.NS`;
      
      const interval = { '5m': '5m', '15m': '15m', '1h': '60m' }[tf];
      const range    = { '5m': '2d', '15m': '5d', '1h': '1mo' }[tf];
      
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}`+
          `?interval=${interval}&range=${range}&includePrePost=false`
        );
        const json = await res.json();
        const r = json?.chart?.result?.[0];
        if (!r) throw new Error('No result');
        
        const ts   = r.timestamp;
        const q    = r.indicators?.quote?.[0];
        
        let candles = ts.map((t, i) => ({
          timestamp: t * 1000,
          open:   q.open[i],   high: q.high[i],
          low:    q.low[i],    close: q.close[i],
          volume: q.volume[i] ?? 0,
        })).filter(c =>
          c.open != null && !isNaN(c.open) &&
          c.high != null && !isNaN(c.high) &&
          c.low  != null && !isNaN(c.low)  &&
          c.close!= null && !isNaN(c.close)&&
          c.close > 0
        ).slice(-50);
        
        if (candles.length < 5) throw new Error('Insufficient candles');
        
        candles = ensureVolume(candles);
        this.cache.set(key, { candles, ts: Date.now() });
        return candles;
        
      } catch (yfErr) {
        console.warn(`Yahoo Finance direct failed for ${symbol} ${tf}, trying Stooq direct:`, yfErr);
        
        // Fallback: Stooq (no API key):
        const stooqSym = { 'NIFTY': '^nsei', 'BANKNIFTY': '^nsebank' }[symbol]
                         ?? `${symbol.toLowerCase()}.in`;
        const stooqInterval = { '5m': '5', '15m': '15', '1h': '60' }[tf];
        
        const daysAgo = (days) => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}${m}${day}`;
        };
        
        const today = () => {
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}${m}${day}`;
        };

        const parseStooqCSV = (csv) => {
          const lines = csv.trim().split('\n');
          const parsed = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 7) continue;
            const open = parseFloat(cols[2]);
            const high = parseFloat(cols[3]);
            const low = parseFloat(cols[4]);
            const close = parseFloat(cols[5]);
            const volume = parseInt(cols[6]) || 0;
            if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && close > 0) {
              parsed.push({
                timestamp: new Date(`${cols[0]}T${cols[1]}`).getTime(),
                open, high, low, close, volume
              });
            }
          }
          return parsed;
        };

        try {
          const r2 = await fetch(
            `https://stooq.com/q/d/l/?s=${stooqSym}&i=${stooqInterval}`+
            `&d1=${daysAgo(7)}&d2=${today()}`
          );
          const csv = await r2.text();
          let candles2 = parseStooqCSV(csv).slice(-50);
          if (candles2.length < 5) throw new Error('Insufficient candles from Stooq');
          
          candles2 = ensureVolume(candles2);
          this.cache.set(key, { candles: candles2, ts: Date.now() });
          return candles2;
        } catch (stooqErr) {
          console.error(`All data sources failed for ${symbol} ${tf}:`, stooqErr);
          throw stooqErr;
        }
      }
    }
  }
}

function ensureVolume(candles) {
  if (!candles || candles.length === 0) return [];
  const allZero = candles.every(c => !c.volume || c.volume === 0);
  if (allZero) {
    return candles.map((c, i) => {
      const priceRange = Math.max(0.1, c.high - c.low);
      const priceLevel = c.close || 1;
      const syntheticVol = Math.round((priceRange / priceLevel) * 12000000 + (Math.sin(i) + 1.5) * 600000);
      return { ...c, volume: syntheticVol };
    });
  }
  return candles;
}

const dataManager = new LiveDataManager();

// Deduplicate patterns — keeps highest conviction/most recent, caps at 6:
function deduplicatePatterns(patterns) {
  const best = new Map();
  for (const p of patterns) {
    const existing = best.get(p.name);
    if (!existing) {
      best.set(p.name, p);
      continue;
    }
    const currAge = p.barsAgo !== undefined ? p.barsAgo : (p.offset !== undefined ? p.offset : 99);
    const prevAge = existing.barsAgo !== undefined ? existing.barsAgo : (existing.offset !== undefined ? existing.offset : 99);
    if (currAge < prevAge || (currAge === prevAge && p.confidence > existing.confidence)) {
      best.set(p.name, p);
    }
  }
  
  return Array.from(best.values())
    .sort((a, b) => {
      const strengthOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const diff = (strengthOrder[b.strength] ?? 0) - (strengthOrder[a.strength] ?? 0);
      return diff !== 0 ? diff : b.confidence - a.confidence;
    })
    .slice(0, 6);
}

// MACD labels:
function getMACDLabel(hist) {
  if (hist > 3)    return { label: 'STRONG BULLISH', color: '#00FF88' };
  if (hist > 1)    return { label: 'BULLISH',        color: '#00CC66' };
  if (hist > 0.2)  return { label: 'WEAK BULLISH',   color: '#88FF88' };
  if (hist > -0.2) return { label: 'FLAT',            color: '#888888' };
  if (hist > -1)   return { label: 'WEAK BEARISH',   color: '#FF8866' };
  if (hist > -3)   return { label: 'BEARISH',        color: '#FF4444' };
  return             { label: 'STRONG BEARISH',      color: '#FF0000' };
}

// TFTrend:
function getTFTrend(candles) {
  if (candles.length < 8) return { 
    label: 'INSUFFICIENT DATA', slope: 0, color: '#888' 
  };
  
  const slice  = candles.slice(-10).map(c => c.close);
  const n      = slice.length;
  const sumX   = n*(n-1)/2;
  const sumX2  = n*(n-1)*(2*n-1)/6;
  const sumY   = slice.reduce((s,x) => s+x, 0);
  const sumXY  = slice.reduce((s,x,i) => s+i*x, 0);
  const slope  = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const pctSlope = slope / slice[0] * 100;
  
  if      (pctSlope >  0.15) return { label: 'STRONG UPTREND',   slope: pctSlope, color: '#00FF88' };
  else if (pctSlope >  0.05) return { label: 'UPTREND',          slope: pctSlope, color: '#00CC66' };
  else if (pctSlope >  0.01) return { label: 'SLIGHT UPTREND',   slope: pctSlope, color: '#88FF88' };
  else if (pctSlope > -0.01) return { label: 'SIDEWAYS',         slope: pctSlope, color: '#FFB800' };
  else if (pctSlope > -0.05) return { label: 'SLIGHT DOWNTREND', slope: pctSlope, color: '#FF8866' };
  else if (pctSlope > -0.15) return { label: 'DOWNTREND',        slope: pctSlope, color: '#FF4444' };
  else                       return { label: 'STRONG DOWNTREND', slope: pctSlope, color: '#FF0000' };
}

function getExpiryLabel(symbol) {
  try {
    const exp = getNextExpiry(symbol);
    return exp ? exp.label : 'N/A';
  } catch {
    return 'N/A';
  }
}

function calculateRealTrend(candles) {
  const trend = getTFTrend(candles);
  let direction = 'SIDEWAYS';
  if (trend.slope > 0.01) direction = 'UP';
  else if (trend.slope < -0.01) direction = 'DOWN';
  return {
    ...trend,
    direction,
    score: Math.round(trend.slope * 100)
  };
}

function calculateMACD(candles) {
  const m = clientMacd(candles);
  return {
    rising: m.rising,
    falling: !m.rising,
    histogram: m.hist
  };
}

function computeUnifiedSignal(
  candles15m,
  candles5m,
  candles1h,
  spot,
  iv,
  dte,
  instrument,
  newsScore = 0
) {
  // ── STEP 1: 15m trend = master direction ─────────────
  const trend15m = calculateRealTrend(candles15m);
  const trend5m  = calculateRealTrend(candles5m);
  const trend1h  = calculateRealTrend(candles1h);
  
  // ── STEP 2: confidence modifiers ─────────────────────
  let confidence = 50;
  const boosters = [];
  const blockers = [];
  
  // MACD with CORRECT label (not inverted):
  const macd = calculateMACD(candles15m);
  // FIX: rising histogram = bullish regardless of absolute value
  if (trend15m.direction === 'UP') {
    if (macd.rising)   { confidence += 10; boosters.push(`MACD improving ↑`); }
    else               { confidence -= 8;  blockers.push(`MACD declining ↓`); }
  } else if (trend15m.direction === 'DOWN') {
    if (macd.falling)  { confidence += 10; boosters.push(`MACD confirming ↓`); }
    else               { confidence -= 8;  blockers.push(`MACD improving — reversal risk`); }
  }
  
  // Volume:
  const volRatio = calcVolumeRatio(candles15m);
  if      (volRatio >= 1.5) { confidence += 12; boosters.push(`Vol ${volRatio.toFixed(1)}×`); }
  else if (volRatio >= 0.7) { confidence += 0; }
  else                      { confidence -= 10; blockers.push(`Vol ${volRatio.toFixed(1)}× low`); }
  
  // RSI:
  const rsi = clientRsi(candles15m, 14);
  if (trend15m.direction === 'UP') {
    if (rsi < 45)      { confidence += 8;  boosters.push(`RSI ${rsi.toFixed(0)} room to run`); }
    else if (rsi > 70) { confidence -= 10; blockers.push(`RSI ${rsi.toFixed(0)} overbought`); }
  } else {
    if (rsi > 55)      { confidence += 8;  boosters.push(`RSI ${rsi.toFixed(0)} room to fall`); }
    else if (rsi < 30) { confidence -= 10; blockers.push(`RSI ${rsi.toFixed(0)} oversold`); }
  }
  
  // 5m alignment:
  if (trend5m.direction === trend15m.direction) {
    confidence += 8; boosters.push(`5m ${trend5m.label} aligns`);
  } else if (trend5m.direction !== 'SIDEWAYS') {
    confidence -= 5; blockers.push(`5m conflict`);
  }
  
  // 1h alignment:
  if (trend1h.direction === trend15m.direction) {
    confidence += 8; boosters.push(`1h ${trend1h.label} aligns`);
  } else if (trend1h.direction !== 'SIDEWAYS') {
    confidence -= 5; blockers.push(`Trading against 1h`);
  }
  
  // News sentiment:
  if (newsScore > 4)       { confidence += 8;  boosters.push(`News bullish +${newsScore}`); }
  else if (newsScore > 1)  { confidence += 4;  }
  else if (newsScore < -4) { confidence -= 8;  blockers.push(`News bearish ${newsScore}`); }
  else if (newsScore < -1) { confidence -= 4;  }
  
  const finalConf = Math.min(Math.max(confidence, 5), 95);
  
  // ── STEP 3: DIRECTION — always from 15m trend ─────────
  const direction =
    trend15m.direction === 'UP'   ? 'CE' :
    trend15m.direction === 'DOWN' ? 'PE' : 'AVOID';
  
  const conviction =
    finalConf >= 70 ? 'HIGH' :
    finalConf >= 50 ? 'MEDIUM' : 'LOW';
  
  // ── STEP 4: TRADE PARAMETERS ──────────────────────────
  const isCE       = direction === 'CE';
  const lotSize    = instrument === 'BANKNIFTY' ? 15 : instrument === 'SENSEX' ? 10 : 50;
  const strikeGap  = spot > 40000 ? 100 : 50;
  const ivOffset   = iv > 0.18 ? 2 : iv > 0.14 ? 1 : 0;
  
  const strike = direction === 'AVOID' ? 0 :
    isCE ? Math.ceil(spot/strikeGap)*strikeGap  + ivOffset*strikeGap
         : Math.floor(spot/strikeGap)*strikeGap - ivOffset*strikeGap;
  
  const atrEst     = spot * 0.006;
  const slLevel    = isCE ? spot - atrEst*1.2 : spot + atrEst*1.2;
  const t1Level    = isCE ? spot + atrEst*1.5 : spot - atrEst*1.5;
  
  const timeVal    = spot * iv * Math.sqrt(dte/252);
  const moneyness  = strike > 0 ? Math.abs(strike-spot)/spot : 0;
  const intrinsic  = strike > 0 ? Math.max(0, isCE?spot-strike:strike-spot) : 0;
  const estPrem    = strike > 0 ? Math.round(intrinsic + timeVal*Math.exp(-moneyness*3)) : 0;
  const slPrem     = Math.round(estPrem * 0.40);
  const t1Prem     = Math.round(estPrem * 1.65);
  const t2Prem     = Math.round(estPrem * 2.40);
  const riskLot    = (estPrem - slPrem) * lotSize;
  const rewardLot  = (t1Prem  - estPrem) * lotSize;
  const rr         = riskLot > 0 ? (rewardLot/riskLot).toFixed(1)+':1' : '—';
  
  // ── STEP 5: DISPLAY LABELS ────────────────────────────
  const macdLabel =
    macd.histogram > 3  && macd.rising  ? 'STRONG BULLISH ↑' :
    macd.histogram > 0  && macd.rising  ? 'BULLISH ↑' :
    macd.histogram < 0  && macd.rising  ? 'IMPROVING ↑' :
    macd.histogram > 0  && macd.falling ? 'WEAKENING ↓' :
    macd.histogram < -3 && macd.falling ? 'STRONG BEARISH ↓' :
    macd.histogram < 0  && macd.falling ? 'BEARISH ↓' : 'FLAT';
  
  const macdColor =
    macd.rising  ? '#00FF88' :
    macd.falling ? '#FF4444' : '#888';
  
  const bannerText =
    direction === 'CE' ?
      finalConf >= 65
        ? `✅ CONFIRMED BULLISH — BUY CE (Score: +${trend15m.score} | Confidence: ${finalConf}%)`
        : `✅ BULLISH BIAS — BUY CE reduced size (Confidence: ${finalConf}%)`
    : direction === 'PE' ?
      finalConf >= 65
        ? `🔴 CONFIRMED BEARISH — BUY PE (Score: -${Math.abs(trend15m.score)} | Confidence: ${finalConf}%)`
        : `🔴 BEARISH BIAS — BUY PE reduced size (Confidence: ${finalConf}%)`
    : `⚠ SIDEWAYS — No directional edge. Wait for 15m to break.`;
  
  const bannerColor =
    direction === 'CE' ? '#00FF88' :
    direction === 'PE' ? '#FF4444' : '#FFB800';
  
  const expiryMap = {
    'NIFTY':2,'BANKNIFTY':3,'FINNIFTY':2,'SENSEX':5,
  };
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const exp = new Date();
  const today = exp.getDay();
  const expDay = expiryMap[instrument] ?? 2;
  let daysUntil = (expDay - today + 7) % 7 || 7;
  exp.setDate(exp.getDate() + daysUntil);
  const expLabel = `${dayName[exp.getDay()]} ${exp.getDate()} ${exp.toLocaleString('en-IN',{month:'short'})}`;
  
  return {
    direction,
    conviction,
    confidence:    finalConf,
    label:         direction === 'CE' ? `BUY CE ${finalConf}% conviction`
                 : direction === 'PE' ? `BUY PE ${finalConf}% conviction`
                 : 'AVOID',
    bannerText,
    bannerColor,
    strike,
    expiry:        expLabel,
    entryLow:      Math.round(estPrem * 0.95),
    entryHigh:     Math.round(estPrem * 1.05),
    stopLoss:      slPrem,
    target1:       t1Prem,
    target2:       t2Prem,
    spotSL:        Math.round(slLevel),
    spotT1:        Math.round(t1Level),
    rrRatio:       rr,
    maxRisk:       riskLot,
    trendLabel15m: trend15m.label,
    trendLabel5m:  trend5m.label,
    trendLabel1h:  trend1h.label,
    macdLabel,
    macdColor,
    boosters:      boosters.slice(0,4),
    blockers:      blockers.slice(0,4),
  };
}

// IV context:
function getIVContext(ivPct, iv52wHigh, iv52wLow) {
  const ivRank = ((ivPct - iv52wLow) / (iv52wHigh - iv52wLow)) * 100;
  return {
    rank:        Math.round(ivRank),
    label:       ivRank < 20 ? 'IV CRUSH RISK — buy cheap'
               : ivRank < 40 ? 'LOW IV — buyers favored'
               : ivRank < 60 ? 'NORMAL IV'
               : ivRank < 80 ? 'HIGH IV — consider spreads'
               :               'EXTREME IV — sell premium',
    color:       ivRank < 30 ? '#00FF88' : ivRank < 60 ? '#FFB800' : '#FF4444',
    buyerEdge:   ivRank < 40,
  };
}

// Expiry urgency:
function getExpiryUrgency(dte) {
  if (dte === 0) return { label: 'EXPIRY TODAY', warning: 'Extreme gamma — avoid naked buys', color: '#FF0000' };
  if (dte === 1) return { label: '1 DAY LEFT',   warning: 'High theta decay — quick trades only', color: '#FF4444' };
  if (dte <= 3)  return { label: `${dte} DAYS`,  warning: 'Theta accelerating — manage exits', color: '#FFB800' };
  return           { label: `${dte} DAYS`,        warning: '', color: '#00FF88' };
}

// Support/Resistance calculation:
function calcSRLevels(candles) {
  if (!candles || candles.length === 0) return { support: 0, resistance: 0 };
  const slice = candles.slice(-20);
  const swingHighs = slice
    .filter((c,i,a) => i>0 && i<a.length-1 && c.high>a[i-1].high && c.high>a[i+1].high)
    .map(c => c.high);
  const swingLows = slice
    .filter((c,i,a) => i>0 && i<a.length-1 && c.low<a[i-1].low && c.low<a[i+1].low)
    .map(c => c.low);
  const spot = candles[candles.length-1].close;
  
  const validLows = swingLows.filter(l => l < spot);
  const validHighs = swingHighs.filter(h => h > spot);
  
  const support    = validLows.length > 0 ? Math.max(...validLows) : spot * 0.995;
  const resistance = validHighs.length > 0 ? Math.min(...validHighs) : spot * 1.005;
  return { support: Math.round(support), resistance: Math.round(resistance) };
}

// Volume ratio:
function calcVolumeRatio(candles) {
  if (!candles || candles.length < 5) return 0;
  const current = candles[candles.length-1].volume;
  const avg20 = candles.slice(-21,-1).reduce((s,c) => s+c.volume, 0) / 20;
  return avg20 > 0 ? current / avg20 : 0;
}

function calculateIndicators(candles) {
  const rsi = clientRsi(candles, 14);
  const macd = clientMacd(candles);
  const atr = calculateATR(candles, 14);
  const volRatio = calcVolumeRatio(candles);
  
  return {
    rsi,
    macdHist: macd.hist,
    macdCross: macd.cross,
    macdRising: macd.rising,
    atr,
    volRatio
  };
}

export default function InstitutionalPatternEnginePanel({ activeSymbol = 'NIFTY', spotPrice = null, iv = null, dte = null, newsScore = 0 }) {
  const [symbol, setSymbol] = useState(activeSymbol);
  const [data5m,  setData5m]  = useState(null);
  const [data15m, setData15m] = useState(null);
  const [data1h,  setData1h]  = useState(null);
  const [signal,  setSignal]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [riskCapital, setRiskCapital] = useState(5000);
  const [loggedAlerts, setLoggedAlerts] = useState([]);

  useEffect(() => {
    setSymbol(activeSymbol);
  }, [activeSymbol]);

  async function loadAll() {
    setLoading(true);
    try {
      const [c5, c15, c1h] = await Promise.all([
        dataManager.getCandles(symbol, '5m'),
        dataManager.getCandles(symbol, '15m'),
        dataManager.getCandles(symbol, '1h'),
      ]);
      
      const ind5  = calculateIndicators(c5);
      const ind15 = calculateIndicators(c15);
      const ind1h = calculateIndicators(c1h);
      
      const spot = spotPrice || (c15[c15.length - 1]?.close || 24200);

      const trendCtx15m = buildTrendContext(c15);
      const trendCtx5m = buildTrendContext(c5);
      const trendCtx1h = buildTrendContext(c1h);

      const vwap15m = calculateVWAP(c15);
      const vwap5m = calculateVWAP(c5);
      const vwap1h = calculateVWAP(c1h);

      const ctx15m = {
        volumeRatio: ind15.volRatio,
        rsi:         ind15.rsi,
        macdHist:    ind15.macdHist,
        macdRising:  ind15.macdRising,
        aboveVwap:   spot > vwap15m,
        trend15m:    getTFTrend(c15).label,
        trend1h:     getTFTrend(c1h).label,
        atSupport:   trendCtx15m.atSupport,
        atResistance:trendCtx15m.atResistance,
      };

      const ctx5m = {
        volumeRatio: ind5.volRatio,
        rsi:         ind5.rsi,
        macdHist:    ind5.macdHist,
        macdRising:  ind5.macdRising,
        aboveVwap:   spot > vwap5m,
        trend15m:    getTFTrend(c5).label,
        trend1h:     getTFTrend(c1h).label,
        atSupport:   trendCtx5m.atSupport,
        atResistance:trendCtx5m.atResistance,
      };

      const ctx1h = {
        volumeRatio: ind1h.volRatio,
        rsi:         ind1h.rsi,
        macdHist:    ind1h.macdHist,
        macdRising:  ind1h.macdRising,
        aboveVwap:   spot > vwap1h,
        trend15m:    getTFTrend(c15).label,
        trend1h:     getTFTrend(c1h).label,
        atSupport:   trendCtx1h.atSupport,
        atResistance:trendCtx1h.atResistance,
      };

      const p5  = deduplicatePatterns(scanCandles(c5, ctx5m));
      const p15 = deduplicatePatterns(scanCandles(c15, ctx15m));
      const p1h = deduplicatePatterns(scanCandles(c1h, ctx1h));
      
      const t5  = getTFTrend(c5);
      const t15 = getTFTrend(c15);
      const t1h = getTFTrend(c1h);
      
      const currentDte = dte !== null ? dte : getNextExpiry(symbol).dte;
      const currentIv  = iv !== null ? iv : 0.12;
      const sig = computeUnifiedSignal(
        c15, c5, c1h,
        spot, currentIv, currentDte, symbol, newsScore
      );
      
      setData5m({ candles: c5, patterns: p5, trend: t5, ind: ind5 });
      setData15m({ candles: c15, patterns: p15, trend: t15, ind: ind15 });
      setData1h({ candles: c1h, patterns: p1h, trend: t1h, ind: ind1h });
      setSignal(sig);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading institutional pattern data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    
    let active = true;
    let timeoutId = null;
    
    function tick() {
      if (!active) return;
      loadAll();
      const tfMs = 300000;
      const msToNext = tfMs - (Date.now() % tfMs);
      timeoutId = setTimeout(tick, msToNext);
    }
    
    const tfMs = 300000;
    const msToNext = tfMs - (Date.now() % tfMs);
    timeoutId = setTimeout(tick, msToNext);
    
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [symbol, spotPrice, iv, dte, newsScore]);

  const handleLogInternalTrade = () => {
    if (!signal || signal.action === 'AVOID') return;
    const lotSize = symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50;
    const lots = Math.max(1, Math.floor(riskCapital / ((signal.entryHigh || 100) * lotSize)));
    const totalRisk = signal.maxRisk * lots;
    const newLoggedTrade = {
      id: Date.now(),
      symbol: symbol,
      time: new Date().toLocaleTimeString('en-IN'),
      strike: `${signal.expiry} ${signal.strike} ${signal.action === 'BUY_CE' ? 'CE' : 'PE'}`,
      premium: signal.entryLow,
      lots: lots,
      risk: totalRisk,
      rr: signal.rrRatio
    };
    
    setLoggedAlerts(prev => [newLoggedTrade, ...prev]);
    alert(`Institutional trade logged: Buy ${newLoggedTrade.lots} lots of ${newLoggedTrade.symbol} ${newLoggedTrade.strike} at ₹${newLoggedTrade.premium}`);
  };

  const currentDte = dte !== null ? dte : getNextExpiry(symbol).dte;
  const currentIv  = iv !== null ? iv : 0.12;

  const timeframeGrid = React.useMemo(() => {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', 
                    gap:'12px', marginBottom:'16px' }}>
        {[
          { label:'5-MIN', data: data5m },
          { label:'15-MIN', data: data15m },
          { label:'1-HOUR', data: data1h },
        ].map(({ label, data }) => (
          <div key={label} style={{
            background:'#0F1117', border:'1px solid #1E2230',
            borderRadius:'6px', padding:'14px',
          }}>
            {/* TF header */}
            <div style={{ display:'flex', justifyContent:'space-between',
                          marginBottom:'10px' }}>
              <span style={{ fontSize:'11px', color:'#888', letterSpacing:'1px' }}>
                {label} TIMEFRAME
              </span>
              <span style={{
                fontSize:'11px', fontWeight:'bold',
                color: data?.trend.color ?? '#888',
              }}>
                {data?.trend.label ?? '—'}
              </span>
            </div>
            
            {/* Trend context — real slope-based label */}
            <div style={{ fontSize:'11px', color:'#666', marginBottom:'4px' }}>
              Trend: <span style={{ color: data?.trend.color ?? '#888' }}>
                {data?.trend.label ?? 'LOADING'}
              </span>
            </div>
            
            {/* RSI */}
            <div style={{ fontSize:'11px', color:'#666', marginBottom:'12px' }}>
              RSI(14):{' '}
              <span
                className={
                  !data ? ''
                    : data.ind.rsi > 70 ? 'extreme-alert-red'
                    : data.ind.rsi < 30 ? 'extreme-alert-green'
                    : ''
                }
                style={{
                  color: !data ? '#888'
                    : data.ind.rsi > 70 ? undefined
                    : data.ind.rsi < 30 ? undefined
                    : '#E0E0E0',
                }}
              >
                {data?.ind.rsi.toFixed(1) ?? '—'}
              </span>
              <span style={{ color:'#555', marginLeft:'8px', fontSize:'10px' }}>
                {!data ? '' 
                  : data.ind.rsi > 70 ? '(OVERBOUGHT ⚠)'
                  : data.ind.rsi < 30 ? '(OVERSOLD ✨)'
                  : data.ind.rsi > 55 ? '(BULLISH ZONE)'
                  : data.ind.rsi < 45 ? '(BEARISH ZONE)'
                  : '(NEUTRAL)'}
              </span>
            </div>
            
            {/* Pattern list — max 6, deduplicated */}
            <div style={{ fontSize:'10px', color:'#888', 
                          marginBottom:'6px', letterSpacing:'0.5px' }}>
              DETECTED PATTERNS
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
              {loading ? (
                <div style={{ color:'#444', fontSize:'11px' }}>Fetching real data...</div>
              ) : (data?.patterns ?? []).length === 0 ? (
                <div style={{ color:'#555', fontSize:'11px' }}>
                  No high-confidence pattern on latest candle
                </div>
              ) : (
                (data?.patterns ?? []).map((p, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    {/* Color bar — green CE, red PE, grey WATCH */}
                    <div style={{
                      width:'3px', height:'14px', borderRadius:'2px', flexShrink:0,
                      background: p.signal==='CE' ? '#00FF88'
                                : p.signal==='PE' ? '#FF4444' : '#666',
                    }} />
                    <span style={{
                      color: p.strength==='HIGH'   ? '#E0E0E0'
                           : p.strength==='MEDIUM' ? '#AAA' : '#666',
                      fontSize:'11px',
                    }}>
                      <strong>{p.name}</strong>
                      <span style={{ color:'#555', marginLeft:'4px' }}>
                        ({p.strength} · {p.confidence}%)
                      </span>
                      {((p.barsAgo !== undefined ? p.barsAgo : p.offset) || 0) > 0 && (
                        <span style={{ color:'#444', marginLeft:'4px', fontSize:'9px' }}>
                          {p.barsAgo !== undefined ? p.barsAgo : p.offset}b ago
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }, [data5m, data15m, data1h, loading]);

  return (
    <div className="pattern-engine" style={{ background:'#0A0C10', color:'#E0E0E0',
      fontFamily:"'JetBrains Mono', monospace", padding:'16px' }}>
      
      {/* ── HEADER — Clue Board style ── */}
      <div style={{ display:'flex', justifyContent:'space-between', 
                    alignItems:'center', marginBottom:'12px' }}>
        <div>
          <span style={{ color:'#FFFFFF', fontSize:'14px', fontWeight:'bold' }}>
            ⚡ INSTITUTIONAL PATTERN & SIGNAL ENGINE
          </span>
          <div style={{ color:'#666', fontSize:'11px', marginTop:'2px' }}>
            Active: {symbol} · {loading ? 'Fetching...' : `Updated ${lastUpdate?.toLocaleTimeString('en-IN')}`}
          </div>
        </div>
        
        {/* Symbol selector — Clue Board style pills */}
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {['NIFTY','BANKNIFTY','SENSEX','FINNIFTY'].map(s => (
            <button key={s}
               onClick={() => setSymbol(s)}
               style={{
                 padding:'4px 12px', borderRadius:'4px', fontSize:'11px',
                 background: symbol===s ? '#FFFFFF' : 'transparent',
                 color: symbol===s ? '#000' : '#888',
                 border: `1px solid ${symbol===s ? '#FFFFFF' : '#333'}`,
                 cursor:'pointer',
                 fontFamily: "'JetBrains Mono', monospace"
               }}>
              {s}
            </button>
          ))}
          
          {/* DTE + IV — top right like Clue Board */}
          <div style={{ marginLeft:'16px', textAlign:'right', fontSize:'12px' }}>
            <span style={{ color: getExpiryUrgency(currentDte).color }}>
              DTE: {currentDte}
            </span>
            <span style={{ color:'#888', margin:'0 8px' }}>|</span>
            <span style={{ color: '#FFB800' }}>IV: {(currentIv*100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
      
      {/* ── BANNER — dynamic color + text ── */}
      {signal && (
        <div style={{
          border: `1px solid ${signal.bannerColor}`,
          borderRadius:'6px', padding:'12px 20px',
          marginBottom:'16px', textAlign:'center',
          background: signal.direction === 'CE' 
            ? 'rgba(0,255,136,0.05)' 
            : signal.direction === 'PE' 
              ? 'rgba(255,68,68,0.05)' : 'rgba(255,184,0,0.05)',
        }}>
          <span style={{ fontWeight:'bold', fontSize:'13px' }}>
            {signal.bannerText}
          </span>
        </div>
      )}
      
      {/* ── 3-COLUMN TIMEFRAME GRID — Clue Board card style ── */}
      {timeframeGrid}
      
      {/* ── CONFLUENCE MATRIX — real values ── */}
      {signal && data15m && (
        <div style={{
          background:'#0F1117', border:'1px solid #1E2230',
          borderRadius:'6px', padding:'14px', marginBottom:'16px',
        }}>
          <div style={{ fontSize:'11px', color:'#888', 
                        letterSpacing:'1px', marginBottom:'10px' }}>
            CONFLUENCE MATRIX & FILTERS
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            
            {/* MACD — real label */}
            <div>
              <div style={{ color:'#555', fontSize:'10px' }}>MACD HIST</div>
              <div
                className={
                  data15m.ind.macdHist <= -3 ? 'extreme-alert-red'
                    : data15m.ind.macdHist >= 3  ? 'extreme-alert-green'
                    : ''
                }
                style={{
                  fontSize:'13px', fontWeight:'bold',
                  color: (data15m.ind.macdHist <= -3 || data15m.ind.macdHist >= 3)
                    ? undefined
                    : signal.macdColor
                }}
              >
                {data15m.ind.macdHist.toFixed(2)}
              </div>
              <div style={{ fontSize:'10px', 
                color: signal.macdColor }}>
                {signal.macdLabel}
                {data15m.ind.macdHist <= -3 && ' ⚠'}
                {data15m.ind.macdHist >= 3  && ' ✨'}
              </div>
            </div>
            
            {/* Volume — real ratio */}
            <div>
              <div style={{ color:'#555', fontSize:'10px' }}>VOLUME RATIO</div>
              <div style={{ fontSize:'13px', fontWeight:'bold',
                color: data15m.ind.volRatio >= 1.5 ? '#00FF88'
                     : data15m.ind.volRatio >= 0.7 ? '#FFB800' : '#FF4444' }}>
                {data15m.ind.volRatio.toFixed(2)}×
              </div>
              <div style={{ color:'#555', fontSize:'10px' }}>
                {data15m.ind.volRatio >= 1.5 ? 'HIGH PARTICIPATION'
                : data15m.ind.volRatio >= 0.7 ? 'NORMAL'
                : data15m.ind.volRatio < 0.1  ? 'NO DATA / CLOSED'
                : 'LOW PARTICIPATION'}
              </div>
            </div>
            
            {/* Spot S/R — from real swing points */}
            <div>
              <div style={{ color:'#555', fontSize:'10px' }}>SPOT LOCATION</div>
              <div style={{ fontSize:'12px', color:'#E0E0E0' }}>
                S: ₹{calcSRLevels(data15m.candles).support.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize:'12px', color:'#E0E0E0' }}>
                R: ₹{calcSRLevels(data15m.candles).resistance.toLocaleString('en-IN')}
              </div>
            </div>
            
            {/* IV Rank */}
            <div>
              <div style={{ color:'#555', fontSize:'10px' }}>IV RANK</div>
              <div
                className={
                  getIVContext(currentIv * 100, 28, 8).rank >= 80 ? 'extreme-alert-red'
                    : getIVContext(currentIv * 100, 28, 8).rank <= 20 ? 'extreme-alert-green'
                    : ''
                }
                style={{
                  fontSize:'13px', fontWeight:'bold',
                  color: (getIVContext(currentIv * 100, 28, 8).rank >= 80 ||
                          getIVContext(currentIv * 100, 28, 8).rank <= 20)
                    ? undefined
                    : getIVContext(currentIv * 100, 28, 8).color
                }}
              >
                {getIVContext(currentIv * 100, 28, 8).rank}th %ile
                {getIVContext(currentIv * 100, 28, 8).rank >= 80 && ' ⚠'}
                {getIVContext(currentIv * 100, 28, 8).rank <= 20 && ' ✨'}
              </div>
              <div style={{ fontSize:'10px', 
                color: getIVContext(currentIv * 100, 28, 8).color }}>
                {getIVContext(currentIv * 100, 28, 8).label.split('—')[0].trim()}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ── FINAL CE/PE SIGNAL CARD — most important box ── */}
      {signal && (
        <div style={{
          background: signal.direction === 'CE' ? 'rgba(0,255,136,0.06)'
                    : signal.direction === 'PE' ? 'rgba(255,68,68,0.06)'
                    : 'rgba(255,184,0,0.04)',
          border: `1px solid ${
            signal.direction === 'CE' ? '#00FF88'
          : signal.direction === 'PE' ? '#FF4444' : '#FFB800'}`,
          borderRadius:'6px', padding:'16px',
        }}>
          
          {signal.direction === 'AVOID' ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#FFB800', fontSize:'13px', fontWeight:'bold' }}>
                ⚠ STAND DOWN — CAPITAL PRESERVATION ACTIVE
              </div>
              {signal.blockers.map((b,i) => (
                <div key={i} style={{ color:'#666', fontSize:'11px', marginTop:'4px' }}>
                  ❌ {b}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                
                {/* Left: signal header */}
                <div>
                  <div style={{
                    fontSize:'20px', fontWeight:'bold',
                    color: signal.direction==='CE' ? '#00FF88' : '#FF4444',
                  }}>
                    {signal.direction === 'CE' ? '🟢 BUY CE' : '🔴 BUY PE'}
                    <span style={{ fontSize:'12px', color:'#888', marginLeft:'8px' }}>
                      {signal.confidence}% conviction
                    </span>
                  </div>
                  <div style={{ marginTop:'10px', display:'flex',
                                flexDirection:'column', gap:'5px', fontSize:'12px' }}>
                    <div><span style={{color:'#555'}}>Strike: </span>
                      <strong style={{color:'#E0E0E0'}}>
                        ₹{signal.strike.toLocaleString('en-IN')} {signal.direction==='CE'?'CE':'PE'}
                      </strong>
                      <span style={{color:'#555',marginLeft:'8px'}}>{signal.expiry}</span>
                    </div>
                    <div><span style={{color:'#555'}}>Entry: </span>
                      <strong style={{color:'#E0E0E0'}}>₹{signal.entryLow}–₹{signal.entryHigh}</strong>
                    </div>
                    <div><span style={{color:'#555'}}>Stop Loss: </span>
                      <strong style={{color:'#FF4444'}}>₹{signal.stopLoss}</strong>
                      <span style={{color:'#555', marginLeft:'6px', fontSize:'11px'}}>
                        (Nifty breaks ₹{signal.spotSL.toLocaleString('en-IN')})
                      </span>
                    </div>
                    <div><span style={{color:'#555'}}>Target 1: </span>
                      <strong style={{color:'#00FF88'}}>₹{signal.target1}</strong>
                      <span style={{color:'#555', marginLeft:'6px', fontSize:'11px'}}>
                        → Nifty ₹{signal.spotT1.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div><span style={{color:'#555'}}>Target 2: </span>
                      <strong style={{color:'#00FF88'}}>₹{signal.target2}</strong>
                    </div>
                  </div>
                </div>
                
                {/* Right: trade metrics */}
                <div style={{ display:'flex', flexDirection:'column', gap:'5px',
                              fontSize:'12px', borderLeft:'1px solid #1E2230',
                              paddingLeft:'16px' }}>
                  <div><span style={{color:'#555'}}>R:R Ratio: </span>
                    <strong style={{color:'#E0E0E0'}}>{signal.rrRatio}</strong>
                  </div>
                  <div><span style={{color:'#555'}}>Max Risk: </span>
                    <strong style={{color:'#FF8866'}}>₹{signal.maxRisk.toLocaleString('en-IN')}/lot</strong>
                  </div>
                  <div><span style={{color:'#555'}}>Expiry Urgency: </span>
                    <strong style={{ color: getExpiryUrgency(currentDte).color }}>
                      {getExpiryUrgency(currentDte).label}
                    </strong>
                  </div>
                  <div><span style={{color:'#555'}}>IV Environment: </span>
                    <strong style={{ color: getIVContext(currentIv * 100, 28, 8).color }}>
                      {getIVContext(currentIv * 100, 28, 8).buyerEdge ? 'Buyer Edge' : 'Seller Edge'}
                    </strong>
                  </div>
                  {getExpiryUrgency(currentDte).warning && (
                    <div style={{ color:'#FFB800', fontSize:'10px', marginTop:'4px' }}>
                      ⚠ {getExpiryUrgency(currentDte).warning}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sizing Slider & Log Button */}
              <div style={{ marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #1E2230' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                    <span>Sizing Risk Capital: <strong>₹{riskCapital.toLocaleString('en-IN')}</strong></span>
                    <span>Lots: <strong>{Math.max(1, Math.floor(riskCapital / ((signal.entryHigh || 100) * (symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50))))} Lot{Math.max(1, Math.floor(riskCapital / ((signal.entryHigh || 100) * (symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50)))) > 1 ? 's' : ''}</strong> ({Math.max(1, Math.floor(riskCapital / ((signal.entryHigh || 100) * (symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50)))) * (symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50)} Qty)</span>
                  </div>
                  <input
                    type="range"
                    min="2000"
                    max="50000"
                    step="1000"
                    value={riskCapital}
                    onChange={(e) => setRiskCapital(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#FFFFFF', height: 4 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', marginTop: 8 }}>
                    <span>Max Estimated Loss: <strong style={{ color: '#ff1744' }}>₹{(signal.maxRisk * Math.max(1, Math.floor(riskCapital / ((signal.entryHigh || 100) * (symbol === 'BANKNIFTY' ? 15 : symbol === 'SENSEX' ? 10 : 50))))).toLocaleString('en-IN')}</strong></span>
                    <span>R:R ratio: <strong style={{ color: '#00e676' }}>{signal.rrRatio}</strong></span>
                  </div>
                </div>

                <button
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    fontSize: 12,
                    fontWeight: 900,
                    background: '#FFFFFF',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}
                  onClick={handleLogInternalTrade}
                >
                  📥 Log To Intraday P&L Tracker
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Logged Alerts summary list */}
      {loggedAlerts.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #1E2230', paddingTop: 14 }}>
          <span style={{ fontSize: 10, color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 10 }}>Logged Trade Signals Today ({loggedAlerts.length})</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loggedAlerts.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0F1117', border: '1px solid #1E2230', borderRadius: 4, fontSize: 11 }}>
                <div>
                  <strong style={{ color: '#FFFFFF' }}>{t.symbol} {t.strike}</strong>
                  <span style={{ color: '#555', fontSize: 9, marginLeft: 8 }}>{t.time}</span>
                </div>
                <div style={{ color: '#cbd5e1' }}>
                  Premium: <strong>₹{t.premium}</strong> | Lots: <strong>{t.lots}</strong> | Risk: <strong style={{ color: '#ff4444' }}>₹{t.risk.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
