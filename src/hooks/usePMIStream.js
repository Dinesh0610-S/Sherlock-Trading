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

/** Phase-adaptive refresh interval in ms */
function getRefreshMs(phase) {
  if (['ORDER_ENTRY', 'IEP_CALCULATION', 'BUFFER'].includes(phase)) return 15_000;
  if (phase === 'JUST_OPENED') return 30_000;
  if (phase === 'MARKET_OPEN') return 60_000;
  return 120_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIME COMPUTATION (pure function — no side effects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the active option regime based on IST time + momentum signals.
 *
 * Window A  09:15–09:30 → CE (default open breakout capture)
 *   Override: spot < openingLow AND putOI spike > 15% → PE (bearish breakdown)
 * Window B  09:30–10:00 → NORMAL (follow engine bias)
 * Window C  10:00–10:15 → PE (morning mean-reversion / distribution wave)
 * Window D  all other   → NORMAL
 *
 * @param {number} hm             - IST time as HHMM int
 * @param {number} openingLow     - low of the opening candle (09:15 candle)
 * @param {number} currentPrice   - latest spot price
 * @param {number} putOIChangePct - % change in ATM put OI vs prev fetch
 * @param {string} entryBias      - 'CE' | 'PE' | null from options-entry API
 * @returns {{ regime: 'CE'|'PE'|'NEUTRAL', window: string, override: boolean }}
 */
export function computeRegime(hm, openingLow, currentPrice, putOIChangePct, entryBias) {
  // Window A — 09:15 to 09:30
  if (hm >= 915 && hm < 930) {
    const bearishBreakdown =
      openingLow > 0 &&
      currentPrice > 0 &&
      currentPrice < openingLow &&
      putOIChangePct > 15;

    if (bearishBreakdown) {
      return { regime: 'PE', window: '09:15–09:30', override: true };
    }
    return { regime: 'CE', window: '09:15–09:30', override: false };
  }

  // Window C — 10:00 to 10:15
  if (hm >= 1000 && hm < 1015) {
    return { regime: 'PE', window: '10:00–10:15', override: false };
  }

  // Window B — 09:30 to 10:00
  if (hm >= 930 && hm < 1000) {
    return { regime: entryBias ?? 'NEUTRAL', window: '09:30–10:00', override: false };
  }

  // Window D — outside windows
  return { regime: entryBias ?? 'NEUTRAL', window: 'NORMAL', override: false };
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

  // ── REST data ────────────────────────────────────────────────────────────
  const [scanData,  setScanData]  = useState(null);
  const [entryData, setEntryData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // ── Regime state ─────────────────────────────────────────────────────────
  const [regimeState, setRegimeState] = useState({ regime: 'NEUTRAL', window: 'NORMAL', override: false });

  // ── Internal refs ────────────────────────────────────────────────────────
  const esRef          = useRef(null);
  const scanTimerRef   = useRef(null);
  const countTimerRef  = useRef(null);
  const openingLowRef  = useRef(0);      // captured at 09:15 candle
  const prevPutOIRef   = useRef(0);      // previous ATM put OI snapshot
  const lastQuoteRef   = useRef(null);
  const aliveRef       = useRef(true);

  // ── Validate quote guard ─────────────────────────────────────────────────
  const isValidQuote = (q) =>
    q && !q.error &&
    typeof q.lastPrice === 'number' &&
    isFinite(q.lastPrice) &&
    q.lastPrice > 0;

  // ── Opening low capture ──────────────────────────────────────────────────
  // Capture the first valid price at 09:15 as the opening reference low.
  const captureOpeningLow = useCallback((price) => {
    const hm = getISTHM();
    if (hm >= 915 && hm < 917 && openingLowRef.current === 0 && price > 0) {
      openingLowRef.current = price;
      console.log('[PMI Regime] Opening low captured:', price);
    }
  }, []);

  // ── Regime update ────────────────────────────────────────────────────────
  const updateRegime = useCallback((price, optionChainOC, entryBias) => {
    const hm = getISTHM();

    // Compute putOI change %
    let putOIChangePct = 0;
    const atmPutOI = optionChainOC?.atm_put_oi ?? 0;
    if (prevPutOIRef.current > 0 && atmPutOI > 0) {
      putOIChangePct = ((atmPutOI - prevPutOIRef.current) / prevPutOIRef.current) * 100;
    }
    if (atmPutOI > 0) prevPutOIRef.current = atmPutOI;

    const result = computeRegime(
      hm,
      openingLowRef.current,
      price,
      putOIChangePct,
      entryBias
    );

    setRegimeState(prev => {
      if (
        prev.regime !== result.regime ||
        prev.window !== result.window ||
        prev.override !== result.override
      ) {
        console.log(`[PMI Regime] Switched → ${result.regime} (${result.window})${result.override ? ' [OVERRIDE]' : ''}`);
        return result;
      }
      return prev;
    });
  }, []);

  // ── Fetch scan data ──────────────────────────────────────────────────────
  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch('/api/premarket/scan');
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
      if (aliveRef.current) setEntryData(d);
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

    const scan = await fetchScan();
    const entry = await fetchEntry(symbol);

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
      updateRegime(price, null, entry.bias);
    }
    setLoading(false);
  }, [symbol, fetchScan, fetchEntry, updateRegime]);

  // ── SSE Connection ───────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    let retryTimer = null;
    let retryCount = 0;

    const sseUrl = `http://localhost:3001/api/live-stream?symbol=${encodeURIComponent(symbol)}`;

    function connectSSE() {
      try {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }

        const es = new EventSource(sseUrl);
        esRef.current = es;

        es.onopen = () => {
          if (aliveRef.current) { setIsLive(true); setError(null); }
          retryCount = 0;
          console.log('[PMI SSE] Connected →', symbol);
        };

        es.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (!aliveRef.current) return;
            if (payload.error) return;

            // Merge tick state
            setTick({
              quote:   payload.quote   ?? lastQuoteRef.current,
              pcr:     payload.pcr     ?? null,
              maxPain: payload.maxPain ?? null,
              market:  payload.market  ?? null,
            });

            // Update regime on every tick
            if (payload.quote && isValidQuote(payload.quote)) {
              const price = payload.quote.lastPrice;
              lastQuoteRef.current = payload.quote;
              captureOpeningLow(price);
              // Pass optionChain OI from latest entryData (best effort)
              setEntryData(prev => {
                updateRegime(price, null, prev?.bias ?? null);
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
          setEntryData(prev => {
            updateRegime(q.lastPrice, null, prev?.bias ?? null);
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

  // ── Initial data load + periodic refresh ────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;

    const doLoad = async () => {
      setLoading(true);
      const [scan, entry] = await Promise.all([fetchScan(), fetchEntry(symbol)]);
      if (!aliveRef.current) return;

      if (entry?.bias) {
        const price = lastQuoteRef.current?.lastPrice ?? 0;
        updateRegime(price, null, entry.bias);
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
  }, [symbol, fetchScan, fetchEntry, updateRegime]);

  // ── Regime re-check every 30s (for time-window transitions) ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      const price = lastQuoteRef.current?.lastPrice ?? 0;
      setEntryData(prev => {
        updateRegime(price, null, prev?.bias ?? null);
        return prev;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [updateRegime]);

  // ── Derived active bias: regime overrides entryData.bias during windows ─
  const activeBias = useMemo(() => {
    const { regime, window: w } = regimeState;
    // Regime only overrides during hard windows A and C
    if (w === '09:15–09:30' || w === '10:00–10:15') return regime;
    // Otherwise follow engine bias
    return entryData?.bias ?? regime;
  }, [regimeState, entryData]);

  return {
    // Live tick
    tick,
    isLive,

    // REST data
    scanData,
    entryData,
    loading,
    error,
    lastFetched,
    countdown,

    // Regime switcher
    regime:        regimeState.regime,
    regimeWindow:  regimeState.window,
    regimeOverride: regimeState.override,
    activeBias,    // ← use this instead of entryData.bias in UI

    // Actions
    refresh,
  };
}
