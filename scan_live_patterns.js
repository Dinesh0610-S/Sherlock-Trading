import { scanAllPatterns, calculateVWAP, buildTrendContext, calculateRSI } from './src/utils/patternEngine.js';

async function fetchYahooCandles(symbol, interval, rangeVal) {
  const yfSymbol = symbol === 'NIFTY' ? '^NSEI' : symbol === 'BANKNIFTY' ? '^NSEBANK' : symbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=${interval}&range=${rangeVal}&includePrePost=false`;
  const res = await fetch(url);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`No result from Yahoo Finance for ${symbol}`);
  const ts = r.timestamp;
  const q = r.indicators?.quote?.[0];
  
  return ts.map((t, i) => ({
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
  );
}

function clientMacd(candles) {
  if (!candles || candles.length < 26) return { hist: 0, rising: false };
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
  const prevMacd = macdLine[macdLine.length - 2] || 0;

  return { hist: latestHist, rising: latestMacd > prevMacd };
}

function calcVolumeRatio(candles) {
  if (!candles || candles.length < 5) return 1.0;
  const current = candles[candles.length-1].volume;
  const avg20 = candles.slice(-21,-1).reduce((s,c) => s+c.volume, 0) / 20;
  return avg20 > 0 ? current / avg20 : 1.0;
}

function getTFTrend(candles) {
  if (candles.length < 5) return { label: 'NEUTRAL' };
  const closes = candles.map(c => c.close);
  const last5 = closes.slice(-5);
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < 5; i++) {
    sumX += i;
    sumY += last5[i];
    sumXY += i * last5[i];
    sumXX += i * i;
  }
  const slope = (5 * sumXY - sumX * sumY) / (5 * sumXX - sumX * sumX);
  const pctSlope = slope / last5[0] * 100;
  if      (pctSlope >  0.03) return { label: 'UP' };
  else if (pctSlope < -0.03) return { label: 'DOWN' };
  return { label: 'SIDEWAYS' };
}

async function runScan(symbol) {
  console.log(`\n==================================================`);
  console.log(`🔍 SCANNING LIVE CANDLE PATTERNS FOR ${symbol}`);
  console.log(`==================================================`);

  try {
    // 1. Fetch data
    console.log('Fetching live ticks and candles...');
    const c5 = await fetchYahooCandles(symbol, '5m', '2d');
    const c15 = await fetchYahooCandles(symbol, '15m', '5d');
    const c1h = await fetchYahooCandles(symbol, '60m', '1mo');

    console.log(`Retrieved ${c5.length} (5m) and ${c15.length} (15m) candles.`);

    const spot = c15[c15.length - 1].close;
    console.log(`Latest Spot Price: ₹${spot.toFixed(2)}`);

    // 2. Perform 15m scan
    const ind15 = {
      rsi: calculateRSI(c15, 14),
      macd: clientMacd(c15),
      volRatio: calcVolumeRatio(c15)
    };
    const trendCtx15m = buildTrendContext(c15);
    const ctx15m = {
      volumeRatio: ind15.volRatio,
      rsi:         ind15.rsi,
      macdHist:    ind15.macd.hist,
      macdRising:  ind15.macd.rising,
      aboveVwap:   spot > calculateVWAP(c15),
      trend15m:    getTFTrend(c15).label,
      trend1h:     getTFTrend(c1h).label,
      atSupport:   trendCtx15m.atSupport,
      atResistance:trendCtx15m.atResistance,
    };
    const result15m = scanAllPatterns(c15, ctx15m);

    // 3. Perform 5m scan
    const ind5 = {
      rsi: calculateRSI(c5, 14),
      macd: clientMacd(c5),
      volRatio: calcVolumeRatio(c5)
    };
    const trendCtx5m = buildTrendContext(c5);
    const ctx5m = {
      volumeRatio: ind5.volRatio,
      rsi:         ind5.rsi,
      macdHist:    ind5.macd.hist,
      macdRising:  ind5.macd.rising,
      aboveVwap:   spot > calculateVWAP(c5),
      trend15m:    getTFTrend(c5).label,
      trend1h:     getTFTrend(c1h).label,
      atSupport:   trendCtx5m.atSupport,
      atResistance:trendCtx5m.atResistance,
    };
    const result5m = scanAllPatterns(c5, ctx5m);

    // 4. Output Results
    console.log(`\n⏳ --- 15-MINUTE TIMEFRAME RESULTS ---`);
    console.log(`Trend: ${ctx15m.trend15m} | RSI: ${ctx15m.rsi.toFixed(1)} | Vol Ratio: ${ctx15m.volumeRatio.toFixed(2)}x`);
    console.log(`Total Detected Raw: ${result15m.totalDetected}`);
    console.log(`Deduplicated Valid (Confidence >= 75%): ${result15m.validAbove75}`);
    if (result15m.allPatterns.length === 0) {
      console.log('No patterns identified with confidence >= 75%.');
    } else {
      result15m.allPatterns.forEach(p => {
        console.log(`  🟢 [${p.signal}] ${p.name} - Confidence: ${p.confidence}% (Strength: ${p.strength})`);
        console.log(`     Desc: ${p.description}`);
        if (p.contextNotes && p.contextNotes.length > 0) {
          console.log(`     Boost Factors: ${p.contextNotes.join(' | ')}`);
        }
      });
    }

    console.log(`\n⏳ --- 5-MINUTE TIMEFRAME RESULTS ---`);
    console.log(`Trend: ${ctx5m.trend15m} | RSI: ${ctx5m.rsi.toFixed(1)} | Vol Ratio: ${ctx5m.volumeRatio.toFixed(2)}x`);
    console.log(`Total Detected Raw: ${result5m.totalDetected}`);
    console.log(`Deduplicated Valid (Confidence >= 75%): ${result5m.validAbove75}`);
    if (result5m.allPatterns.length === 0) {
      console.log('No patterns identified with confidence >= 75%.');
    } else {
      result5m.allPatterns.forEach(p => {
        console.log(`  🟢 [${p.signal}] ${p.name} - Confidence: ${p.confidence}% (Strength: ${p.strength})`);
        console.log(`     Desc: ${p.description}`);
        if (p.contextNotes && p.contextNotes.length > 0) {
          console.log(`     Boost Factors: ${p.contextNotes.join(' | ')}`);
        }
      });
    }

    console.log(`\n🏆 --- DUAL TIMEFRAME SUMMARY ---`);
    console.log(`15m Top Signal: ${result15m.topName} (${result15m.topConfidence}%) -> Vote: ${result15m.direction}`);
    console.log(`5m Top Signal: ${result5m.topName} (${result5m.topConfidence}%) -> Vote: ${result5m.direction}`);

  } catch (err) {
    console.error('Error during scan execution:', err);
  }
}

(async () => {
  await runScan('NIFTY');
  await runScan('BANKNIFTY');
})();
