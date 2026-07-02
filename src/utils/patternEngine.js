// ── INSTITUTIONAL-GRADE CANDLESTICK PATTERN RECOGNITION ENGINE ──────────────
// Standalone utility module for pattern detection, confirmation, and strike selection

export const EXPIRY_DAYS = {
  'NIFTY':      2,  // Tuesday
  'BANKNIFTY':  3,  // Wednesday
  'FINNIFTY':   2,  // Tuesday
  'MIDCPNIFTY': 1,  // Monday
  'SENSEX':     4,  // Thursday (BSE)
  'BANKEX':     1,  // Monday (BSE)
};

const NSE_HOLIDAYS = new Set([
  // 2025
  '2025-01-26','2025-03-14','2025-04-14','2025-04-18',
  '2025-05-01','2025-08-15','2025-10-02','2025-10-21',
  '2025-11-05','2025-12-25',
  // 2026
  '2026-01-26','2026-03-03','2026-03-26','2026-03-31',
  '2026-04-03','2026-04-14','2026-05-01','2026-05-28',
  '2026-06-26','2026-09-14','2026-10-02','2026-10-20',
  '2026-11-10','2026-11-24','2026-12-25'
]);

export function getNextExpiry(instrument) {
  const cleanInst = instrument.toUpperCase().replace('.NS', '').replace('.BO', '').replace('^', '');
  let expiryDay = 2; // Default to Tuesday (Nifty)
  if (cleanInst.includes('BANKNIFTY')) {
    expiryDay = 3;
  } else if (cleanInst.includes('MIDCPNIFTY') || cleanInst.includes('NSEMDCP50') || cleanInst.includes('NIFTYMID50')) {
    expiryDay = 1;
  } else if (cleanInst.includes('SENSEX') || cleanInst.includes('BSESN')) {
    expiryDay = 4;
  } else if (cleanInst.includes('BANKEX')) {
    expiryDay = 1;
  } else if (cleanInst.includes('FINNIFTY') || cleanInst.includes('NIFTY_FIN_SERVICE')) {
    expiryDay = 2;
  } else if (cleanInst.includes('NIFTY') || cleanInst.includes('NSEI')) {
    expiryDay = 2;
  } else {
    expiryDay = EXPIRY_DAYS[cleanInst] ?? 2; // Fallback to Tuesday
  }

  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  let daysUntil = (expiryDay - todayDay + 7) % 7;

  if (daysUntil === 0) {
    const nowIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const marketClose = new Date(nowIST);
    marketClose.setHours(15, 30, 0, 0);
    if (nowIST > marketClose) {
      daysUntil = 7;
    }
  }

  let expDate = new Date(today.getTime() + daysUntil * 24 * 60 * 60 * 1000);

  // If expiry falls on a holiday or weekend, shift to preceding trading day
  while (true) {
    const dateStr = expDate.toISOString().slice(0, 10);
    const day = expDate.getDay();
    if (day === 0) {
      expDate.setDate(expDate.getDate() - 2); // Sun -> Fri
    } else if (day === 6) {
      expDate.setDate(expDate.getDate() - 1); // Sat -> Fri
    } else if (NSE_HOLIDAYS.has(dateStr)) {
      expDate.setDate(expDate.getDate() - 1);
    } else {
      break;
    }
  }

  const oneDay = 24 * 60 * 60 * 1000;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const dte = Math.round((expMidnight - todayMidnight) / oneDay);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayStr = String(expDate.getDate()).padStart(2, '0');
  const monthStr = months[expDate.getMonth()];
  const yearStr = expDate.getFullYear();
  const label = `${dayStr}-${monthStr}-${yearStr}`;

  return { date: expDate, dte: Math.max(0, dte), label };
}

export function verifyCandleOrder(candles) {
  if (candles.length < 2) return true;
  const first = candles[0].time;
  const last  = candles[candles.length - 1].time;
  
  if (first > last) {
    console.error('CANDLE ARRAY IS REVERSED — newest first, expected oldest first');
    return false;
  }
  return true;
}

export function ensureChronological(candles) {
  return [...candles].sort((a, b) => {
    const tA = a.time ? String(a.time) : '';
    const tB = b.time ? String(b.time) : '';
    return tA.localeCompare(tB);
  });
}

export function calculateRealTrend(rawCandles) {
  const candles = ensureChronological(rawCandles);
  
  if (candles.length < 5) {
    return { direction: 'SIDEWAYS', signal: 'WATCH', label: 'INSUFFICIENT DATA',
      score: 0, slope: 0, details: '< 5 candles' };
  }
  
  const slice = candles.slice(-Math.min(20, candles.length));
  const n     = slice.length;
  
  const firstClose = slice[0].close;
  const lastClose  = slice[n-1].close;
  const priceChangePct = ((lastClose - firstClose) / (firstClose || 1)) * 100;
  
  const closes = slice.map(c => c.close);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += closes[i];
    sumXY += i * closes[i];
    sumX2 += i * i;
  }
  const denominator = (n * sumX2 - sumX * sumX);
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const slopePct = closes[0] !== 0 ? (slope / closes[0]) * 100 : 0;
  
  let bullCount = 0, bearCount = 0;
  let bullVolume = 0, bearVolume = 0;
  slice.forEach(c => {
    if (c.close > c.open) { bullCount++; bullVolume += (c.volume || 0); }
    else if (c.close < c.open) { bearCount++; bearVolume += (c.volume || 0); }
  });
  const candleRatio = (bullCount - bearCount) / n;
  
  const swingHighs = [];
  const swingLows  = [];
  
  for (let i = 2; i < n - 2; i++) {
    const c = slice[i];
    if (c.high > slice[i-1].high && c.high > slice[i-2].high &&
        c.high > slice[i+1].high && c.high > slice[i+2].high) {
      swingHighs.push({ idx: i, price: c.high });
    }
    if (c.low < slice[i-1].low && c.low < slice[i-2].low &&
        c.low < slice[i+1].low && c.low < slice[i+2].low) {
      swingLows.push({ idx: i, price: c.low });
    }
  }
  
  swingHighs.sort((a,b) => a.idx - b.idx);
  swingLows.sort((a,b) => a.idx - b.idx);
  
  let structureScore = 0;
  if (swingHighs.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length-1].price;
    const prevHigh = swingHighs[swingHighs.length-2].price;
    if (lastHigh > prevHigh) structureScore += 1;
    if (lastHigh < prevHigh) structureScore -= 1;
  }
  if (swingLows.length >= 2) {
    const lastLow = swingLows[swingLows.length-1].price;
    const prevLow = swingLows[swingLows.length-2].price;
    if (lastLow > prevLow) structureScore += 1;
    if (lastLow < prevLow) structureScore -= 1;
  }
  
  const recentHigh = Math.max(...slice.map(c => c.high));
  const recentLow  = Math.min(...slice.map(c => c.low));
  const range = recentHigh - recentLow;
  const positionInRange = range > 0 
    ? (lastClose - recentLow) / range
    : 0.5;
  
  let score = 0;
  
  if      (priceChangePct >  0.5)  score += 3;
  else if (priceChangePct >  0.2)  score += 2;
  else if (priceChangePct >  0.05) score += 1;
  else if (priceChangePct > -0.05) score += 0;
  else if (priceChangePct > -0.2)  score -= 1;
  else if (priceChangePct > -0.5)  score -= 2;
  else                              score -= 3;
  
  if      (slopePct >  0.05) score += 2;
  else if (slopePct >  0.01) score += 1;
  else if (slopePct > -0.01) score += 0;
  else if (slopePct > -0.05) score -= 1;
  else                        score -= 2;
  
  if      (candleRatio >  0.4)  score += 3;
  else if (candleRatio >  0.15) score += 2;
  else if (candleRatio >  0)    score += 1;
  else if (candleRatio === 0)   score += 0;
  else if (candleRatio > -0.15) score -= 1;
  else if (candleRatio > -0.4)  score -= 2;
  else                            score -= 3;
  
  score += structureScore;
  
  if      (positionInRange > 0.7) score += 1;
  else if (positionInRange < 0.3) score -= 1;
  
  let direction;
  let label;
  let signal;

  // SIDEWAYS band: score must be exactly -1, 0, or +1 to stay neutral.
  // Score >= 2 → UP/CE; score <= -2 → DOWN/PE. A single net bearish session
  // (score -2) will now correctly fire a PE signal instead of AVOID.
  if      (score >= 6)  { direction = 'UP';       label = 'STRONG UPTREND';   signal = 'CE';   }
  else if (score >= 3)  { direction = 'UP';       label = 'UPTREND';          signal = 'CE';   }
  else if (score >= 2)  { direction = 'UP';       label = 'SLIGHT UPTREND';   signal = 'CE';   }
  else if (score >= -1) { direction = 'SIDEWAYS'; label = 'SIDEWAYS';         signal = 'WATCH';}
  else if (score >= -5) { direction = 'DOWN';     label = 'DOWNTREND';        signal = 'PE';   }
  else if (score >= -6) { direction = 'DOWN';     label = 'STRONG DOWNTREND'; signal = 'PE';   }
  else                  { direction = 'DOWN';     label = 'STRONG DOWNTREND'; signal = 'PE';   }
  
  return {
    direction, signal, label, score, slope: slopePct,
    details: `priceChg:${priceChangePct.toFixed(2)}% slope:${slopePct.toFixed(3)}% `+
             `candles:${bullCount}🟢/${bearCount}🔴 struct:${structureScore} pos:${positionInRange.toFixed(2)}`,
  };
}

