/**
 * usePMIStream.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Unified Pre-Market Intel data pipeline hook.
 *
 * Layer 1 — SSE tick stream  : /api/live-stream (2s when market open)
 * Layer 2 — Quote poll fallback: /nse/quote every 2s (SSE resilience)
 * Layer 3 — Scan data refresh : /api/premarket/scan (phase-adaptive)
 * Layer 4 — Entry data refresh: /api/premarket/options-entry (30–120s)
 * Layer 5 — Regime Switcher   : computeRegime() — time+momentum router
 * Layer 6 — Intraday Decay    : fetchIntradayMetrics() — 30s live VWAP/RSI/ORB
 *
 * Returns a single flat object consumed by PreMarketIntel.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Current IST time as HHMM integer (e.g. 09:17 → 917) */
function getISTHM() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() * 100 + ist.getMinutes();
}

/** Returns 'YYYY-MM-DD' in IST for a Unix timestamp in seconds. */
function toISTDateStr(tsSec) {
  const date   = new Date(tsSec * 1000);
  const utcMs  = date.getTime() + date.getTimezoneOffset() * 60000;
  const ist    = new Date(utcMs + 5.5 * 3600000);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
}

/** Returns today's date as 'YYYY-MM-DD' in IST. */
function getTodayISTStr() {
  const now   = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist   = new Date(utcMs + 5.5 * 3600000);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
}

/**
 * FIX 4.4: Robust cross-day comparison using UTC arithmetic instead of
 * locale-string splitting (which is fragile on Node.js environments
 * lacking full Intl support).
 */
function isSameISTDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  return toISTDateStr(ts1) === toISTDateStr(ts2);
}

/** True if the market is currently open (weekday, 9:15–15:30 IST) */
function isMarketHours() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hm = ist.getHours() * 100 + ist.getMinutes();
  return hm >= 915 && hm <= 1530;
}

/** Phase-adaptive refresh interval in ms */
function getRefreshMs(phase) {
  if (['ORDER_ENTRY', 'IEP_CALCULATION'].includes(phase)) return 5_000;
  if (phase === 'BUFFER') return 15_000;
  if (phase === 'JUST_OPENED') return 30_000;
  if (phase === 'MARKET_OPEN') return 60_000;
  return 120_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIME COMPUTATION (pure function — no side effects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the active option regime based on IST time + live momentum signals.
 *
 * Window A  09:15–09:30 → CE (default open breakout capture)
 *   Override: spot < openingLow AND putOI spike > 15% → PE (bearish breakdown)
 * Window B  09:30–10:00 → NORMAL (follow engine bias)
 * Window C  10:00–10:15 → PE (morning mean-reversion / distribution wave)
 * Window D  all other   → NORMAL
 *
 * Intraday Override (any window after 09:30):
 *   PE triggered if ANY of:
 *     A) ORB Breakdown:      currentPrice < openingRangeLow
 *     B) VWAP Extended Cross: vwapBelowCount >= 3 (3 consec 5m candles below VWAP)
 *     C) RSI+PCR Drift:      rsi15m < 50 AND pcr < 0.90
 *
 *   CE Recovery (reversal of intraday PE override) if ALL of:
 *     A) currentPrice > latestVwap
 *     B) rsi15m > 52
 *     C) pcr > 0.95
 *     (Note: ORB breakdown is NOT reversible — once below, structure is bearish)
 *
 * @param {number} hm               - IST time as HHMM int
 * @param {number} openingLow       - low of the opening candle (09:15 candle)
 * @param {number} currentPrice     - latest spot price
 * @param {number} putOIChangePct   - % change in ATM put OI vs prev fetch
 * @param {string} entryBias        - 'CE' | 'PE' | null from options-entry API
 * @param {number} rsi15m           - 15m RSI (14-period), default 50
 * @param {number} macdHist         - MACD histogram value
 * @param {number|null} prevMacdHist - previous MACD histogram value
 * @param {number} morningHigh      - highest price since 09:15
 * @param {number} vwapBelowCount   - consecutive 5m candles where close < VWAP
 * @param {number} latestVwap       - current VWAP value
 * @param {number} pcr              - current Put-Call Ratio
 * @param {boolean} orbBroken       - true if price ever crossed below openingRangeLow
 * @returns {{ regime: 'CE'|'PE'|'NEUTRAL', window: string, override: boolean, intradayTrigger: string|null }}
 */
