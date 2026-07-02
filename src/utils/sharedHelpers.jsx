/**
 * sharedHelpers.jsx
 * Shared utilities for the Strategy Engine Dashboard.
 * Provides IST time helpers, pattern detection, and strategy timeline builder.
 */

import React, { useState, useEffect, useRef } from 'react';
import { calculateRealTrend } from './patternEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * 15-minute intraday trading windows (NSE market hours 9:15 AM – 3:30 PM IST).
 * Each entry: { label, startHH, startMM } in 24-hour IST.
 */
export const WINDOW_TIMES = [
  { label: '9:15',  startHH: 9,  startMM: 15 },
  { label: '9:30',  startHH: 9,  startMM: 30 },
  { label: '9:45',  startHH: 9,  startMM: 45 },
  { label: '10:00', startHH: 10, startMM: 0  },
  { label: '10:15', startHH: 10, startMM: 15 },
  { label: '10:30', startHH: 10, startMM: 30 },
  { label: '10:45', startHH: 10, startMM: 45 },
  { label: '11:00', startHH: 11, startMM: 0  },
  { label: '11:15', startHH: 11, startMM: 15 },
  { label: '11:30', startHH: 11, startMM: 30 },
  { label: '11:45', startHH: 11, startMM: 45 },
  { label: '12:00', startHH: 12, startMM: 0  },
  { label: '12:15', startHH: 12, startMM: 15 },
  { label: '12:30', startHH: 12, startMM: 30 },
  { label: '12:45', startHH: 12, startMM: 45 },
  { label: '13:00', startHH: 13, startMM: 0  },
  { label: '13:15', startHH: 13, startMM: 15 },
  { label: '13:30', startHH: 13, startMM: 30 },
  { label: '13:45', startHH: 13, startMM: 45 },
  { label: '14:00', startHH: 14, startMM: 0  },
  { label: '14:15', startHH: 14, startMM: 15 },
  { label: '14:30', startHH: 14, startMM: 30 },
  { label: '14:45', startHH: 14, startMM: 45 },
  { label: '15:00', startHH: 15, startMM: 0  },
  { label: '15:15', startHH: 15, startMM: 15 },
];

// ─── IST Time Helpers ─────────────────────────────────────────────────────────

/**
 * Returns current IST time as total minutes since midnight.
 * e.g. 9:15 AM IST → 555
 */
export function getISTMinutes() {
  const now = new Date();
  // IST = UTC + 5:30
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  const ist = new Date(istMs);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Returns current IST Date object.
 */
export function getISTDate() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5.5 * 3600000);
}

/**
 * Helper to convert Unix timestamp in seconds to IST minutes since midnight.
 */
export function getISTMinutesFromTimestamp(timestampSec) {
  if (!timestampSec) return 0;
  const date = new Date(timestampSec * 1000);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 3600000);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Checks if a given Unix timestamp in seconds falls on today's date in IST.
 */
export function isISTDateToday(timestampSec) {
  if (!timestampSec) return false;
  const date = new Date(timestampSec * 1000);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utcMs + 5.5 * 3600000);
  
  const today = getISTDate();
  return (
    istDate.getFullYear() === today.getFullYear() &&
    istDate.getMonth() === today.getMonth() &&
    istDate.getDate() === today.getDate()
  );
}

// ─── Opening Range Helpers ────────────────────────────────────────────────────

/**
 * Extracts the Opening Range Low — the low of the first 15-minute candle of
 * today's session (the 9:15 AM IST candle). This is used as the ORB trigger
 * level: if price falls below this, the market has broken its opening range.
 *
 * @param {Array} candles15m - Array of 15m candle objects with { time, open, high, low, close }
 *                             where `time` is a Unix timestamp in seconds.
 * @returns {number} The low of the 9:15 candle, or 0 if not yet available.
 */