export function detectTrend(candles, period = 10) {
  if (!candles || candles.length < period) return 'SIDEWAYS';
  const sliced = candles.slice(-period);
  const result = calculateRealTrend(sliced);
  return result.direction;
}

export function calculateATR(candles, period = 14) {
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

export function adaptiveThresholds(candles) {
  const atr = calculateATR(candles, 14);
  return {
    atr,
    minBodySize: atr * 0.15,
    minWickSize: atr * 0.40
  };
}

export function getPatternDisplay(candles) {
  if (!candles || candles.length === 0) return "No data";
  const trend = detectTrend(candles);
  const last = candles[candles.length - 1];
  const bodySize = Math.abs(last.close - last.open);
  const atr = calculateATR(candles, 14);

  if (trend === 'UP') {
    if (bodySize > atr * 0.8) {
      return "Bullish expansion";
    } else {
      return "Bullish trend consolidation";
    }
  } else if (trend === 'DOWN') {
    if (bodySize > atr * 0.8) {
      return "Bearish expansion";
    } else {
      return "Bearish trend consolidation";
    }
  } else {
    if (bodySize > atr * 1.2) {
      return "High volatility breakout attempt";
    } else {
      return "Neutral range consolidation";
    }
  }
}

export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 50;
  const closes = candles.map(c => c.close);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
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

function getStructureReading(candles) {
  const c = candles[candles.length - 1];
  const trend = detectTrend(candles);
  const rsi = calculateRSI(candles, 14);
  const r = c.high - c.low;
  const bodySize = Math.abs(c.close - c.open);
  const bodyPct = r > 0 ? Math.round(bodySize / r * 100) : 0;
  const bullish = c.close >= c.open;

  const watchFor = trend === 'DOWN' && rsi < 40
    ? 'Hammer or Bullish Engulfing for CE entry'
    : trend === 'UP' && rsi > 60
    ? 'Shooting Star or Bearish Engulfing for PE entry'
    : 'Inside Bar breakout or Marubozu for directional trade';

  let name = bodyPct === 0 ? 'Doji' : `${bullish ? 'Bullish' : 'Bearish'} Candle (${bodyPct}% body)`;
  if (bodySize <= r * 0.08) {
    name = "Doji (Indecision)";
  }

  return {
    name: name,
    type: 'INDECISION',
    signal: 'WATCH',
    strength: 'LOW',
    confidence: 30,
    candlesUsed: 1,
    requiresTrendContext: false,
    trendBoost: false,
    trendWarning: false,
    description:
      `${trend} structure | RSI ${rsi.toFixed(0)} | Watch for: ${watchFor}`
  };
}

export function calcSRLevels(candles) {
  if (!candles || candles.length === 0) return { support: 0, resistance: 0 };
  const slice = candles.slice(-20);
  const swingHighs = slice
    .filter((c,i,a) => i>0 && i<a.length-1 && c.high>a[i-1].high && c.high>a[i+1].high)
    .map(c => c.high);
  const sliceLows = slice
    .filter((c,i,a) => i>0 && i<a.length-1 && c.low<a[i-1].low && c.low<a[i+1].low)
    .map(c => c.low);
  const spot = candles[candles.length-1].close;
  
  const validLows = sliceLows.filter(l => l < spot);
  const validHighs = swingHighs.filter(h => h > spot);
  
  const support    = validLows.length > 0 ? Math.max(...validLows) : spot * 0.995;
  const resistance = validHighs.length > 0 ? Math.min(...validHighs) : spot * 1.005;
  return { support: Math.round(support), resistance: Math.round(resistance) };
}

export function buildTrendContext(candles) {
  const direction = detectTrend(candles);
  const sr = calcSRLevels(candles);
  const spot = candles[candles.length - 1]?.close || 0;
  const atSupport = Math.abs(spot - sr.support) / spot <= 0.005; // 0.5% threshold
  const atResistance = Math.abs(spot - sr.resistance) / spot <= 0.005; // 0.5% threshold
  return {
    direction,
    atSupport,
    atResistance
  };
}

export function calculateVWAP(candles) {
  let totalVolumePrice = 0;
  let totalVolume = 0;
  let totalPrice = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    totalVolumePrice += typicalPrice * (c.volume || 1);
    totalVolume += (c.volume || 1);
    totalPrice += typicalPrice;
  }
  return totalVolume > 0 ? (totalVolumePrice / totalVolume) : (totalPrice / candles.length);
}

export const PATTERN_RELIABILITY = {
  'Bullish Kicker':          92, 'Bearish Kicker':          93,
  'Morning Doji Star':       88, 'Evening Doji Star':        88,
  'Three White Soldiers':    87, 'Three Black Crows':        87,
  'Abandoned Baby (Bull)':   89, 'Abandoned Baby (Bear)':    89,
  'Morning Star':            85, 'Evening Star':             85,
  'Bullish Engulfing':       83, 'Bearish Engulfing':        84,
  'Three-Line Strike (Bull)':82, 'Three-Line Strike (Bear)': 82,
  'Dragonfly Doji':          80, 'Gravestone Doji':          80,
  'Bullish Marubozu':        79, 'Bearish Marubozu':         79,
  'Three Outside Up':        78, 'Three Outside Down':       78,
  'Three Inside Up':         77, 'Three Inside Down':        77,
  'Tri-Star (Bull)':         78, 'Tri-Star (Bear)':          78,
  'Bullish Mat Hold':        76, 'Bearish Mat Hold':         76,
  'Tweezer Bottom':          76, 'Tweezer Top':              76,
  'Rising Three Methods':    75, 'Falling Three Methods':    75,
  'Hammer':                  75, 'Shooting Star':            75,
  'Inverted Hammer':         68, 'Hanging Man':              65,
  'Paper Umbrella':          67, 'Piercing Line':            70,
  'Dark Cloud Cover':        71, 'Harami (Bullish)':         68,
  'Harami (Bearish)':        67, 'Harami Cross (Bull)':      72,
  'Harami Cross (Bear)':     71, 'Spinning Top (Bull)':      60,
  'Spinning Top (Bear)':     60, 'Long-Legged Doji':         58,
};