export function computeRegime(
  hm,
  openingLow,
  currentPrice,
  putOIChangePct,
  entryBias,
  rsi15m       = 50,
  macdHist     = 0,
  prevMacdHist = null,
  morningHigh  = 0,
  vwapBelowCount = 0,
  latestVwap   = 0,
  pcr          = 1.0,
  orbBroken    = false,
  vix          = 15.0,
  pctChange    = 0.0
) {
  // ── Circuit Breakers ──────────────────────────────────────────────────────
  // Volatility Circuit Breaker (Halts recommendations if VIX spikes past 25)
  if (vix >= 25.0) {
    return {
      regime: 'NEUTRAL',
      window: 'VOLATILITY_HALT',
      override: true,
      intradayTrigger: `Extreme Volatility Halt (India VIX ${vix.toFixed(1)} >= 25.0)`
    };
  }

  // Index Circuit Limit Halt (Halts recommendations if index moves >= 10.0%)
  if (Math.abs(pctChange) >= 10.0) {
    return {
      regime: 'NEUTRAL',
      window: 'CIRCUIT_LIMIT_HALT',
      override: true,
      intradayTrigger: `Circuit Limit Halt (Index change ${pctChange > 0 ? '+' : ''}${pctChange.toFixed(2)}% exceeds 10%)`
    };
  }

  // ── Window A — 09:15 to 09:30 ─────────────────────────────────────────────
  if (hm >= 915 && hm < 930) {
    const bearishBreakdown =
      openingLow > 0 &&
      currentPrice > 0 &&
      currentPrice < openingLow &&
      putOIChangePct > 15;

    if (bearishBreakdown) {
      return { regime: 'PE', window: '09:15–09:30', override: true, intradayTrigger: 'ORB breakdown at open' };
    }
    return { regime: 'CE', window: '09:15–09:30', override: false, intradayTrigger: null };
  }

  // ── Intraday Decay Check (active 09:30 onwards) ──────────────────────────
  // Evaluated BEFORE Windows B/C/D so it can override any default bias
  if (hm >= 930) {

    // Trigger A — ORB Breakdown (permanent once fired)
    const orbBreakdown = orbBroken || (
      openingLow > 0 &&
      currentPrice > 0 &&
      currentPrice < openingLow
    );

    // Trigger B — VWAP Extended Cross (3 consecutive 5m candles below VWAP)
    const vwapExtendedCross = vwapBelowCount >= 3;

    // Trigger C — RSI + PCR Drift
    const rsiPcrDrift = rsi15m < 50 && pcr < 0.90;

    const anyPeOverride = orbBreakdown || vwapExtendedCross || rsiPcrDrift;

    // Determine active intraday trigger label
    let intradayTrigger = null;
    if (anyPeOverride) {
      if (orbBreakdown)        intradayTrigger = 'ORB Breakdown (price < 9:15 low)';
      else if (vwapExtendedCross) intradayTrigger = 'VWAP Extended Cross (3 candles below VWAP)';
      else if (rsiPcrDrift)    intradayTrigger = `RSI/PCR Drift (RSI ${rsi15m.toFixed(1)} < 50, PCR ${pcr.toFixed(2)} < 0.90)`;
    }

    if (anyPeOverride) {
      // Check if market has recovered (CE Recovery conditions)
      // Note: ORB breakdown is permanent — recovery only possible via VWAP+RSI+PCR
      const ceRecovery = !orbBreakdown && (
        latestVwap > 0 && currentPrice > latestVwap &&
        rsi15m > 52 &&
        pcr > 0.95
      );

      if (ceRecovery) {
        // Recovery: revert to engine bias
        const windowLabel = hm < 1000 ? '09:30–10:00' : hm < 1015 ? '10:00–10:15' : 'INTRADAY';
        return {
          regime: entryBias ?? 'NEUTRAL',
          window: windowLabel,
          override: false,
          intradayTrigger: 'CE Recovery (VWAP reclaimed + RSI > 52 + PCR > 0.95)',
        };
      }

      // Persist the PE override
      const windowLabel = hm < 1000 ? '09:30–10:00' : hm < 1015 ? '10:00–10:15' : 'INTRADAY';
      return {
        regime: 'PE',
        window: windowLabel,
        override: true,
        intradayTrigger,
      };
    }
  }

  // ── Window C — 10:00 to 10:15 ─────────────────────────────────────────────
  if (hm >= 1000 && hm < 1015) {
    const isRsiOverbought    = rsi15m > 65;
    const isMacdFalling      = prevMacdHist !== null && macdHist < prevMacdHist;
    const isBelowMorningHigh = morningHigh > 0 && currentPrice > 0 && currentPrice < morningHigh;

    if (isRsiOverbought && isMacdFalling && isBelowMorningHigh) {
      return { regime: 'PE', window: '10:00–10:15', override: true, intradayTrigger: 'RSI overbought + MACD falling + below morning high' };
    }
    return { regime: entryBias ?? 'NEUTRAL', window: '10:00–10:15', override: false, intradayTrigger: null };
  }

  // ── Window B — 09:30 to 10:00 ─────────────────────────────────────────────
  if (hm >= 930 && hm < 1000) {
    return { regime: entryBias ?? 'NEUTRAL', window: '09:30–10:00', override: false, intradayTrigger: null };
  }

  // ── Window D — outside windows ─────────────────────────────────────────────
  return { regime: entryBias ?? 'NEUTRAL', window: 'NORMAL', override: false, intradayTrigger: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} symbol - 'NIFTY' | 'BANKNIFTY' etc.
 */
export function usePMIStream(symbol = 'NIFTY') {
  // ── SSE / Live tick ─────────────────────────────────────────────────────
  const [tick, setTick] = useState(null);      // { quote, pcr, maxPain, market }
  const [isLive, setIsLive] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [latency, setLatency] = useState(0);
  const [dataFreshness, setDataFreshness] = useState('OFFLINE'); // 'LIVE' | 'STALE' | 'OFFLINE'

  // ── REST data ────────────────────────────────────────────────────────────
  const [scanData,  setScanData]  = useState(null);
  const [entryData, setEntryData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // ── Regime state ─────────────────────────────────────────────────────────
  const [regimeState, setRegimeState] = useState({
    regime: 'NEUTRAL',
    window: 'NORMAL',
    override: false,
    intradayTrigger: null,
  });

  // ── Intraday shift state (for UI banner and downstream components) ────────
  const [intradayShift, setIntradayShift] = useState({
    active: false,
    reason: null,
    triggeredAt: null,
  });

  // ── Internal refs ────────────────────────────────────────────────────────
  const esRef            = useRef(null);
  const scanTimerRef     = useRef(null);
  const countTimerRef    = useRef(null);
  const intradayTimerRef = useRef(null);    // new: 30s intraday metrics poller
  const openingLowRef    = useRef(0);       // captured at 09:15 candle
  const openingLowLockedRef = useRef(false);// true once we've confirmed the 9:15 candle low from API
  const prevPutOIRef     = useRef(0);       // previous ATM put OI snapshot
  const lastQuoteRef     = useRef(null);
  const aliveRef         = useRef(true);
  const morningHighRef   = useRef(0);
  const prevMacdHistRef  = useRef(null);
  const livePctChangeRef = useRef(0.0);
  const lastHeartbeatRef = useRef(null);

  // ── NEW: Intraday structural state refs ──────────────────────────────────
  const vwapBelowCountRef = useRef(0);      // consecutive 5m candles below their own-period VWAP
  const latestVwapRef     = useRef(0);      // latest session VWAP value
  const liveRsi15mRef     = useRef(50);     // RSI 14-period on 15m candles (live)
  const livePcrRef        = useRef(1.0);    // live PCR from tick or entryData
  const orbBrokenRef      = useRef(false);  // permanent flag once ORB is broken (reset on new day)

  // FIX 2.2 + 6.3: Track the last IST session date so all session-scoped
  // refs (ORB, morning high, opening low, put-OI baseline) are reset when a
  // new trading day begins without requiring a browser refresh.
  const lastSessionDateRef = useRef('');

  // ── Validate quote guard ─────────────────────────────────────────────────
  const isValidQuote = (q) =>
    q &&
    !q.error &&
    typeof q.lastPrice === 'number' &&
    isFinite(q.lastPrice) &&
    q.lastPrice > 0;

  // ── Opening low capture ──────────────────────────────────────────────────
  // Captured from the FIRST valid price at 09:15 as a tick-level estimate.
  // The confirmed API candle low (set by fetchIntradayMetrics) supersedes this.
  const captureOpeningLow = useCallback((price) => {
    const hm = getISTHM();
    if (hm >= 915 && hm < 917 && openingLowRef.current === 0 && price > 0) {
      openingLowRef.current = price;
      console.log('[PMI Regime] Opening low (tick estimate) captured:', price);
    }
    // FIX 2.3: Only set orbBroken from a tick AFTER the candle API has
    // confirmed the opening low (openingLowLockedRef === true).
    // Before confirmation the tick estimate may be slightly higher than the
    // true candle low, causing a false ORB-breakdown signal in the first ~30s.
    if (openingLowLockedRef.current && openingLowRef.current > 0 && price > 0 && price < openingLowRef.current) {
      if (!orbBrokenRef.current) {
        orbBrokenRef.current = true;
        console.warn('[PMI Regime] ORB BROKEN — price fell below confirmed opening range low:', price, '<', openingLowRef.current);
      }
    }
  }, []);

  // ── Regime update ────────────────────────────────────────────────────────
  // FIX 4.3: Added `pcr` parameter so callers can supply the REST-sourced
  // PCR as a fallback when livePcrRef hasn't yet received a SSE tick.
  const updateRegime = useCallback((price, optionChainOC, entryBias, rsi15m = 50, macdHist = 0, vix = 15.0, pcr = null) => {
    const hm = getISTHM();

    // Compute putOI change %
    let putOIChangePct = 0;
    const atmPutOI = optionChainOC?.atm_put_oi ?? 0;
    if (prevPutOIRef.current > 0 && atmPutOI > 0) {
      putOIChangePct = ((atmPutOI - prevPutOIRef.current) / prevPutOIRef.current) * 100;
    }
    if (atmPutOI > 0) prevPutOIRef.current = atmPutOI;

    // Track morning high after 09:15
    if (hm >= 915 && price > 0) {
      morningHighRef.current = Math.max(morningHighRef.current, price);
    }

    const prevMacdHist = prevMacdHistRef.current;

    // Use live intraday metrics if available, else fallback to REST-sourced values.
    // FIX 4.3: effectivePcr now falls back to the pcr argument (from entryData)
    // instead of always defaulting to 1.0 before the first SSE tick arrives.
    const effectiveRsi = liveRsi15mRef.current !== 50  ? liveRsi15mRef.current : (rsi15m ?? 50);
    const effectivePcr = livePcrRef.current    !== 1.0 ? livePcrRef.current   : (pcr ?? 1.0);

    const result = computeRegime(
      hm,
      openingLowRef.current,
      price,
      putOIChangePct,
      entryBias,
      effectiveRsi,
      macdHist,
      prevMacdHist,
      morningHighRef.current,
      vwapBelowCountRef.current,
      latestVwapRef.current,
      effectivePcr,
      orbBrokenRef.current,
      vix,
      livePctChangeRef.current
    );

    if (macdHist !== 0) {
      prevMacdHistRef.current = macdHist;
    }

    setRegimeState(prev => {
      if (
        prev.regime !== result.regime ||
        prev.window !== result.window ||
        prev.override !== result.override
      ) {
        console.log(
          `[PMI Regime] Switched → ${result.regime} (${result.window})` +
          `${result.override ? ` [OVERRIDE: ${result.intradayTrigger}]` : ''}`
        );
        return result;
      }
      return prev;
    });

    // Update intradayShift state when an override fires or clears
    if (result.override && result.intradayTrigger) {
      setIntradayShift(prev => {
        if (!prev.active || prev.reason !== result.intradayTrigger) {
          return {
            active: true,
            reason: result.intradayTrigger,
            triggeredAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        }
        return prev;
      });
    } else if (!result.override) {
      setIntradayShift(prev => prev.active ? { active: false, reason: null, triggeredAt: null } : prev);
    }
  }, []);

  // ── Fetch live intraday metrics every 30s ────────────────────────────────
  // Reads 5m candles (for VWAP below count) and 15m candles (for RSI).
  // Updates vwapBelowCountRef, latestVwapRef, liveRsi15mRef in-place.
  const fetchIntradayMetrics = useCallback(async () => {
    try {
      // ── FIX 2.2 + 6.3: Session-date reset ──────────────────────────────
      // Reset all per-session refs when a new IST trading day begins.
      // This prevents yesterday's ORB breakdown, morning-high, or
      // prevPutOI values from bleeding into the next session.
      const todayStr = getTodayISTStr();
      if (lastSessionDateRef.current && lastSessionDateRef.current !== todayStr) {
        console.log(`[PMI Regime] New trading day detected (${todayStr}). Resetting session refs.`);
        orbBrokenRef.current        = false;
        openingLowRef.current       = 0;
        openingLowLockedRef.current = false;
        morningHighRef.current      = 0;
        prevPutOIRef.current        = 0;
        prevMacdHistRef.current     = null;
        liveRsi15mRef.current       = 50;
        livePcrRef.current          = 1.0;
        vwapBelowCountRef.current   = 0;
        latestVwapRef.current       = 0;
      }
      lastSessionDateRef.current = todayStr;
      // ────────────────────────────────────────────────────────────────────

      // Fetch 5m candles
      const res5m = await fetch(`/api/candles?symbol=NIFTY&interval=5m&_t=${Date.now()}`);
      if (res5m.ok) {
        const d5m = await res5m.json();
        const candles5 = d5m.candles || [];

        // Filter to today's candles only
        const lastCandle = candles5[candles5.length - 1];
        const todayCandles5 = lastCandle
          ? candles5.filter(c => isSameISTDay(c.time, lastCandle.time))
          : [];

        // Lock the opening range low from the first 9:15 candle
        if (todayCandles5.length > 0) {
          const firstCandle = todayCandles5[0];
          if (firstCandle && firstCandle.low > 0) {
            openingLowRef.current       = firstCandle.low;
            openingLowLockedRef.current = true;

            // Check if ORB was broken at any point today from candle history
            const hasOrbBreakdown = todayCandles5.some(c => c.low < firstCandle.low);
            if (hasOrbBreakdown && !orbBrokenRef.current) {
              orbBrokenRef.current = true;
              console.log('[PMI Regime] ORB breakdown detected in historical candles');
            }
          }
        }

        // ── FIX 4.2: Per-candle VWAP comparison ────────────────────────────
        // Build a cumulative VWAP series so each candle is compared against
        // the VWAP that existed AT THE TIME that candle closed, not against
        // today's latest VWAP. This prevents phantom bearish streaks in the
        // afternoon caused by an upward-drifting session VWAP.
        const perCandleVwap = [];
        let cumVP = 0, cumV = 0;
        todayCandles5.forEach(c => {
          const tp = (c.high + c.low + c.close) / 3;
          cumVP += tp * (c.volume || 1);
          cumV  += (c.volume || 1);
          perCandleVwap.push(cumV > 0 ? cumVP / cumV : 0);
        });

        // Latest session VWAP (for CE-recovery VWAP reclaim checks)
        if (perCandleVwap.length > 0) {
          latestVwapRef.current = perCandleVwap[perCandleVwap.length - 1];
        } else {
          // Fallback: check overlay array from API
          const vwapOverlay = d5m.overlays?.vwap;
          if (Array.isArray(vwapOverlay) && vwapOverlay.length > 0) {
            latestVwapRef.current = vwapOverlay[vwapOverlay.length - 1]?.value ?? 0;
          }
        }

        // Count consecutive trailing candles closing below their own-period VWAP
        if (todayCandles5.length > 0) {
          let belowCount = 0;
          for (let i = todayCandles5.length - 1; i >= 0; i--) {
            const candleVwap = perCandleVwap[i];
            if (candleVwap > 0 && todayCandles5[i].close < candleVwap) {
              belowCount++;
            } else {
              break; // streak broken
            }
          }
          vwapBelowCountRef.current = belowCount;
          if (belowCount > 0) {
            console.log(`[PMI Regime] VWAP below count: ${belowCount} consecutive 5m candles (per-candle VWAP)`);
          }
        } else {
          vwapBelowCountRef.current = 0;
        }
        // ─────────────────────────────────────────────────────────────────
      }

      // Fetch 15m candles for RSI
      const res15m = await fetch(`/api/candles?symbol=NIFTY&interval=15m&_t=${Date.now()}`);
      if (res15m.ok) {
        const d15m = await res15m.json();
        const rsiOverlay = d15m.overlays?.rsi;
        if (Array.isArray(rsiOverlay) && rsiOverlay.length > 0) {
          liveRsi15mRef.current = rsiOverlay[rsiOverlay.length - 1]?.value ?? 50;
        }
      }

    } catch (err) {
      console.warn('[PMI IntraDay] fetchIntradayMetrics failed:', err.message);
    }
  }, []);

  // ── Fetch scan data ──────────────────────────────────────────────────────
  const fetchScan = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const mockPhase = urlParams.get('mockPhase');
      const url = mockPhase ? `/api/premarket/scan?mockPhase=${encodeURIComponent(mockPhase)}` : '/api/premarket/scan';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (aliveRef.current) {
        setScanData(d);
        setLastFetched(new Date());
      }
      return d;
    } catch (e) {
      console.warn('[PMI Scan] Fetch failed:', e.message);
      if (aliveRef.current) setError(e.message);
      return null;
    }
  }, []);

  // ── Fetch entry data ─────────────────────────────────────────────────────
  const fetchEntry = useCallback(async (sym) => {
    try {
      const res = await fetch('/api/premarket/options-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (aliveRef.current) {
        setEntryData(d);
        // Keep livePcrRef in sync from REST data as a baseline
        if (d?.pcr) livePcrRef.current = d.pcr;
      }
      return d;
    } catch (e) {
      console.warn('[PMI Entry] Fetch failed:', e.message);
      return null;
    }
  }, []);

  // ── Manual refresh ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    clearInterval(scanTimerRef.current);
    clearInterval(countTimerRef.current);

    const scan  = await fetchScan();
    const entry = await fetchEntry(symbol);
    await fetchIntradayMetrics();

    const ms = getRefreshMs(scan?.phase);
    setCountdown(Math.round(ms / 1000));
    countTimerRef.current = setInterval(
      () => setCountdown(p => (p > 1 ? p - 1 : Math.round(ms / 1000))),
      1000
    );
    scanTimerRef.current = setInterval(async () => {
      const s = await fetchScan();
      await fetchEntry(symbol);
      const next = getRefreshMs(s?.phase);
      setCountdown(Math.round(next / 1000));
    }, ms);

    // Immediate regime update after refresh
    if (entry) {
      const price = lastQuoteRef.current?.lastPrice ?? 0;
      updateRegime(price, null, entry.bias, entry.rsi15m, entry.macdHist, entry.vix ?? 15.0, entry.pcr ?? null);
    }
    setLoading(false);
  }, [symbol, fetchScan, fetchEntry, fetchIntradayMetrics, updateRegime]);

  // ── SSE Connection ───────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    let retryTimer = null;
    let retryCount = 0;

    const urlParams = new URLSearchParams(window.location.search);
    const mockPhase = urlParams.get('mockPhase') || urlParams.get('phase');
    const sseUrl = `http://localhost:3001/api/live-stream?symbol=${encodeURIComponent(symbol)}${mockPhase ? `&mockPhase=${encodeURIComponent(mockPhase)}` : ''}`;

    function connectSSE() {
      try {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }

        const es = new EventSource(sseUrl);
        esRef.current = es;

        es.onopen = () => {
          if (aliveRef.current) {
            setIsLive(true);
            setError(null);
            setDataFreshness('LIVE');
            lastHeartbeatRef.current = Date.now();
            setLastHeartbeat(new Date());
          }
          retryCount = 0;
          console.log('[PMI SSE] Connected →', symbol);
        };

        es.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (!aliveRef.current) return;
            if (payload.error) return;

            // Track heartbeat and latency
            lastHeartbeatRef.current = Date.now();
            setLastHeartbeat(new Date());
            setDataFreshness('LIVE');
            if (payload.ts) {
              setLatency(Math.max(0, Date.now() - payload.ts));
            }

            // Track percent change for circuit breaker
            if (payload.quote) {
              if (typeof payload.quote.pChange === 'number') {
                livePctChangeRef.current = payload.quote.pChange;
              } else if (typeof payload.quote.change_pct === 'number') {
                livePctChangeRef.current = payload.quote.change_pct;
              }
            }

            // Merge tick state
            setTick({
              quote:   payload.quote   ?? lastQuoteRef.current,
              pcr:     payload.pcr     ?? null,
              maxPain: payload.maxPain ?? null,
              market:  payload.market  ?? null,
            });

            // Keep livePcrRef updated from SSE ticks (most fresh source)
            if (payload.pcr != null && payload.pcr > 0) {
              livePcrRef.current = payload.pcr;
            }

            // Update regime on every tick
            if (payload.quote && isValidQuote(payload.quote)) {
              const price = payload.quote.lastPrice;
              lastQuoteRef.current = payload.quote;
              captureOpeningLow(price);
              // Pass optionChain OI from latest entryData (best effort)
              setEntryData(prev => {
                // FIX 4.3: pass prev?.pcr so effectivePcr has a REST fallback
                updateRegime(price, null, prev?.bias ?? null, prev?.rsi15m, prev?.macdHist, prev?.vix ?? 15.0, prev?.pcr ?? null);
                return prev;
              });
            }
          } catch (_) {}
        };

        es.onerror = () => {
          es.close();
          esRef.current = null;
          retryCount++;
          const delay = Math.min(1000 * 2 ** retryCount, 30_000);
          console.warn(`[PMI SSE] Lost. Retry #${retryCount} in ${delay / 1000}s`);
          if (aliveRef.current) {
            setError(`Live stream reconnecting…`);
            setDataFreshness('OFFLINE');
            retryTimer = setTimeout(connectSSE, delay);
          }
        };
      } catch (err) {
        console.error('[PMI SSE] Block error:', err);
      }
    }

    connectSSE();

    // Quote poll fallback — keeps prices fresh even when SSE is down
    const quotePollId = setInterval(async () => {
      if (!aliveRef.current) return;
      try {
        const res = await fetch(`/nse/quote?symbol=${encodeURIComponent(symbol)}&_t=${Date.now()}`);
        if (!res.ok) return;
        const q = await res.json();
        if (isValidQuote(q)) {
          lastQuoteRef.current = q;
          setTick(prev => ({ ...prev, quote: q }));
          setIsLive(true);
          setError(null);
          captureOpeningLow(q.lastPrice);

          // Track heartbeat and polling latency
          lastHeartbeatRef.current = Date.now();
          setLastHeartbeat(new Date());
          setDataFreshness('LIVE');
          setLatency(200); // Polling average latency

          if (typeof q.pChange === 'number') {
            livePctChangeRef.current = q.pChange;
          } else if (typeof q.change_pct === 'number') {
            livePctChangeRef.current = q.change_pct;
          }

          setEntryData(prev => {
            // FIX 4.3: pass prev?.pcr so effectivePcr has a REST fallback
            updateRegime(q.lastPrice, null, prev?.bias ?? null, prev?.rsi15m, prev?.macdHist, prev?.vix ?? 15.0, prev?.pcr ?? null);
            return prev;
          });
        }
      } catch (_) {}
    }, 2000);

    return () => {
      aliveRef.current = false;
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(quotePollId);
    };
  }, [symbol, captureOpeningLow, updateRegime]);

  // ── Data Freshness & Heartbeat Checker ─────────────────────────────────────
  useEffect(() => {
    const checkFreshness = () => {
      if (!lastHeartbeatRef.current) {
        setDataFreshness('OFFLINE');
        return;
      }
      const age = Date.now() - lastHeartbeatRef.current;
      if (age > 15000) {
        setDataFreshness('OFFLINE');
        setIsLive(false);
      } else if (age > 6000) {
        setDataFreshness('STALE');
      } else {
        setDataFreshness('LIVE');
      }
    };
    checkFreshness();
    const id = setInterval(checkFreshness, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Initial data load + periodic refresh ────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;

    const doLoad = async () => {
      setLoading(true);
      const [scan, entry] = await Promise.all([fetchScan(), fetchEntry(symbol)]);
      if (!aliveRef.current) return;

      // Fetch intraday metrics immediately on load
      await fetchIntradayMetrics();

      if (entry?.bias) {
        const price = lastQuoteRef.current?.lastPrice ?? 0;
        // FIX 4.3: pass entry?.pcr so effectivePcr has a REST fallback on mount
        updateRegime(price, null, entry.bias, entry.rsi15m, entry.macdHist, entry.vix ?? 15.0, entry.pcr ?? null);
      }

      const ms = getRefreshMs(scan?.phase);
      setCountdown(Math.round(ms / 1000));

      clearInterval(scanTimerRef.current);
      clearInterval(countTimerRef.current);

      countTimerRef.current = setInterval(
        () => { if (aliveRef.current) setCountdown(p => (p > 1 ? p - 1 : Math.round(ms / 1000))); },
        1000
      );
      scanTimerRef.current = setInterval(async () => {
        if (!aliveRef.current) return;
        const s = await fetchScan();
        await fetchEntry(symbol);
        const next = getRefreshMs(s?.phase);
        setCountdown(Math.round(next / 1000));
      }, ms);

      setLoading(false);
    };

    doLoad();

    return () => {
      aliveRef.current = false;
      clearInterval(scanTimerRef.current);
      clearInterval(countTimerRef.current);
    };
  }, [symbol, fetchScan, fetchEntry, fetchIntradayMetrics, updateRegime]);

  // ── Regime re-check every 30s (for time-window transitions + intraday decay)
  useEffect(() => {
    const id = setInterval(() => {
      const price = lastQuoteRef.current?.lastPrice ?? 0;
      setEntryData(prev => {
        // FIX 4.3: pass prev?.pcr for REST fallback
        updateRegime(price, null, prev?.bias ?? null, prev?.rsi15m, prev?.macdHist, prev?.vix ?? 15.0, prev?.pcr ?? null);
        return prev;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [updateRegime]);

  // ── Intraday metrics poller — every 30s during market hours ─────────────
  useEffect(() => {
    // Initial fetch always runs on mount (even post-market / weekends)
    fetchIntradayMetrics();

    if (!isMarketHours()) return;

    const id = setInterval(async () => {
      await fetchIntradayMetrics();
      // After metrics update, re-run regime evaluation with fresh data
      const price = lastQuoteRef.current?.lastPrice ?? 0;
      if (price > 0) {
        setEntryData(prev => {
          // FIX 4.3: pass prev?.pcr for REST fallback
          updateRegime(price, null, prev?.bias ?? null, prev?.rsi15m, prev?.macdHist, prev?.vix ?? 15.0, prev?.pcr ?? null);
          return prev;
        });
      }
    }, 30_000);

    intradayTimerRef.current = id;
    return () => clearInterval(id);
  }, [fetchIntradayMetrics, updateRegime]);

  // ── Derived active bias: regime overrides entryData.bias ─────────────────
  // All windows respect the intraday decay result, not just A and C.
  const activeBias = useMemo(() => {
    const { regime, override } = regimeState;
    // If any override is active (intraday shift or time-window), use regime directly
    if (override) return regime;
    // Otherwise follow the live engine bias
    return entryData?.bias ?? regime;
  }, [regimeState, entryData]);

  // FIX 6.2: Expose a derived staleness flag so downstream consumers
  // (StrategyEngineDashboard, trading-plan cards) know when the underlying
  // data is stale/offline and can suppress high-confidence recommendations.
  const isDataStale = dataFreshness === 'STALE' || dataFreshness === 'OFFLINE';

  return {
    // Live tick
    tick,
    isLive,
    lastHeartbeat,
    latency,
    dataFreshness,

    // REST data
    scanData,
    entryData,
    loading,
    error,
    lastFetched,
    countdown,

    // Regime switcher
    regime:         regimeState.regime,
    regimeWindow:   regimeState.window,
    regimeOverride: regimeState.override,
    activeBias,    // ← use this instead of entryData.bias in UI
    isDataStale,   // FIX 6.2: true when dataFreshness is STALE or OFFLINE

    // NEW: Intraday shift details (for banner + downstream consumers)
    intradayShift,
    openingRangeLow: openingLowRef.current,

    // Actions
    refresh,
  };
}