export function computeORBLow(candles15m) {
  if (!candles15m || candles15m.length === 0) return 0;

  // Filter to today's candles only
  const todayCandles = candles15m.filter(c => isISTDateToday(c.time));
  if (todayCandles.length === 0) return 0;

  // Sort ascending by time — first candle is the 9:15 opening candle
  const sorted = [...todayCandles].sort((a, b) => a.time - b.time);
  const openingCandle = sorted[0];

  // Validate: the opening candle should start at 9:15 IST (555 minutes)
  const startMinutes = getISTMinutesFromTimestamp(openingCandle.time);
  if (startMinutes < 555 || startMinutes > 560) return 0; // guard against pre-market data

  return openingCandle.low > 0 ? openingCandle.low : 0;
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

/**
 * Detects candlestick & momentum patterns from an array of OHLCV candles.
 * @param {Array} candles - Array of { open, high, low, close, volume } objects
 * @param {number} vwap   - Current VWAP value
 * @returns {Array}       - Detected patterns with name, signal, strength, description
 */
export function detectPattern(candles, vwap = 0) {
  if (!candles || candles.length < 3) return [];
  const patterns = [];

  const last  = candles[candles.length - 1];
  const prev  = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  if (!last || !prev || !prev2) return patterns;

  const lastBody  = Math.abs(last.close  - last.open);
  const prevBody  = Math.abs(prev.close  - prev.open);
  const prev2Body = Math.abs(prev2.close - prev2.open);
  const lastRange = last.high  - last.low  || 1;
  const prevRange = prev.high  - prev.low  || 1;

  const isBull  = (c) => c.close > c.open;
  const isBear  = (c) => c.close < c.open;
  const bodyPct = (c) => Math.abs(c.close - c.open) / ((c.high - c.low) || 1);

  // ── Bullish Engulfing ──────────────────────────────────────────────────────
  if (
    isBear(prev) &&
    isBull(last) &&
    last.open  < prev.close &&
    last.close > prev.open
  ) {
    patterns.push({
      name: 'Bullish Engulfing',
      signal: 'CE',
      strength: prevBody > 0.5 * prevRange && lastBody > 0.6 * lastRange ? 'HIGH' : 'MEDIUM',
      description: 'Strong bullish reversal: current candle fully engulfs prior bearish body.'
    });
  }

  // ── Bearish Engulfing ──────────────────────────────────────────────────────
  if (
    isBull(prev) &&
    isBear(last) &&
    last.open  > prev.close &&
    last.close < prev.open
  ) {
    patterns.push({
      name: 'Bearish Engulfing',
      signal: 'PE',
      strength: prevBody > 0.5 * prevRange && lastBody > 0.6 * lastRange ? 'HIGH' : 'MEDIUM',
      description: 'Strong bearish reversal: current candle fully engulfs prior bullish body.'
    });
  }

  // ── Hammer (bullish reversal at support) ────────────────────────────────────
  const lowerShadow = Math.min(last.open, last.close) - last.low;
  const upperShadow = last.high - Math.max(last.open, last.close);
  if (
    lowerShadow >= 2 * lastBody &&
    upperShadow < 0.3 * lastBody + 1 &&
    lastBody > 0
  ) {
    patterns.push({
      name: 'Hammer',
      signal: 'CE',
      strength: lowerShadow >= 3 * lastBody ? 'HIGH' : 'MEDIUM',
      description: 'Hammer candle: long lower wick signals potential bullish reversal.'
    });
  }

  // ── Shooting Star (bearish reversal at resistance) ─────────────────────────
  const upperShadowSS = last.high - Math.max(last.open, last.close);
  const lowerShadowSS = Math.min(last.open, last.close) - last.low;
  if (
    upperShadowSS >= 2 * lastBody &&
    lowerShadowSS < 0.3 * lastBody + 1 &&
    lastBody > 0
  ) {
    patterns.push({
      name: 'Shooting Star',
      signal: 'PE',
      strength: upperShadowSS >= 3 * lastBody ? 'HIGH' : 'MEDIUM',
      description: 'Shooting star: long upper wick signals potential bearish reversal.'
    });
  }

  // ── Morning Star (3-candle bullish reversal) ────────────────────────────────
  if (
    isBear(prev2) &&
    Math.abs(prev.close - prev.open) < 0.3 * prev2Body && // small doji/star
    isBull(last) &&
    last.close > (prev2.open + prev2.close) / 2
  ) {
    patterns.push({
      name: 'Morning Star',
      signal: 'CE',
      strength: 'HIGH',
      description: 'Morning star: 3-candle bullish reversal pattern with gap indecision.'
    });
  }

  // ── Evening Star (3-candle bearish reversal) ────────────────────────────────
  if (
    isBull(prev2) &&
    Math.abs(prev.close - prev.open) < 0.3 * prev2Body &&
    isBear(last) &&
    last.close < (prev2.open + prev2.close) / 2
  ) {
    patterns.push({
      name: 'Evening Star',
      signal: 'PE',
      strength: 'HIGH',
      description: 'Evening star: 3-candle bearish reversal pattern with gap indecision.'
    });
  }

  // ── Doji (indecision) ───────────────────────────────────────────────────────
  if (lastBody < 0.1 * lastRange && lastRange > 0) {
    patterns.push({
      name: 'Doji',
      signal: 'NEUTRAL',
      strength: 'LOW',
      description: 'Doji candle: open ≈ close signals market indecision.'
    });
  }

  // ── VWAP Reclaim (bullish) ──────────────────────────────────────────────────
  if (vwap > 0 && prev.close < vwap && last.close > vwap) {
    patterns.push({
      name: 'VWAP Reclaim',
      signal: 'CE',
      strength: isBull(last) ? 'HIGH' : 'MEDIUM',
      description: 'Price reclaimed VWAP from below — bullish momentum shift.'
    });
  }

  // ── VWAP Rejection (bearish) ────────────────────────────────────────────────
  if (vwap > 0 && prev.close > vwap && last.close < vwap) {
    patterns.push({
      name: 'VWAP Rejection',
      signal: 'PE',
      strength: isBear(last) ? 'HIGH' : 'MEDIUM',
      description: 'Price rejected at VWAP from above — bearish momentum shift.'
    });
  }

  // ── Consecutive Bullish Candles ─────────────────────────────────────────────
  if (isBull(prev2) && isBull(prev) && isBull(last)) {
    patterns.push({
      name: 'Three White Soldiers',
      signal: 'CE',
      strength: bodyPct(last) > 0.6 ? 'HIGH' : 'MEDIUM',
      description: '3 consecutive bullish candles — strong uptrend continuation.'
    });
  }

  // ── Consecutive Bearish Candles ─────────────────────────────────────────────
  if (isBear(prev2) && isBear(prev) && isBear(last)) {
    patterns.push({
      name: 'Three Black Crows',
      signal: 'PE',
      strength: bodyPct(last) > 0.6 ? 'HIGH' : 'MEDIUM',
      description: '3 consecutive bearish candles — strong downtrend continuation.'
    });
  }

  return patterns;
}

// ─── Strategy Timeline Builder ────────────────────────────────────────────────

/**
 * Builds the full intraday strategy timeline (one entry per 15-min window).
 *
 * @param {number} giftNiftyPremium   - GIFT Nifty premium (points)
 * @param {number} usFuturesChange    - US futures % change
 * @param {number} indiaVix           - India VIX value
 * @param {number} pcr                - Put-Call Ratio
 * @param {number} fiiNetCrore        - FII net buy/sell in crore
 * @param {Array}  candles5m          - 5-minute candles
 * @param {Array}  candles15m         - 15-minute candles
 * @param {Object|null} optionData    - Option chain data (optional)
 * @param {number} spotPrice          - Current NIFTY spot price
 * @returns {Array}                   - Array of window strategy objects
 */
export async function buildStrategyTimeline(
  giftNiftyPremium = 0,
  usFuturesChange  = 0,
  indiaVix         = 15,
  pcr              = 1.0,
  fiiNetCrore      = 0,
  candles5m        = [],
  candles15m       = [],
  optionData       = null,
  spotPrice        = 0,
  newsScore        = 0,
  activeBias       = null
) {
  const nowMinutes = getISTMinutes();
  const marketClose = 15 * 60 + 30; // 3:30 IST

  const getConvictionPct = (absConv) => {
    if (absConv === 0) return '45%';
    if (absConv === 1) return '55%';
    if (absConv === 2) return '65%';
    if (absConv === 3) return '75%';
    if (absConv === 4) return '85%';
    if (absConv === 5) return '90%';
    if (absConv === 6) return '95%';
    return '98%';
  };

  // ── Pre-market bias — ONLY used for conviction scoring, never direction ────
  let globalBiasScore = 0;

  if (giftNiftyPremium > 50)       globalBiasScore += 2;
  else if (giftNiftyPremium > 10)  globalBiasScore += 1;
  else if (giftNiftyPremium < -50) globalBiasScore -= 2;
  else if (giftNiftyPremium < -10) globalBiasScore -= 1;

  if (usFuturesChange > 0.5)       globalBiasScore += 1;
  else if (usFuturesChange < -0.5) globalBiasScore -= 1;

  if (indiaVix > 20)               globalBiasScore -= 2;
  else if (indiaVix < 13)          globalBiasScore += 1;

  if (pcr > 1.3)                   globalBiasScore += 1;
  else if (pcr < 0.7)              globalBiasScore -= 1;

  if (fiiNetCrore > 1000)          globalBiasScore += 2;
  else if (fiiNetCrore > 0)        globalBiasScore += 1;
  else if (fiiNetCrore < -1000)    globalBiasScore -= 2;
  else if (fiiNetCrore < 0)        globalBiasScore -= 1;

  if (newsScore > 4)               globalBiasScore += 2;
  else if (newsScore > 1)          globalBiasScore += 1;
  else if (newsScore < -4)         globalBiasScore -= 2;
  else if (newsScore < -1)         globalBiasScore -= 1;

  // ── Helper: compute 15m trend direction from last ≤10 candles ────────────
  function calc15mTrend(candlesArr) {
    if (!candlesArr || candlesArr.length < 5) return 'SIDEWAYS';
    return calculateRealTrend(candlesArr).direction;
  }

  // ── Helper: compute 5m trend direction from last ≤10 candles ─────────────
  function calc5mTrend(candlesArr) {
    if (!candlesArr || candlesArr.length < 5) return 'SIDEWAYS';
    return calculateRealTrend(candlesArr).direction;
  }

  // ── Build each window ────────────────────────────────────────────────────
  return WINDOW_TIMES.map((win, idx) => {
    const winMinutes = win.startHH * 60 + win.startMM;
    const nextWinMinutes = idx < WINDOW_TIMES.length - 1
      ? (WINDOW_TIMES[idx + 1].startHH * 60 + WINDOW_TIMES[idx + 1].startMM)
      : marketClose;

    const isPast    = nowMinutes >= nextWinMinutes;
    const isCurrent = nowMinutes >= winMinutes && nowMinutes < nextWinMinutes;
    const isFuture  = nowMinutes < winMinutes;

    // Filter candles for this window's timeframe
    const filtered15m = candles15m.filter(c => {
      if (!isISTDateToday(c.time)) return false;
      const istMins = getISTMinutesFromTimestamp(c.time);
      return istMins <= winMinutes;
    });

    const filtered5m = candles5m.filter(c => {
      if (!isISTDateToday(c.time)) return false;
      const istMins = getISTMinutesFromTimestamp(c.time);
      return istMins < nextWinMinutes;
    });

    // Window-specific spot price
    let winSpotPrice = spotPrice;
    if (isPast && filtered15m.length > 0) {
      winSpotPrice = filtered15m[filtered15m.length - 1].close;
    } else if (spotPrice <= 0 && filtered15m.length > 0) {
      winSpotPrice = filtered15m[filtered15m.length - 1].close;
    }

    const winAtm = winSpotPrice > 0 ? Math.round(winSpotPrice / 50) * 50 : 23500;

    // Window-specific VWAP
    let winVwap15 = winSpotPrice || winAtm;
    if (filtered15m.length > 0) {
      let cumVolPrice = 0, cumVol = 0;
      filtered15m.forEach(c => {
        const typicalPrice = (c.high + c.low + c.close) / 3;
        cumVolPrice += typicalPrice * (c.volume || 1);
        cumVol += (c.volume || 1);
      });
      winVwap15 = cumVol > 0 ? cumVolPrice / cumVol : winVwap15;
    }

    // ── PRIMARY SIGNAL: 15m slope direction (THE IMMUTABLE RULE) ─────────────
    // UP → CE, DOWN → PE, SIDEWAYS → AVOID.
    // MACD / pattern bias can NEVER override this — they only affect conviction.
    const trend15mDirection = calc15mTrend(filtered15m);
    const trend5mDirection  = calc5mTrend(filtered5m);

    // ── SECONDARY: pattern bias — conviction modifier only ────────────────────
    const winPatterns5  = detectPattern(filtered5m,  winVwap15);
    const winPatterns15 = detectPattern(filtered15m, winVwap15);

    let patternBias = 0;
    [...winPatterns5, ...winPatterns15].forEach(p => {
      if (p.signal === 'CE') patternBias += p.strength === 'HIGH' ? 2 : 1;
      if (p.signal === 'PE') patternBias -= p.strength === 'HIGH' ? 2 : 1;
    });

    // Absolute conviction: sum of abs(pattern bias) + abs(global bias)
    const absConviction = Math.abs(patternBias) + Math.abs(globalBiasScore);

    // Opening range exception
    const isOpeningRange = idx <= 1;

    let recommendation, strike, entry;

    // RULE 1: Extreme VIX with no trend → AVOID only
    if (indiaVix > 22 && trend15mDirection === 'SIDEWAYS') {
      recommendation = 'AVOID';
      entry = '—';
      strike = '—';
    }
    // ══════════════════════════════════════════════════════════════════════════
    // RULE 3: 15m UPTREND → CE  ← IMMUTABLE, cannot be overridden
    // ══════════════════════════════════════════════════════════════════════════
    else if (trend15mDirection === 'UP') {
      recommendation = 'CE';
      strike = `${winAtm}CE`;
      entry = '80-110';
    }
    // ══════════════════════════════════════════════════════════════════════════
    // RULE 4: 15m DOWNTREND → PE  ← IMMUTABLE, cannot be overridden
    // ══════════════════════════════════════════════════════════════════════════
    else if (trend15mDirection === 'DOWN') {
      recommendation = 'PE';
      strike = `${winAtm}PE`;
      entry = '80-110';
    }
    // ══════════════════════════════════════════════════════════════════════════
    // RULE 5: SIDEWAYS with Bias fallback (Opening Range only)
    // ══════════════════════════════════════════════════════════════════════════
    else if (isOpeningRange && (patternBias + globalBiasScore) > 0) {
      recommendation = 'CE';
      strike = `${winAtm}CE`;
      entry = '80-110';
    }
    else if (isOpeningRange && (patternBias + globalBiasScore) < 0) {
      recommendation = 'PE';
      strike = `${winAtm}PE`;
      entry = '80-110';
    }
    // RULE 6: True SIDEWAYS market with no bias → AVOID
    else {
      recommendation = 'AVOID';
      entry = isOpeningRange ? 'Wait for ORB' : 'Neutral';
      strike = '—';
    }

    // ── Conflict Resolution Rule (FIX 3.1) ──────────────────────────────────
    // The original code initialised isConflict = false and NEVER set it true,
    // making the guard dead code. We now check: if the live regime engine
    // (activeBias from usePMIStream) contradicts the 15m candle trend
    // direction, downgrade to AVOID to protect capital.
    // Only apply after the opening range (idx > 1) — before that the 15m
    // trend is still forming and a mismatch is expected noise.
    let isConflict = false;
    if (
      !isOpeningRange &&
      activeBias && activeBias !== 'NEUTRAL' &&
      recommendation !== 'AVOID'
    ) {
      const trendSignal = trend15mDirection === 'UP' ? 'CE' : trend15mDirection === 'DOWN' ? 'PE' : null;
      if (trendSignal && trendSignal !== activeBias) {
        isConflict    = true;
        recommendation = 'AVOID';
        strike        = '—';
        entry         = 'Signal Conflict';
      }
    }

    // Confirmation logic
    let confirmed = false;
    if (recommendation === 'CE') {
      confirmed = (trend5mDirection === 'UP');
    } else if (recommendation === 'PE') {
      confirmed = (trend5mDirection === 'DOWN');
    }

    // Conviction adjustment: discount conviction if not confirmed
    let adjustedConviction = absConviction;
    if (recommendation !== 'AVOID' && !confirmed) {
      adjustedConviction = Math.max(0, absConviction - 2); // reduce by 2 levels
    }
    const conviction = recommendation === 'AVOID' ? '0%' : getConvictionPct(adjustedConviction);

    // Calculate entry/sl/target values
    const entryMid = recommendation === 'CE' || recommendation === 'PE'
      ? (absConviction >= 5 ? 95 : absConviction >= 2 ? 75 : 60)
      : 0;
    const slVal  = Math.round(entryMid * 0.68);
    const t1Val  = Math.round(entryMid * 1.38);
    const t2Val  = Math.round(entryMid * 1.76);
    const rrVal  = entryMid > 0 ? ((t2Val - entryMid) / (entryMid - slVal)).toFixed(1) + ':1' : '—';
    const maxRisk = entryMid > 0 ? `₹${(entryMid - slVal) * 25}` : '—';

    const supportingFactors = [];
    if (isConflict) {
      supportingFactors.push(
        `AVOID — Conflict: Live regime is ${activeBias} but 15m candle trend is ` +
        `${trend15mDirection === 'UP' ? 'UPTREND (CE)' : 'DOWNTREND (PE)'}. Stand down until aligned.`
      );
    }
    if (trend15mDirection !== 'SIDEWAYS') supportingFactors.push(`15m trend: ${trend15mDirection === 'UP' ? '↑ UPTREND → CE' : '↓ DOWNTREND → PE'}`);
    
    // Add 5m confirmation factor
    if (recommendation !== 'AVOID') {
      if (confirmed) {
        supportingFactors.push(`5m Confirmation: YES (slope aligned)`);
      } else {
        supportingFactors.push(`5m Confirmation: NO (slope is ${trend5mDirection})`);
      }
    }

    if (giftNiftyPremium > 20)  supportingFactors.push(`GIFT Nifty +${giftNiftyPremium.toFixed(0)} pts premium`);
    if (giftNiftyPremium < -20) supportingFactors.push(`GIFT Nifty ${giftNiftyPremium.toFixed(0)} pts discount`);
    if (fiiNetCrore > 500)      supportingFactors.push(`FII net buyers ₹${(fiiNetCrore/100).toFixed(0)}Cr`);
    if (fiiNetCrore < -500)     supportingFactors.push(`FII net sellers ₹${Math.abs(fiiNetCrore/100).toFixed(0)}Cr`);
    if (pcr > 1.2)              supportingFactors.push(`PCR ${pcr.toFixed(2)} — put-heavy (bullish)`);
    if (pcr < 0.8)              supportingFactors.push(`PCR ${pcr.toFixed(2)} — call-heavy (bearish)`);
    if (newsScore > 1)          supportingFactors.push(`News sentiment +${newsScore.toFixed(0)} (bullish)`);
    if (newsScore < -1)         supportingFactors.push(`News sentiment ${newsScore.toFixed(0)} (bearish)`);
    if (winPatterns5.length > 0)   supportingFactors.push(`5m pattern: ${winPatterns5[0].name}`);
    if (winPatterns15.length > 0)  supportingFactors.push(`15m pattern: ${winPatterns15[0].name}`);
    if (indiaVix < 14)          supportingFactors.push(`Low VIX ${indiaVix.toFixed(1)} — trending conditions`);
    if (indiaVix > 20)          supportingFactors.push(`High VIX ${indiaVix.toFixed(1)} — volatile, size down`);
    if (supportingFactors.length === 0) supportingFactors.push('Mixed signals — risk management priority');

    // veto conditions
    const vetoed = indiaVix > 25 || (trend15mDirection === 'SIDEWAYS' && isOpeningRange && (patternBias + globalBiasScore) === 0);
    const vetoReason = indiaVix > 25
      ? `India VIX at ${indiaVix.toFixed(1)} — extreme volatility, options pricing unsound`
      : 'Opening range without directional conviction. Wait for ORB breakout.';

    return {
      time: win.label,
      timeMinutes: winMinutes,
      recommendation,
      conviction,
      strike,
      entry,
      sl:     recommendation !== 'AVOID' ? `₹${slVal}` : '—',
      t1:     recommendation !== 'AVOID' ? `₹${t1Val}` : '—',
      t2:     recommendation !== 'AVOID' ? `₹${t2Val}` : '—',
      entryVal: entryMid,
      slVal,
      t1Val,
      t2Val,
      rr:     rrVal,
      maxRisk,
      score:  recommendation === 'CE' ? absConviction : recommendation === 'PE' ? -absConviction : 0,
      why:    supportingFactors[0] || 'Mixed market conditions',
      supportingFactors,
      isPast,
      isCurrent,
      isFuture,
      vetoed,
      vetoReason,
      confirmed,
      isConflict,         // FIX 3.1: expose conflict flag to UI consumers
      computedAt: Date.now(), // FIX 6.1: timestamp so the slot can be fingerprinted
    };
  });
}

// Helper to check if a time is post-market or weekend
const checkIsPostMarket = (timestampStr) => {
  try {
    if (timestampStr) {
      const match = timestampStr.match(/(\d+):(\d+):?(\d+)?\s*(am|pm)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[4] ? match[4].toLowerCase() : null;
        
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        
        const timeVal = hours * 100 + minutes;
        
        const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = istDate.getDay();
        const isWeekend = day === 0 || day === 6;
        
        if (isWeekend || timeVal < 915 || timeVal > 1530) {
          return true;
        }
        return false;
      }
    }
  } catch (e) {
    console.error('Error parsing timestamp for market hours:', e);
  }
  
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = istDate.getDay();
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeVal = hours * 100 + minutes;
  return day === 0 || day === 6 || timeVal < 915 || timeVal > 1530;
};

// ─── SherlockVerdict Helpers ──────────────────────────────────────────────────

/**
 * Returns true if value is a valid, finite, positive price number.
 */
export function isValidPrice(val) {
  return typeof val === 'number' && isFinite(val) && val > 0;
}

/**
 * Formats a number to a fixed number of decimal places, returning '—' if invalid.
 * @param {number} val
 * @param {number} decimals
 */
export function formatNumber(val, decimals = 2) {
  if (val === null || val === undefined || !isFinite(val)) return '—';
  return Number(val).toFixed(decimals);
}

/**
 * Formats a price with ₹ prefix, or returns '—' if invalid.
 * @param {number} val
 */
export function formatPrice(val) {
  if (!isValidPrice(val)) return '—';
  return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Detects the market direction from market data indicators.
 * Returns 'LONG', 'SHORT', or 'NEUTRAL'.
 * @param {Object} data - Market data object
 */
export function detectDirection(data) {
  if (!data) return 'NEUTRAL';

  let bullSignals = 0;
  let bearSignals = 0;

  if (data.emaSignal === 'BULLISH') bullSignals++;
  if (data.emaSignal === 'BEARISH') bearSignals++;
  if (data.vwapSignal === 'ABOVE')  bullSignals++;
  if (data.vwapSignal === 'BELOW')  bearSignals++;
  if (data.rsi && data.rsi > 55)    bullSignals++;
  if (data.rsi && data.rsi < 45)    bearSignals++;
  if (data.pcr && data.pcr > 1.2)   bullSignals++;
  if (data.pcr && data.pcr < 0.8)   bearSignals++;

  if (bullSignals > bearSignals + 1) return 'LONG';
  if (bearSignals > bullSignals + 1) return 'SHORT';
  return 'NEUTRAL';
}

/**
 * Parses a raw AI verdict text into structured { deduction, evidence[], checklist }.
 * @param {string} text
 */
export function parseVerdict(text) {
  if (!text) return { deduction: '', evidence: [], checklist: '', raw: '' };

  const sections = {
    deduction: '',
    evidence: [],
    checklist: '',
    raw: text
  };

  const parts = text.split(/(?=^##+\s+)/m);
  let intro = parts[0].trim();
  if (intro && !intro.startsWith('#')) {
    sections.deduction = intro;
  }

  const evidenceItems = [];
  let checklistParts = [];
  let deductionParts = [];

  if (intro && !intro.startsWith('#')) {
    deductionParts.push(intro);
  }

  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;

    const firstLine = trimmed.split('\n')[0];
    const header = firstLine.replace(/^##+\s+/, '').trim().toLowerCase();
    const body = trimmed.split('\n').slice(1).join('\n').trim();

    if (header.includes('decision') || header.includes('verdict')) {
      deductionParts.push(trimmed);
    } else if (header.includes('why') || header.includes('reason')) {
      deductionParts.push(trimmed);
    } else if (header.includes('trade') || header.includes('checklist') || header.includes('execution') || header.includes('happen') || header.includes('scenario')) {
      checklistParts.push(trimmed);
    } else if (header.includes('matrix') || header.includes('confidence') || header.includes('evidence') || header.includes('clues')) {
      const lines = body.split('\n');
      lines.forEach(line => {
        const cleaned = line.trim().replace(/^[`\s*#|─\-\u2500]+|[`\s*#|─\-\u2500]+$/g, '');
        if (cleaned && cleaned.includes(':') && !cleaned.toLowerCase().includes('http') && !cleaned.toLowerCase().includes('watson')) {
          evidenceItems.push(cleaned);
        }
      });
    }
  });

  if (evidenceItems.length === 0) {
    const lines = text.split('\n');
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[`\s*#|─\-\u2500]+|[`\s*#|─\-\u2500]+$/g, '');
      if (cleaned && cleaned.includes(':') && cleaned.split(':')[0].length < 30 && !cleaned.toLowerCase().includes('http') && !cleaned.toLowerCase().includes('watson')) {
        evidenceItems.push(cleaned);
      }
    });
  }

  sections.deduction = deductionParts.join('\n\n').trim();
  sections.checklist = checklistParts.join('\n\n').trim();
  sections.evidence = evidenceItems;

  if (!sections.deduction) {
    sections.deduction = text;
  }

  return sections;
}

// ── Sherlock Verdict Content Parsing Utilities ──────────────────────────────
export const parseEvidenceItem = (item) => {
  const colonIdx = item.indexOf(':');
  if (colonIdx !== -1 && colonIdx < 30) {
    return {
      label: item.substring(0, colonIdx).replace(/^[\s*\-\d\.\)]+/, '').trim(),
      value: item.substring(colonIdx + 1).trim()
    };
  }
  const keywords = ['rsi', 'ema', 'vwap', 'pcr', 'max pain', 'fii', 'atr', 'trend'];
  for (const kw of keywords) {
    if (item.toLowerCase().includes(kw)) {
      return {
        label: kw.toUpperCase(),
        value: item.replace(/^[\s*\-\d\.\)]+/, '').trim()
      };
    }
  }
  return {
    label: 'TECHNICAL EVIDENCE',
    value: item.replace(/^[\s*\-\d\.\)]+/, '').trim()
  };
};

// ── Data Status Banner Component ──────────────────────────────────────────
export const DataStatusBanner = ({ status, errors, dataSource, lastUpdated, onRetry }) => {
  const isPostMarket = checkIsPostMarket(lastUpdated);

  if (status === 'READY') return (
    <div className="status-banner ready" style={{
      background: 'rgba(34,197,94,0.06)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 6,
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      color: '#4ade80',
      flexWrap: 'wrap'
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <span className="status-dot green" style={{color: '#22c55e'}}>●</span>
        <span>All deductive parameters loaded successfully.</span>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
        <span style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 10,
          color: 'var(--text-secondary)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>Source: {dataSource}</span>
        <span style={{color: 'var(--text-secondary)', fontSize: 11}}>{lastUpdated}</span>
        {isPostMarket && (
          <span style={{
            background: 'rgba(197,160,89,0.15)',
            border: '1px solid var(--gold-dim)',
            color: 'var(--gold-bright)',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Historical / Post-Market Analysis</span>
        )}
      </div>
    </div>
  );

  if (status === 'PARTIAL') return (
    <div className="status-banner partial" style={{
      background: 'rgba(245,158,11,0.06)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 6,
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      color: '#fbbf24'
    }}>
      <div style={{display:'flex', alignItems:'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 10}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span className="status-dot amber" style={{color: '#fbbf24'}}>●</span>
          <span>Partial data loaded (Source: {dataSource || 'N/A'}). Some sources failed:</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <span style={{color: 'var(--text-secondary)', fontSize: 11}}>{lastUpdated}</span>
          {isPostMarket && (
            <span style={{
              background: 'rgba(197,160,89,0.15)',
              border: '1px solid var(--gold-dim)',
              color: 'var(--gold-bright)',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Historical / Post-Market Analysis</span>
          )}
        </div>
      </div>
      <div className="error-list" style={{display:'flex', gap:6, flexWrap:'wrap'}}>
        {errors.map(e => (
          <span key={e.source} className="error-chip" style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10,
            color: '#f87171'
          }}>
            ⚠ {e.source}: {e.message}
          </span>
        ))}
      </div>
    </div>
  );

  if (status === 'LOADING') return (
    <div className="status-banner loading" style={{
      background: 'rgba(59,130,246,0.06)',
      border: '1px solid rgba(59,130,246,0.3)',
      borderRadius: 6,
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: '#60a5fa'
    }}>
      <span className="status-dot pulsing" style={{color: '#60a5fa', animation: 'pulse 1.5s infinite'}}>●</span>
      <span>Re-evaluating clues... Fetching live market data feed...</span>
    </div>
  );

  if (status === 'ERROR') return (
    <div className="status-banner error" style={{
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 6,
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      color: '#f87171',
      flexWrap: 'wrap'
    }}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span className="status-dot red" style={{color: '#ef4444'}}>●</span>
        <span>
          ⚠ Cannot fetch Nifty price. Check: Is your proxy server running? (npm run proxy)
        </span>
      </div>
      <button onClick={onRetry} className="retry-btn" style={{
        background: 'var(--gold)',
        border: 'none',
        borderRadius: 4,
        color: '#000',
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}>
        ↺ Retry Connection
      </button>
    </div>
  );

  return null;
};

// ── MTFConfirmationPanel Component ──────────────────────────────────────────
export const MTFConfirmationPanel = ({ symbol }) => {
  const [mtfData, setMtfData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/verdict/mtf?symbol=${symbol}`)
      .then(r => r.json())
      .then(data => {
        if (active) {
          setMtfData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symbol]);

  if (loading) return (
    <div className="mtf-panel" style={{ textAlign: 'center', padding: '24px' }}>
      <div className="spinner-gold" style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8 }} />
      <div style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-mono)' }}>Analyzing 3 timeframes...</div>
    </div>
  );
  if (!mtfData) return null;

  const { timeframes, alignment, summary, confidenceBonus } = mtfData;

  const TF_CONFIG = [
    { key: '15m', label: '15 MIN', desc: 'Intraday',   icon: '⚡' },
    { key: '1h',  label: '1 HOUR', desc: 'Short-term', icon: '📊' },
    { key: '1d',  label: 'DAILY',  desc: 'Positional', icon: '📅' }
  ];

  return (
    <div className="mtf-panel">
      <div className="mtf-header">
        <span className="mtf-title">
          🔭 Multi-Timeframe Confirmation
        </span>
        <span className="mtf-bonus"
              style={{ color: confidenceBonus > 0 ? '#00ff88' : '#f5a623' }}>
          {confidenceBonus > 0
            ? `+${confidenceBonus}% confidence`
            : 'No alignment bonus'}
        </span>
      </div>

      {/* Alignment banner */}
      <div className="alignment-banner"
           style={{ borderColor: summary?.color || '#f5a623',
                    background: (summary?.color || '#f5a623') + '11' }}>
        <span className="alignment-label"
              style={{ color: summary?.color || '#f5a623' }}>
          {summary?.label || 'MIXED'}
        </span>
        <span className="alignment-action">
          {summary?.action || 'Wait for alignment.'}
        </span>
      </div>

      {/* 3 timeframe cards */}
      <div className="tf-cards">
        {TF_CONFIG.map(({ key, label, desc, icon }) => {
          const tf = timeframes?.[key];
          if (!tf) return (
            <div key={key} className="tf-card unavailable">
              <span className="tf-icon">{icon}</span>
              <span className="tf-label">{label}</span>
              <span className="tf-status">Unavailable</span>
            </div>
          );

          return (
            <div key={key}
                 className={`tf-card trend-${tf.trend ? tf.trend.toLowerCase() : 'neutral'}`}>
              <div className="tf-card-header">
                <span className="tf-icon">{icon}</span>
                <span className="tf-label">{label}</span>
                <span className="tf-desc">{desc}</span>
              </div>

              {/* Trend badge */}
              <div className={`trend-badge ${tf.trend ? tf.trend.toLowerCase() : 'neutral'}`}>
                {tf.trend === 'BULLISH' ? '▲' :
                 tf.trend === 'BEARISH' ? '▼' : '→'} {tf.trend || 'NEUTRAL'}
              </div>

              {/* Key data */}
              <div className="tf-data">
                <div className="tf-row">
                  <span>RSI</span>
                  <span style={{
                    color: tf.rsi < 35 ? '#00ff88' :
                           tf.rsi > 65 ? '#ff4444' : '#f5a623'
                  }}>{tf.rsi}</span>
                </div>
                <div className="tf-row">
                  <span>EMA9/21</span>
                  <span className={
                    tf.ema9 > tf.ema21 ? 'green' : 'red'
                  }>
                    {tf.ema9 > tf.ema21 ? '↑ Bull' : '↓ Bear'}
                  </span>
                </div>
                <div className="tf-row">
                  <span>Volume</span>
                  <span className={tf.volRatio > 1.2 ? 'green' : ''}>
                    {tf.volRatio}x avg
                  </span>
                </div>
                <div className="tf-row">
                  <span>Signal</span>
                  <span className={
                    tf.signal === 'BUY_ZONE'  ? 'green' :
                    tf.signal === 'SELL_ZONE' ? 'red'   : 'amber'
                  }>
                    {tf.signal ? tf.signal.replace('_', ' ') : 'WAIT'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MTF trade rule */}
      <div className="mtf-rule">
        <span className="rule-icon">📌</span>
        <span>
          Top 1% rule: Enter ONLY when ≥2 timeframes align.
          {mtfData.aligned
            ? ` ✓ ${alignment ? alignment.replace('_', ' ') : ''} detected.`
            : ' ✗ Currently MIXED — wait for alignment.'}
        </span>
      </div>
    </div>
  );
};

// ── VerdictAccuracyTracker Component ────────────────────────────────────────
export const VerdictAccuracyTracker = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/verdict/history')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data?.stats) return null;
  const { stats, history } = data;
  const acc = parseFloat(stats.accuracy);

  return (
    <div className="accuracy-tracker">
      <div className="tracker-header">
        <span className="tracker-title">
          📈 Sherlock's Track Record
        </span>
        <span className="tracker-count">
          {stats.decidedTrades} verdicts tracked
        </span>
      </div>

      {/* Big accuracy number */}
      <div className="accuracy-display">
        <div className="accuracy-ring-wrapper">
          <svg width="90" height="90">
            <circle cx="45" cy="45" r="35"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6" />
            <circle cx="45" cy="45" r="35"
              fill="none"
              stroke={isNaN(acc) ? 'rgba(255,255,255,0.1)' : (acc >= 70 ? '#00ff88' : acc >= 55 ? '#f5a623' : '#ff4444')}
              strokeWidth="6"
              strokeDasharray={isNaN(acc) ? '0 220' : `${(acc/100)*220} 220`}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
              style={{ transition: 'all 1s ease' }}
            />
            <text x="45" y="42" textAnchor="middle"
              fill={isNaN(acc) ? '#888' : (acc >= 70 ? '#00ff88' : acc >= 55 ? '#f5a623' : '#ff4444')}
              fontSize="16" fontWeight="bold"
              fontFamily="Courier New">
              {stats.accuracy ?? '—'}%
            </text>
            <text x="45" y="55" textAnchor="middle"
              fill="#555" fontSize="8"
              fontFamily="Courier New">
              ACCURACY
            </text>
          </svg>
        </div>

        {/* Stats grid */}
        <div className="stats-grid">
          <div className="stat-item">
            <label>STREAK</label>
            <span className={`value ${
              stats.streak?.type === 'CORRECT' ? 'green' : 'red'
            }`}>
              {stats.streak?.count || 0} {stats.streak?.type === 'CORRECT'
                ? '✓ wins' : '✗ losses'}
            </span>
          </div>
          <div className="stat-item">
            <label>AVG PNL</label>
            <span className={`value ${
              parseFloat(stats.avgPnlPts) > 0 ? 'green' : 'red'
            }`}>
              {stats.avgPnlPts > 0 ? '+' : ''}{stats.avgPnlPts ?? 0} pts
            </span>
          </div>
          <div className="stat-item">
            <label>BULLISH ACC</label>
            <span className="value green">
              {stats.bySignal?.BULLISH?.accuracy ?? '—'}%
            </span>
          </div>
          <div className="stat-item">
            <label>BEARISH ACC</label>
            <span className="value red">
              {stats.bySignal?.BEARISH?.accuracy ?? '—'}%
            </span>
          </div>
        </div>
      </div>

      {/* Last 10 verdicts */}
      <div className="verdict-log">
        <h4 style={{ margin: '12px 0 6px', color: '#f5a623', fontFamily: 'Courier New', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last 10 Verdicts</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <table className="log-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SIGNAL</th>
                <th>SPOT</th>
                <th>CLOSE</th>
                <th>PNL</th>
                <th>RESULT</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map(v => (
                <tr key={v.id}>
                  <td>{new Date(v.date).toLocaleDateString('en-IN')}</td>
                  <td className={
                    v.signal === 'BULLISH' ? 'green' :
                    v.signal === 'BEARISH' ? 'red'   : 'amber'
                  }>{v.signal}</td>
                  <td>₹{v.spot?.toLocaleString('en-IN')}</td>
                  <td>{v.spotAtClose
                    ? `₹${v.spotAtClose.toLocaleString('en-IN')}`
                    : '—'}</td>
                  <td className={
                    v.pnlPts > 0 ? 'green' :
                    v.pnlPts < 0 ? 'red'   : ''
                  }>
                    {v.pnlPts !== null
                      ? `${v.pnlPts > 0 ? '+' : ''}${v.pnlPts} pts`
                      : '—'}
                  </td>
                  <td>
                    {v.outcome === 'CORRECT'   && <span className="outcome correct">✓</span>}
                    {v.outcome === 'INCORRECT' && <span className="outcome incorrect">✗</span>}
                    {v.outcome === 'PENDING'   && <span className="outcome pending">⏳</span>}
                    {v.outcome === 'SKIPPED'   && <span className="outcome skipped">—</span>}
                    {!v.outcome && <span className="outcome pending">⏳</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stats.decidedTrades === 0 && (
          <div className="no-history" style={{ marginTop: '10px' }}>
            No verdict history yet. History builds automatically after market close.
          </div>
        )}
      </div>
    </div>
  );
};