// ─────────────────────────────────────────────────────────
// NIFTY50 SPECIFIC CALIBRATION
// ─────────────────────────────────────────────────────────

const NIFTY_CALIBRATION = {
  avgBodyPts:      12,    // typical 10–15 pts body
  avgRangePts:     25,    // typical 20–30 pts high-low range
  avgBodyRatio:    0.48,  // body usually 40–55% of range
  wickMultiplier:  1.3,   // wick >= 1.3× body (not 2×)
  engulfBuffer:    0.001, // 0.1% buffer for engulfing
  dojiThreshold:   0.08,  // body <= 8% of range (not 5%)
  strongBody:      0.60,  // body >= 60% of range = strong
  minBodyPts:      3,     // at least 3 Nifty points body
  minRangePts:     8,     // at least 8 Nifty points range
};

// Helpers
const body  = (c) => Math.abs(c.close - c.open);
const range = (c) => c.high - c.low;
const uw    = (c) => c.high - Math.max(c.open, c.close);
const lw    = (c) => Math.min(c.open, c.close) - c.low;
const mid   = (c) => (c.open + c.close) / 2;
const bull  = (c) => c.close > c.open;
const bear  = (c) => c.close < c.open;
const doji  = (c) => range(c) > 0 && body(c) <= range(c) * NIFTY_CALIBRATION.dojiThreshold;
const avgVol = (candles) =>
  candles.reduce((s,c) => s+c.volume, 0) / candles.length;

function make(
  name,
  signal,
  type,
  conf,
  desc,
  barsAgo,
  price,
) {
  return {
    name, type, signal,
    baseConf:    conf,
    finalConf:   conf,
    confidence:  conf, // for frontend backward compatibility
    strength:    conf >= 80 ? 'HIGH' : conf >= 65 ? 'MEDIUM' : 'LOW',
    barsAgo, description: desc, priceLevel: price, contextBoost: 0,
  };
}

// ─────────────────────────────────────────────────────
// SECTION 1: SINGLE CANDLE (16 patterns)
// ─────────────────────────────────────────────────────

function scanSingleCandle(c, barsAgo, trend) {
  const results = [];
  const b = body(c), r = range(c), u = uw(c), l = lw(c);
  if (r < NIFTY_CALIBRATION.minRangePts) return results; // too small
  if (b < NIFTY_CALIBRATION.minBodyPts && !doji(c)) return results;

  // 1. HAMMER — long lower wick at bottom
  if (l >= b * NIFTY_CALIBRATION.wickMultiplier
      && u <= r * 0.20 && b >= NIFTY_CALIBRATION.minBodyPts) {
    const conf = l >= b*2.0 ? 80 : l >= b*1.5 ? 73 : 66;
    results.push(make('Hammer','CE','BULLISH_REVERSAL',conf,
      `Lower wick ${(l/b).toFixed(1)}× body at ₹${c.low.toFixed(0)}`,barsAgo,c.low));
  }

  // 2. INVERTED HAMMER
  if (u >= b * NIFTY_CALIBRATION.wickMultiplier
      && l <= r * 0.20 && b >= NIFTY_CALIBRATION.minBodyPts) {
    results.push(make('Inverted Hammer','CE','BULLISH_REVERSAL',66,
      `Upper wick probe — needs confirmation`,barsAgo,c.high));
  }

  // 3. DRAGONFLY DOJI — long lower wick doji
  if (doji(c) && l >= r*0.65 && u <= r*0.15) {
    results.push(make('Dragonfly Doji','CE','BULLISH_REVERSAL',79,
      `Full lower rejection at ₹${c.low.toFixed(0)}`,barsAgo,c.low));
  }

  // 4. GRAVESTONE DOJI — long upper wick doji
  if (doji(c) && u >= r*0.65 && l <= r*0.15) {
    results.push(make('Gravestone Doji','PE','BEARISH_REVERSAL',79,
      `Full upper rejection at ₹${c.high.toFixed(0)}`,barsAgo,c.high));
  }

  // 5. LONG-LEGGED DOJI
  if (doji(c) && u >= r*0.30 && l >= r*0.30) {
    results.push(make('Long-Legged Doji','WATCH','INDECISION',52,
      `Equal wicks — breakout imminent`,barsAgo,c.close));
  }

  // 6. PLAIN DOJI (standard)
  if (doji(c) && !(u >= r*0.65) && !(l >= r*0.65)) {
    results.push(make('Doji','WATCH','INDECISION',48,
      `Equilibrium — next candle direction is signal`,barsAgo,c.close));
  }

  // 7. BULLISH MARUBOZU — full green body
  if (bull(c) && b >= r*0.88 && u <= r*0.05 && l <= r*0.05) {
    results.push(make('Bullish Marubozu','CE','BULLISH_REVERSAL',82,
      `Complete buyer dominance — no wicks`,barsAgo,c.close));
  }

  // 8. BEARISH MARUBOZU — full red body
  if (bear(c) && b >= r*0.88 && u <= r*0.05 && l <= r*0.05) {
    results.push(make('Bearish Marubozu','PE','BEARISH_REVERSAL',82,
      `Complete seller dominance — no wicks`,barsAgo,c.close));
  }

  // 9. SHOOTING STAR — long upper wick at top
  if (u >= b * NIFTY_CALIBRATION.wickMultiplier
      && l <= r*0.20 && b >= NIFTY_CALIBRATION.minBodyPts
      && (trend === 'UP' || trend === 'SLIGHT_UP')) {
    const conf = u >= b*2.0 ? 82 : u >= b*1.5 ? 74 : 67;
    results.push(make('Shooting Star','PE','BEARISH_REVERSAL',conf,
      `Upper wick ${(u/b).toFixed(1)}× body at ₹${c.high.toFixed(0)}`,barsAgo,c.high));
  }

  // 10. HANGING MAN — hammer shape in uptrend
  if (l >= b * NIFTY_CALIBRATION.wickMultiplier
      && u <= r*0.20 && b >= NIFTY_CALIBRATION.minBodyPts
      && (trend === 'UP' || trend === 'SLIGHT_UP')) {
    results.push(make('Hanging Man','PE','BEARISH_REVERSAL',66,
      `Long lower wick in uptrend — selling appeared`,barsAgo,c.close));
  }

  // 11. PAPER UMBRELLA (hammer at support)
  if (l >= b*1.3 && u <= r*0.20 && b >= NIFTY_CALIBRATION.minBodyPts
      && (trend === 'DOWN' || trend === 'SLIGHT_DOWN')) {
    results.push(make('Paper Umbrella','CE','BULLISH_REVERSAL',70,
      `Hammer at potential support ₹${c.low.toFixed(0)}`,barsAgo,c.low));
  }

  // 12. BULLISH BELT HOLD — opens at low, closes near high
  if (bull(c) && l <= r*0.02 && b >= r*0.70) {
    results.push(make('Bullish Belt Hold','CE','BULLISH_REVERSAL',72,
      `Opened at session low, closed high`,barsAgo,c.open));
  }

  // 13. BEARISH BELT HOLD — opens at high, closes near low
  if (bear(c) && u <= r*0.02 && b >= r*0.70) {
    results.push(make('Bearish Belt Hold','PE','BEARISH_REVERSAL',72,
      `Opened at session high, closed low`,barsAgo,c.open));
  }

  // 14. SPINNING TOP (bull context)
  if (b >= r*0.10 && b <= r*0.35 && u >= r*0.22 && l >= r*0.22
      && (trend === 'DOWN' || trend === 'SLIGHT_DOWN')) {
    results.push(make('Spinning Top (Bull)','CE','BULLISH_REVERSAL',58,
      `Indecision after downtrend`,barsAgo,c.close));
  }

  // 15. SPINNING TOP (bear context)
  if (b >= r*0.10 && b <= r*0.35 && u >= r*0.22 && l >= r*0.22
      && (trend === 'UP' || trend === 'SLIGHT_UP')) {
    results.push(make('Spinning Top (Bear)','PE','BEARISH_REVERSAL',58,
      `Indecision after uptrend`,barsAgo,c.close));
  }

  // 16. HIGH WAVE CANDLE — very long wicks both sides
  if (u >= r*0.35 && l >= r*0.35 && b <= r*0.30) {
    results.push(make('High Wave Candle','WATCH','INDECISION',50,
      `Extreme indecision — very high uncertainty`,barsAgo,c.close));
  }

  return results;
}

// ─────────────────────────────────────────────────────
// SECTION 2: TWO-CANDLE PATTERNS (18 patterns)
// ─────────────────────────────────────────────────────

function scanTwoCandle(p, c, barsAgo) {
  const results = [];
  const pb = body(p), cb = body(c), pr = range(p), cr = range(c);
  const tol = Math.max(pr, cr) * 0.002; // 0.2% tolerance for Nifty
  const volSurge = c.volume > p.volume * 1.15;

  // 1. BULLISH ENGULFING
  if (bear(p) && bull(c)
      && c.open <= p.close + tol
      && c.close >= p.open - tol
      && cb >= pb * 0.85) {
    const conf = volSurge ? 88 : cb >= pb*1.1 ? 82 : 75;
    results.push(make('Bullish Engulfing','CE','BULLISH_REVERSAL',conf,
      `Green body wraps red${volSurge?' + volume surge':''}`,barsAgo,c.close));
  }

  // 2. BEARISH ENGULFING
  if (bull(p) && bear(c)
      && c.open >= p.close - tol
      && c.close <= p.open + tol
      && cb >= pb * 0.85) {
    const conf = volSurge ? 88 : cb >= pb*1.1 ? 83 : 76;
    results.push(make('Bearish Engulfing','PE','BEARISH_REVERSAL',conf,
      `Red body wraps green${volSurge?' + volume surge':''}`,barsAgo,c.close));
  }

  // 3. PIERCING LINE
  if (bear(p) && bull(c)
      && c.open < p.low
      && c.close > mid(p) && c.close < p.open) {
    results.push(make('Piercing Line','CE','BULLISH_REVERSAL',72,
      `Closes above midpoint of prior red`,barsAgo,c.close));
  }

  // 4. DARK CLOUD COVER
  if (bull(p) && bear(c)
      && c.open > p.high
      && c.close < mid(p) && c.close > p.open) {
    results.push(make('Dark Cloud Cover','PE','BEARISH_REVERSAL',73,
      `Opens above prior high, closes below midpoint`,barsAgo,c.close));
  }

  // 5. TWEEZER BOTTOM
  if (Math.abs(p.low - c.low) <= tol && bear(p) && bull(c)) {
    results.push(make('Tweezer Bottom','CE','BULLISH_REVERSAL',76,
      `Double support at ₹${p.low.toFixed(0)}`,barsAgo,p.low));
  }

  // 6. TWEEZER TOP
  if (Math.abs(p.high - c.high) <= tol && bull(p) && bear(c)) {
    results.push(make('Tweezer Top','PE','BEARISH_REVERSAL',76,
      `Double resistance at ₹${p.high.toFixed(0)}`,barsAgo,p.high));
  }

  // 7. BULLISH HARAMI
  if (bear(p) && bull(c)
      && c.open > p.close && c.close < p.open
      && cb < pb * 0.55) {
    results.push(make('Harami (Bullish)','CE','BULLISH_REVERSAL',68,
      `Small bull inside large bear`,barsAgo,c.close));
  }

  // 8. BEARISH HARAMI
  if (bull(p) && bear(c)
      && c.open < p.close && c.close > p.open
      && cb < pb * 0.55) {
    results.push(make('Harami (Bearish)','PE','BEARISH_REVERSAL',67,
      `Small bear inside large bull`,barsAgo,c.close));
  }

  // 9. BULLISH HARAMI CROSS
  if (bear(p) && doji(c)
      && c.close > p.close && c.close < p.open) {
    results.push(make('Harami Cross (Bull)','CE','BULLISH_REVERSAL',74,
      `Doji inside prior bearish body`,barsAgo,c.close));
  }

  // 10. BEARISH HARAMI CROSS
  if (bull(p) && doji(c)
      && c.close < p.close && c.close > p.open) {
    results.push(make('Harami Cross (Bear)','PE','BEARISH_REVERSAL',73,
      `Doji inside prior bullish body`,barsAgo,c.close));
  }

  // 11. BULLISH KICKER (gap up reversal)
  const pBearMaru = bear(p) && pb >= pr*0.82;
  const cBullMaru = bull(c) && cb >= cr*0.82;
  if (pBearMaru && cBullMaru && c.open >= p.open * 1.001) {
    results.push(make('Kicking (Bull)','CE','BULLISH_REVERSAL',92,
      `Bearish→Bullish marubozu gap — institutional flip`,barsAgo,c.open));
  }

  // 12. BEARISH KICKER (gap down reversal)
  const pBullMaru = bull(p) && pb >= pr*0.82;
  const cBearMaru = bear(c) && cb >= cr*0.82;
  if (pBullMaru && cBearMaru && c.open <= p.open * 0.999) {
    results.push(make('Kicking (Bear)','PE','BEARISH_REVERSAL',93,
      `Bullish→Bearish marubozu gap — institutional flip`,barsAgo,c.open));
  }

  // 13. MATCHING LOW
  if (Math.abs(p.close-c.close) <= tol && bear(p) && bear(c)) {
    results.push(make('Matching Low','CE','BULLISH_REVERSAL',70,
      `Equal closes — support holding`,barsAgo,p.close));
  }

  // 14. MATCHING HIGH
  if (Math.abs(p.close-c.close) <= tol && bull(p) && bull(c)) {
    results.push(make('Matching High','PE','BEARISH_REVERSAL',69,
      `Equal closes — resistance holding`,barsAgo,p.close));
  }

  // 15. ON-NECK (bullish — downtrend stall)
  if (bear(p) && bull(c) && c.open < p.close
      && Math.abs(c.close - p.low) <= tol*2) {
    results.push(make('On-Neck Line (Bull)','CE','CONTINUATION',67,
      `Stalls at prior low — possible support`,barsAgo,c.close));
  }

  // 16. IN-NECK (bullish)
  if (bear(p) && bull(c) && c.open < p.close
      && c.close > p.low && c.close < mid(p)) {
    results.push(make('In-Neck Line (Bull)','CE','CONTINUATION',68,
      `Partial recovery — weak but positive`,barsAgo,c.close));
  }

  // 17. THRUSTING (bull)
  if (bear(p) && bull(c) && c.open < p.close
      && c.close > p.close && c.close < mid(p)) {
    results.push(make('Thrusting (Bull)','CE','CONTINUATION',69,
      `Closes near midpoint`,barsAgo,c.close));
  }

  // 18. INSIDE BAR
  if (c.high < p.high && c.low > p.low) {
    const signal = bull(p) ? 'CE' : bear(p) ? 'PE' : 'WATCH';
    results.push(make('Inside Bar','WATCH','INDECISION',55,
      `Inside ₹${p.low.toFixed(0)}–₹${p.high.toFixed(0)} — breakout pending`,
      barsAgo,c.close));
  }

  return results;
}

// ─────────────────────────────────────────────────────
// SECTION 3: THREE-CANDLE PATTERNS (20 patterns)
// ─────────────────────────────────────────────────────

function scanThreeCandle(c1, c2, c3, barsAgo) {
  const results = [];
  const b1=body(c1),b2=body(c2),b3=body(c3);
  const r1=range(c1),r2=range(c2),r3=range(c3);
  const avgB = (b1+b2+b3)/3;
  const d2   = doji(c2);
  const m1   = mid(c1);
  const volSurge3 = c3.volume > avgVol([c1,c2,c3]) * 1.2;

  // 1. MORNING STAR
  if (bear(c1) && b1>=avgB*0.9
      && b2<=b1*0.40
      && bull(c3) && c3.close > m1) {
    const rec = (c3.close-c3.open)/(c1.open-c1.close);
    const conf = rec>=0.75 ? 88 : rec>=0.55 ? 83 : 76;
    results.push(make('Morning Star','CE','BULLISH_REVERSAL',conf,
      `${(rec*100).toFixed(0)}% recovery of prior bearish candle`,barsAgo,c2.low));
  }

  // 2. MORNING DOJI STAR
  if (bear(c1) && d2 && bull(c3) && c3.close > m1) {
    results.push(make('Morning Doji Star','CE','BULLISH_REVERSAL',88,
      `Perfect doji pause + recovery — max reliability`,barsAgo,c2.close));
  }

  // 3. THREE WHITE SOLDIERS
  if (bull(c1)&&bull(c2)&&bull(c3)
      && c2.open>c1.open && c2.open<c1.close
      && c3.open>c2.open && c3.open<c2.close
      && uw(c1)<b1*0.20 && uw(c2)<b2*0.20 && uw(c3)<b3*0.20) {
    results.push(make('Three White Soldiers','CE','BULLISH_REVERSAL',87,
      `3 power-up candles${volSurge3?' + volume':''}`,barsAgo,c3.close));
  }

  // 4. THREE INSIDE UP
  if (bear(c1) && bull(c2)
      && c2.open>c1.close && c2.close<c1.open
      && bull(c3) && c3.close>c1.open) {
    results.push(make('Three Inside Up','CE','BULLISH_REVERSAL',77,
      `Harami confirmed by follow-through`,barsAgo,c3.close));
  }

  // 5. THREE OUTSIDE UP
  if (bear(c1) && bull(c2)
      && c2.open<=c1.close && c2.close>=c1.open
      && bull(c3) && c3.close>c2.close) {
    results.push(make('Three Outside Up','CE','BULLISH_REVERSAL',80,
      `Engulf + follow-through confirmation`,barsAgo,c3.close));
  }

  // 6. ABANDONED BABY (BULL)
  if (bear(c1) && d2 && bull(c3)
      && c2.low > c1.low
      && c3.open > c2.high
      && c3.close > m1) {
    results.push(make('Abandoned Baby (Bull)','CE','BULLISH_REVERSAL',89,
      `Island doji reversal — highest reliability`,barsAgo,c2.close));
  }

  // 7. TRI-STAR (BULL)
  if (doji(c1) && d2 && doji(c3)
      && c2.low < c1.low && c2.low < c3.low) {
    results.push(make('Tri-Star (Bull)','CE','BULLISH_REVERSAL',78,
      `Three doji at bottom — exhaustion complete`,barsAgo,c2.low));
  }

  // 8. BULLISH MAT HOLD
  if (bull(c1) && b1>=avgB*1.2
      && bear(c2) && c2.high<c1.high && c2.low>c1.low
      && bull(c3) && c3.close>c1.close) {
    results.push(make('Bullish Mat Hold','CE','CONTINUATION',76,
      `Uptrend pause resumes — continuation`,barsAgo,c3.close));
  }

  // 9. LADDER BOTTOM
  if (bear(c1)&&bear(c2)&&bear(c3)
      && c2.close<c1.close && c3.close<c2.close) {
    results.push(make('Ladder Bottom','CE','BULLISH_REVERSAL',72,
      `Three consecutive lows — exhaustion near`,barsAgo,c3.close));
  }

  // 10. EVENING STAR
  if (bull(c1) && b1>=avgB*0.9
      && b2<=b1*0.40
      && bear(c3) && c3.close < m1) {
    const drop = (c3.open-c3.close)/(c1.close-c1.open);
    const conf = drop>=0.75 ? 87 : drop>=0.55 ? 82 : 76;
    results.push(make('Evening Star','PE','BEARISH_REVERSAL',conf,
      `${(drop*100).toFixed(0)}% decline — buy exhaustion`,barsAgo,c2.high));
  }

  // 11. EVENING DOJI STAR
  if (bull(c1) && d2 && bear(c3) && c3.close < m1) {
    results.push(make('Evening Doji Star','PE','BEARISH_REVERSAL',88,
      `Perfect doji top + selloff — max reliability`,barsAgo,c2.close));
  }

  // 12. THREE BLACK CROWS
  if (bear(c1)&&bear(c2)&&bear(c3)
      && c2.open<c1.open && c2.open>c1.close
      && c3.open<c2.open && c3.open>c2.close
      && lw(c1)<b1*0.20 && lw(c2)<b2*0.20 && lw(c3)<b3*0.20) {
    results.push(make('Three Black Crows','PE','BEARISH_REVERSAL',87,
      `3 power-down candles — sustained selling`,barsAgo,c3.close));
  }

  // 13. THREE INSIDE DOWN
  if (bull(c1) && bear(c2)
      && c2.open<c1.close && c2.close>c1.open
      && bear(c3) && c3.close<c1.open) {
    results.push(make('Three Inside Down','PE','BEARISH_REVERSAL',77,
      `Bearish harami confirmed`,barsAgo,c3.close));
  }

  // 14. THREE OUTSIDE DOWN
  if (bull(c1) && bear(c2)
      && c2.open>=c1.close && c2.close<=c1.open
      && bear(c3) && c3.close<c2.close) {
    results.push(make('Three Outside Down','PE','BEARISH_REVERSAL',80,
      `Bearish engulf + follow-through`,barsAgo,c3.close));
  }

  // 15. ABANDONED BABY (BEAR)
  if (bull(c1) && d2 && bear(c3)
      && c2.high < c1.high
      && c3.open < c2.low
      && c3.close < m1) {
    results.push(make('Abandoned Baby (Bear)','PE','BEARISH_REVERSAL',89,
      `Island doji top — highest reliability`,barsAgo,c2.close));
  }

  // 16. TRI-STAR (BEAR)
  if (doji(c1) && d2 && doji(c3)
      && c2.high > c1.high && c2.high > c3.high) {
    results.push(make('Tri-Star (Bear)','PE','BEARISH_REVERSAL',78,
      `Three doji at top — exhaustion complete`,barsAgo,c2.high));
  }

  // 17. BEARISH MAT HOLD
  if (bear(c1) && b1>=avgB*1.2
      && bull(c2) && c2.high<c1.high && c2.low>c1.low
      && bear(c3) && c3.close<c1.close) {
    results.push(make('Bearish Mat Hold','PE','CONTINUATION',76,
      `Downtrend pause resumes`,barsAgo,c3.close));
  }

  // 18. UPSIDE GAP TWO CROWS
  if (bull(c1) && bear(c2) && bear(c3)
      && c2.open > c1.close
      && c3.open > c2.open
      && c3.close < c2.close
      && c3.close > c1.close) {
    results.push(make('Upside Gap Two Crows','PE','BEARISH_REVERSAL',74,
      `Gap filled by two red candles — distribution`,barsAgo,c3.close));
  }

  // 19. CONCEALING BABY SWALLOW
  if (bear(c1)&&bear(c2)&&bear(c3)
      && b1>=r1*0.85 && b2>=r2*0.85
      && c3.high>c2.high && c3.close<c2.close) {
    results.push(make('Concealing Baby Swallow','CE','BULLISH_REVERSAL',74,
      `Inside bar within marubozu sequence`,barsAgo,c3.close));
  }

  // 20. THREE-LINE STRIKE (BULL)
  if (bull(c1)&&bull(c2)&&bear(c3)
      && c3.open>c2.close && c3.close<c1.open) {
    results.push(make('Three-Line Strike (Bull)','CE','CONTINUATION',83,
      `Two bulls engulfed — bear trap`,barsAgo,c3.close));
  }

  return results;
}

// ─────────────────────────────────────────────────────
// SECTION 4: MULTI-CANDLE / CONTINUATION (9 patterns)
// ─────────────────────────────────────────────────────

function scanMultiCandle(candles) {
  const results = [];
  const n = candles.length;
  if (n < 5) return results;
  const [c1,c2,c3,c4,c5] = candles.slice(-5);
  const avgB5 = [c1,c2,c3,c4,c5].reduce((s,c)=>s+body(c),0)/5;

  // 1. RISING THREE METHODS
  if (bull(c1)&&body(c1)>=avgB5*1.2
      && bear(c2)&&bear(c3)&&bear(c4)
      && [c2,c3,c4].every(c=>c.high<c1.high&&c.low>c1.low)
      && bull(c5)&&c5.close>c1.close) {
    results.push(make('Rising Three Methods','CE','CONTINUATION',76,
      `3-candle pause inside uptrend resumes higher`,0,c5.close));
  }

  // 2. FALLING THREE METHODS
  if (bear(c1)&&body(c1)>=avgB5*1.2
      && bull(c2)&&bull(c3)&&bull(c4)
      && [c2,c3,c4].every(c=>c.high<=c1.high&&c.low>=c1.low)
      && bear(c5)&&c5.close<c1.close) {
    results.push(make('Falling Three Methods','PE','CONTINUATION',76,
      `3-candle bounce inside downtrend resumes lower`,0,c5.close));
  }

  // 3. UPSIDE TASUKI GAP
  if (bull(c1)&&bull(c2)&&c2.open>c1.close
      && bear(c3)&&c3.open<c2.close&&c3.close>c1.close) {
    results.push(make('Upside Tasuki Gap','CE','CONTINUATION',74,
      `Gap holds after partial fill — bullish`,0,c3.close));
  }

  // 4. DOWNSIDE TASUKI GAP
  if (bear(c1)&&bear(c2)&&c2.open<c1.close
      && bull(c3)&&c3.open>c2.close&&c3.close<c1.close) {
    results.push(make('Downside Tasuki Gap','PE','CONTINUATION',74,
      `Gap holds after partial fill — bearish`,0,c3.close));
  }

  // 5. THREE-LINE STRIKE (BEAR)
  if (bear(c1)&&bear(c2)&&bull(c3)
      && c3.open<c2.close&&c3.close>c1.open) {
    results.push(make('Three-Line Strike (Bear)','PE','CONTINUATION',83,
      `Two bears engulfed — bull trap`,0,c3.close));
  }

  // 6. BREAKAWAY (BULL)
  if (bear(c1)&&c2.open<c1.close
      && bear(c2)&&bear(c3)&&bear(c4)
      && bull(c5)&&c5.close>c2.open) {
    results.push(make('Breakaway (Bull)','CE','BULLISH_REVERSAL',76,
      `Gap down + 3 bears + strong reversal`,0,c5.close));
  }

  // 7. BREAKAWAY (BEAR)
  if (bull(c1)&&c2.open>c1.close
      && bull(c2)&&bull(c3)&&bull(c4)
      && bear(c5)&&c5.close<c2.open) {
    results.push(make('Breakaway (Bear)','PE','BEARISH_REVERSAL',76,
      `Gap up + 3 bulls + strong reversal`,0,c5.close));
  }

  // 8. HIKKAKE (BULL) — false breakdown reversal
  const ib = c2.high<c1.high&&c2.low>c1.low; // inside bar
  if (ib&&c3.low<c2.low&&c4.close>c1.high) {
    results.push(make('Hikkake (Bull)','CE','BULLISH_REVERSAL',77,
      `False breakdown + reversal above C1 — trapped shorts`,0,c4.close));
  }

  // 9. HIKKAKE (BEAR) — false breakout reversal
  if (ib&&c3.high>c2.high&&c4.close<c1.low) {
    results.push(make('Hikkake (Bear)','PE','BEARISH_REVERSAL',77,
      `False breakout + reversal below C1 — trapped longs`,0,c4.close));
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// CONTEXT BOOST ENGINE — raises confidence with indicators
// ─────────────────────────────────────────────────────────

export function applyContextBoost(p, ctx) {
  let boost = 0;

  // Volume surge boosts ANY pattern:
  if (ctx.volRatio >= 2.0) boost += 8;
  else if (ctx.volRatio >= 1.5) boost += 5;
  else if (ctx.volRatio >= 1.0) boost += 2;
  else if (ctx.volRatio < 0.5)  boost -= 8;
  else if (ctx.volRatio < 0.7)  boost -= 4;

  // RSI alignment:
  if (p.signal === 'CE') {
    if (ctx.rsi15m < 35)      boost += 8;
    else if (ctx.rsi15m < 45) boost += 4;
    else if (ctx.rsi15m > 68) boost -= 10;
    else if (ctx.rsi15m > 58) boost -= 5;
  }
  if (p.signal === 'PE') {
    if (ctx.rsi15m > 65)      boost += 8;
    else if (ctx.rsi15m > 55) boost += 4;
    else if (ctx.rsi15m < 32) boost -= 10;
    else if (ctx.rsi15m < 42) boost -= 5;
  }

  // MACD direction alignment:
  if (p.signal === 'CE' && ctx.macdRising)  boost += 6;
  if (p.signal === 'CE' && !ctx.macdRising) boost -= 5;
  if (p.signal === 'PE' && !ctx.macdRising) boost += 6;
  if (p.signal === 'PE' && ctx.macdRising)  boost -= 5;

  // VWAP position:
  if (p.signal === 'CE' && ctx.aboveVwap)  boost += 4;
  if (p.signal === 'CE' && !ctx.aboveVwap) boost -= 4;
  if (p.signal === 'PE' && !ctx.aboveVwap) boost += 4;
  if (p.signal === 'PE' && ctx.aboveVwap)  boost -= 4;

  // Trend alignment (reversal patterns need opposite trend):
  if (p.type === 'BULLISH_REVERSAL') {
    if (ctx.trend15m && ctx.trend15m.includes('DOWN')) boost += 6;
    if (ctx.trend15m && ctx.trend15m.includes('UP'))   boost -= 8;
  }
  if (p.type === 'BEARISH_REVERSAL') {
    if (ctx.trend15m && ctx.trend15m.includes('UP'))   boost += 6;
    if (ctx.trend15m && ctx.trend15m.includes('DOWN')) boost -= 8;
  }
  if (p.type === 'CONTINUATION') {
    if (p.signal==='CE' && ctx.trend15m && ctx.trend15m.includes('UP'))   boost += 6;
    if (p.signal==='PE' && ctx.trend15m && ctx.trend15m.includes('DOWN')) boost += 6;
  }

  // S/R location:
  if (p.signal === 'CE' && ctx.atSupport)    boost += 8;
  if (p.signal === 'PE' && ctx.atResistance) boost += 8;
  if (p.signal === 'CE' && ctx.atResistance) boost -= 6;
  if (p.signal === 'PE' && ctx.atSupport)    boost -= 6;

  // News sentiment:
  if (p.signal === 'CE' && ctx.newsScore > 3)  boost += 5;
  if (p.signal === 'PE' && ctx.newsScore < -3) boost += 5;
  if (p.signal === 'CE' && ctx.newsScore < -4) boost -= 6;
  if (p.signal === 'PE' && ctx.newsScore > 4)  boost -= 6;

  // 1h trend extra boost:
  if (p.signal==='CE' && ctx.trend1h && ctx.trend1h.includes('UP'))   boost += 4;
  if (p.signal==='PE' && ctx.trend1h && ctx.trend1h.includes('DOWN')) boost += 4;

  const finalConf = Math.min(Math.max(p.baseConf + boost, 10), 98);
  return {
    ...p,
    finalConf,
    confidence: finalConf, // for frontend backward compatibility
    contextBoost: boost,
    strength: finalConf>=80?'HIGH':finalConf>=65?'MEDIUM':'LOW',
    signal: finalConf >= 60 ? p.signal : 'WATCH',
  };
}

// ─────────────────────────────────────────────────────────
// MASTER SCANNER — runs all 63, filters, ranks
// ─────────────────────────────────────────────────────────

export function scanNiftyPatterns(
  candles,
  ctx,
  trend,
) {
  if (!candles || candles.length < 5) {
    return {
      allPatterns:   [],
      cePatterns:    [],
      pePatterns:    [],
      topPattern:    null,
      direction:     'AVOID',
      directionConf: 40,
      patternScore:  0,
      summary:       'No pattern data',
    };
  }

  const n  = candles.length;
  const c1 = candles[n-3];
  const c2 = candles[n-2];
  const c3 = candles[n-1]; // latest candle

  // Run all detectors:
  const raw = [
    // Single candle — check last 3 bars:
    ...scanSingleCandle(c3, 0, trend),
    ...scanSingleCandle(c2, 1, trend),
    ...scanSingleCandle(c1, 2, trend),
    // Two candle:
    ...scanTwoCandle(c2, c3, 0),
    ...scanTwoCandle(c1, c2, 1),
    // Three candle:
    ...scanThreeCandle(c1, c2, c3, 0),
    // Multi candle:
    ...scanMultiCandle(candles),
  ];

  // Apply context boost:
  const boosted = raw.map(p => applyContextBoost(p, ctx));

  // Filter: only ≥60% final confidence
  const valid = boosted.filter(p => p.finalConf >= 60 && p.signal !== 'WATCH');

  // Deduplicate — keep best per pattern name:
  const seen = new Map();
  valid.forEach(p => {
    const ex = seen.get(p.name);
    if (!ex || p.finalConf > ex.finalConf) seen.set(p.name, p);
  });
  
  const deduped = Array.from(seen.values())
    .sort((a,b) => b.finalConf - a.finalConf)
    .slice(0, 8); // max 8 shown

  const ceList = deduped.filter(p => p.signal === 'CE');
  const peList = deduped.filter(p => p.signal === 'PE');

  // Weighted vote:
  const ceWeight = ceList.reduce((s,p) => s + p.finalConf, 0);
  const peWeight = peList.reduce((s,p) => s + p.finalConf, 0);

  const topPattern = deduped[0] ?? null;

  let direction;
  let dirConf;
  if (ceWeight > peWeight * 1.15) {
    direction = 'CE';
    dirConf = Math.round(ceWeight / Math.max(ceList.length,1));
  } else if (peWeight > ceWeight * 1.15) {
    direction = 'PE';
    dirConf = Math.round(peWeight / Math.max(peList.length,1));
  } else {
    direction = 'AVOID';
    dirConf = 40;
  }

  // Pattern score for Pre-Market confidence engine (0–15):
  const patternScore = topPattern
    ? Math.round((topPattern.finalConf - 60) / 40 * 15)
    : 0;

  // Summary text for Pre-Market Intel:
  const summary = topPattern
    ? `${topPattern.name} (${topPattern.finalConf}%) → ${direction} signal`
    : 'No high-confidence pattern detected';

  return {
    allPatterns:   deduped,
    cePatterns:    ceList,
    pePatterns:    peList,
    topPattern,
    direction,
    directionConf: dirConf,
    patternScore,
    summary,
  };
}

export function scanAllPatterns(candles, ctx) {
  let trendDirection = 'SIDEWAYS';
  if (ctx && ctx.trend15m) {
    trendDirection = ctx.trend15m;
  } else {
    trendDirection = detectTrend(candles, 10);
  }
  
  const scanResult = scanNiftyPatterns(candles, ctx, trendDirection);
  return {
    allPatterns:  scanResult.allPatterns,
    cePatterns:   scanResult.cePatterns,
    pePatterns:   scanResult.pePatterns,
    topPattern:   scanResult.topPattern,
    direction:    scanResult.direction,
    ceWeight:     scanResult.cePatterns.reduce((s,p) => s + p.finalConf, 0),
    peWeight:     scanResult.pePatterns.reduce((s,p) => s + p.finalConf, 0),
    patternScore: scanResult.patternScore,
    topConfidence: scanResult.topPattern?.finalConf ?? 0,
    topName:      scanResult.topPattern?.name ?? 'None ≥60%',
    totalDetected: scanResult.allPatterns.length,
    validAbove75:  scanResult.allPatterns.filter(p => p.finalConf >= 75).length,
  };
}

export function scanCandles(candles, ctx) {
  if (!candles || candles.length < 5) {
    return candles && candles.length > 0
      ? [getStructureReading(candles)]
      : [{
          name: 'No Data',
          type: 'INDECISION',
          signal: 'WATCH',
          strength: 'LOW',
          confidence: 0,
          candlesUsed: 0,
          requiresTrendContext: false,
          trendBoost: false,
          trendWarning: false,
          description: 'Awaiting candle data'
        }];
  }

  let trendDirection = 'SIDEWAYS';
  if (ctx && ctx.trend15m) {
    trendDirection = ctx.trend15m;
  } else {
    trendDirection = detectTrend(candles, 10);
  }

  const scanResult = scanNiftyPatterns(candles, ctx, trendDirection);
  if (scanResult.allPatterns.length === 0) {
    return [getStructureReading(candles)];
  }
  return scanResult.allPatterns;
}

export class CandlePatternEngine {
  constructor(candles) {
    this.candles = candles;
  }
  scan(lookback = 10) {
    const results = [];
    const n = this.candles.length;
    for (let offset = 0; offset < lookback; offset++) {
      const endIdx = n - offset;
      if (endIdx < 5) break;
      const slice = this.candles.slice(0, endIdx);
      const patterns = scanCandles(slice);
      patterns.forEach(p => {
        results.push({
          ...p,
          offset
        });
      });
    }
    return results;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: SIGNAL CONFIRMATION ENGINE (pattern + filters)
// ─────────────────────────────────────────────────────────────────────────────

export function confirmSignal(inputs) {
  const { pattern, rsi5m, rsi15m, macdHistogram, macdSignalCross, vwapPosition, vwapDistance, volumeRatio, nearSupport, nearResistance, trend5m, trend15m } = inputs;

  let score = pattern.confidence;
  const reasons = [pattern.description];
  const blockers = [];

  // Trend Context
  if (pattern.type === 'BULLISH_REVERSAL') {
    if (trend15m === 'DOWN') { 
      score += 8; 
      reasons.push('15m downtrend confirms reversal context'); 
    }
    if (trend15m === 'UP') { 
      score -= 15; 
      blockers.push('Already in 15m uptrend — reversal less meaningful'); 
    }
    if (trend5m === 'UP' && trend15m === 'UP') {
      blockers.push('Both timeframes already bullish — CE entry may be late');
      score -= 10;
    }
  }
  if (pattern.type === 'BEARISH_REVERSAL') {
    if (trend15m === 'UP') { 
      score += 8; 
      reasons.push('15m uptrend confirms reversal context'); 
    }
    if (trend15m === 'DOWN') { 
      score -= 15; 
      blockers.push('Already in 15m downtrend — reversal less reliable'); 
    }
  }

  // Volume Confirmation
  if (volumeRatio >= 1.5) { 
    score += 8; 
    reasons.push(`Vol ${volumeRatio.toFixed(1)}× average indicates institutional participation`); 
  }
  if (volumeRatio >= 2.0) { 
    score += 5; 
    reasons.push('Volume surge confirming high conviction entry'); 
  }
  if (volumeRatio < 0.7) { 
    score -= 15; 
    blockers.push(`Vol ${volumeRatio.toFixed(1)}× average — insufficient participation, avoid`); 
  }

  // RSI Filter
  if (pattern.signal === 'CE') {
    if (rsi15m > 70) { 
      score -= 20; 
      blockers.push(`RSI 15m at ${rsi15m.toFixed(0)} — overbought, buyers exhausted`); 
    }
    if (rsi15m < 40) { 
      score += 8;  
      reasons.push(`RSI 15m at ${rsi15m.toFixed(0)} — room to run, CE favorable`); 
    }
    if (rsi5m < 30) { 
      score += 5;  
      reasons.push('5m RSI oversold — bounce highly probable'); 
    }
  }
  if (pattern.signal === 'PE') {
    if (rsi15m < 30) { 
      score -= 20; 
      blockers.push(`RSI 15m at ${rsi15m.toFixed(0)} — oversold, sellers exhausted`); 
    }
    if (rsi15m > 60) { 
      score += 8;  
      reasons.push(`RSI 15m at ${rsi15m.toFixed(0)} — elevated, PE favorable`); 
    }
    if (rsi5m > 70) { 
      score += 5;  
      reasons.push('5m RSI overbought — price rejection likely'); 
    }
  }

  // MACD Momentum
  if (pattern.signal === 'CE') {
    if (macdHistogram > 0) { 
      score += 6; 
      reasons.push('MACD histogram is positive — bullish momentum'); 
    }
    if (macdSignalCross === 'BULL') { 
      score += 8; 
      reasons.push('MACD bullish crossover detected'); 
    }
    if (macdHistogram < 0 && macdSignalCross !== 'BULL') {
      score -= 8; 
      blockers.push('MACD negative histogram — momentum not verified yet');
    }
  }
  if (pattern.signal === 'PE') {
    if (macdHistogram < 0) { 
      score += 6; 
      reasons.push('MACD histogram is negative — bearish momentum'); 
    }
    if (macdSignalCross === 'BEAR') { 
      score += 8; 
      reasons.push('MACD bearish crossover detected'); 
    }
  }

  // VWAP Position
  if (pattern.signal === 'CE') {
    if (vwapPosition === 'ABOVE') { 
      score += 6; 
      reasons.push('Price above VWAP — bulls hold intraday control'); 
    }
    if (vwapPosition === 'BELOW') { 
      score -= 8; 
      blockers.push('Price below VWAP — CE trades go against intraday session bias'); 
    }
    if (vwapPosition === 'AT' && nearSupport) { 
      score += 10; 
      reasons.push('VWAP and support level confluence — optimal buy zone'); 
    }
  }
  if (pattern.signal === 'PE') {
    if (vwapPosition === 'BELOW') { 
      score += 6; 
      reasons.push('Price below VWAP — bears hold intraday control'); 
    }
    if (vwapPosition === 'ABOVE') { 
      score -= 8; 
      blockers.push('Price above VWAP — PE trades go against intraday session bias'); 
    }
  }

  // Support / Resistance
  if (pattern.signal === 'CE' && nearSupport) { 
    score += 8; 
    reasons.push('Bullish pattern at support zone — asymmetric risk-to-reward'); 
  }
  if (pattern.signal === 'PE' && nearResistance) { 
    score += 8; 
    reasons.push('Bearish pattern at resistance zone — asymmetric risk-to-reward'); 
  }
  if (pattern.signal === 'CE' && nearResistance) { 
    score -= 5; 
    blockers.push('Bullish entry near major resistance — upside target space tight'); 
  }
  if (pattern.signal === 'PE' && nearSupport) { 
    score -= 5; 
    blockers.push('Bearish entry near major support — downside target space tight'); 
  }

  const finalScore = Math.min(Math.max(score, 0), 100);
  const confirmed = finalScore >= 65 && blockers.length < 2;

  return {
    confirmed,
    finalSignal: !confirmed ? 'AVOID' : pattern.signal,
    confidence: finalScore,
    reasons,
    blockers
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: STRIKE SELECTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function selectStrike(inputs) {
  const { signal, spotPrice, iv, dte, targetMove, riskCapital, lotSize } = inputs;
  
  const strikeInterval = spotPrice > 40000 ? 100 : spotPrice > 20000 ? 50 : 50; 
  
  let strikeOffset = 0;
  if (iv > 0.18) {
    strikeOffset = 2; 
  } else if (iv > 0.14) {
    strikeOffset = 1; 
  } else {
    strikeOffset = 0; 
  }

  const rawStrike = signal === 'CE'
    ? Math.ceil(spotPrice / strikeInterval) * strikeInterval + (strikeOffset * strikeInterval)
    : Math.floor(spotPrice / strikeInterval) * strikeInterval - (strikeOffset * strikeInterval);

  const moneyness = Math.abs(rawStrike - spotPrice) / spotPrice;
  const timeDte = dte <= 0 ? 0.5 : dte;
  const timeValue = spotPrice * iv * Math.sqrt(timeDte / 252);
  const intrinsic = Math.max(0, signal === 'CE' 
    ? spotPrice - rawStrike 
    : rawStrike - spotPrice);
  const estimatedPremium = intrinsic + timeValue * Math.exp(-moneyness * 3.0);

  const entryPremium = Math.round(estimatedPremium);
  const stopLossPremium = Math.round(estimatedPremium * 0.60); 
  const target1Premium = Math.round(estimatedPremium * 1.60);  
  const target2Premium = Math.round(estimatedPremium * 2.20);  

  const riskPerShare = entryPremium - stopLossPremium;
  const lotRiskVal = riskPerShare * lotSize;
  const computedLots = Math.floor(riskCapital / lotRiskVal);
  const recommendedLots = Math.max(1, Math.min(computedLots, 5));
  const maxRiskRs = recommendedLots * lotRiskVal;
  const rrRatio = ((target1Premium - entryPremium) / riskPerShare).toFixed(1);

  let ivWarning = null;
  if (iv > 0.20) {
    ivWarning = `IV at ${(iv * 100).toFixed(0)}% — elevated, buying option premiums holds high decay risk`;
  } else if (iv < 0.12) {
    ivWarning = `IV at ${(iv * 100).toFixed(0)}% — low, option buying is highly favorable`;
  }

  const getExpiryDateStr = (days) => {
    const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const expDate = new Date(istDate.getTime() + days * 24 * 60 * 60 * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(expDate.getDate()).padStart(2, '0');
    const month = months[expDate.getMonth()];
    const year = expDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return {
    strike: rawStrike,
    expiry: getExpiryDateStr(dte),
    entryPremiumLow: Math.round(entryPremium * 0.95),
    entryPremiumHigh: Math.round(entryPremium * 1.05),
    stopLossPremium,
    target1Premium,
    target2Premium,
    recommendedLots,
    maxRiskRs,
    rrRatio,
    ivWarning,
    strikeRationale: `Delta ≈ ${(0.45 - strikeOffset * 0.08).toFixed(2)}, ${strikeOffset === 0 ? 'ATM' : strikeOffset + ' strike OTM'} selected for ${(iv * 100).toFixed(0)}% IV environment`
  };
}
