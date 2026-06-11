import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useNSELiveData — React hook for real-time NSE market data
 * ==========================================================
 * Connects to the Node.js proxy server (port 3001 via /nse/ Vite proxy).
 *
 * Strategy (two-tier):
 *   Tier 1 — SSE push:  EventSource fires whenever server pushes (~2s market open)
 *   Tier 2 — 2s poll:   setInterval → /nse/quote every 2000ms, reliable fallback
 *
 * The poll ensures prices always stay fresh even when SSE is slow/disconnected.
 * Last-known values are always preserved — never shows NaN, undefined, or blank.
 *
 * Returns: { quote, indices, optionChain, pcr, maxPain, marketStatus, isLive, error }
 */
export function useNSELiveData(symbol = 'NIFTY') {
  const [quote,        setQuote]        = useState(null);
  const [indices,      setIndices]      = useState([]);
  const [optionChain,  setOptionChain]  = useState(null);
  const [marketStatus, setMarketStatus] = useState({ status: 'CHECKING', reason: '…' });
  const [isLive,       setIsLive]       = useState(false);
  const [error,        setError]        = useState(null);

  const esRef        = useRef(null);  // EventSource ref
  const ocTimerRef   = useRef(null);  // Option chain polling timer
  const lastQuoteRef = useRef(null);  // Last known good quote — never clobber with bad data

  // ── Guard: only accept a quote if lastPrice is a valid finite number > 0 ──
  function isValidQuote(q) {
    return (
      q &&
      !q.error &&
      typeof q.lastPrice === 'number' &&
      isFinite(q.lastPrice) &&
      q.lastPrice > 0
    );
  }

  // ── Option chain fetch (separate, slower poll) ─────────────────────────
  const fetchOptionChain = useCallback(async (sym) => {
    try {
      const res = await fetch(`/nse/option-chain?symbol=${encodeURIComponent(sym)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setOptionChain(data);
      }
      // else: keep last known optionChain — no state reset on non-ok
    } catch (err) {
      console.warn('[NSE Hook] Option chain fetch failed (keeping last value):', err.message);
      // keep last known optionChain — no state reset
    }
  }, []);

  // ── Indices fetch ──────────────────────────────────────────────────────
  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch(`/nse/indices?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.indices) && data.indices.length > 0) {
          setIndices(data.indices);
        }
        // else: keep last known indices — no state reset on empty
      }
    } catch (err) {
      console.warn('[NSE Hook] Indices fetch failed (keeping last value):', err.message);
      // keep last known indices — no state reset
    }
  }, []);

  // ── Lightweight 2-second quote poll ───────────────────────────────────
  // This is the primary live-tick mechanism. SSE augments it when available.
  // Cleared via clearInterval in the cleanup function below.
  const fetchQuotePoll = useCallback(async (sym) => {
    try {
      const res = await fetch(`/nse/quote?symbol=${encodeURIComponent(sym)}&_t=${Date.now()}`);
      if (!res.ok) return; // keep last known value — do not reset state

      const data = await res.json();

      if (isValidQuote(data)) {
        lastQuoteRef.current = data;
        setQuote(data);
        setIsLive(true);
        setError(null);
      }
      // else: silently keep lastQuoteRef.current — never show NaN or blank
    } catch (err) {
      // Network error — keep last known quote, do NOT clear it
      console.warn('[NSE Poll] Quote poll failed (keeping last value):', err.message);
    }
  }, []);

  // ── SSE connection + all interval management ───────────────────────────
  useEffect(() => {
    // Close existing SSE before reconnecting
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setError(null);
    // Do NOT reset isLive here — poll may already have it true

    const sseUrl = `http://localhost:3001/api/live-stream?symbol=${encodeURIComponent(symbol)}`;

    let retryCount = 0;
    let retryTimer = null;

    function connect() {
      try {
        const es = new EventSource(sseUrl);
        esRef.current = es;

        es.onopen = () => {
          setIsLive(true);
          setError(null);
          retryCount = 0;
          console.log(`[NSE SSE] Connected → ${symbol}`);
        };

        es.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.error) {
              console.warn('[NSE SSE] Server error:', payload.error);
              return;
            }
            if (payload.market) {
              setMarketStatus(payload.market);
            }
            if (payload.quote && isValidQuote(payload.quote)) {
              // SSE gives us a valid quote — accept it and update
              lastQuoteRef.current = payload.quote;
              setQuote(payload.quote);
            }
          } catch (parseErr) {
            console.warn('[NSE SSE] Parse error:', parseErr.message);
          }
        };

        es.onerror = () => {
          es.close();
          esRef.current = null;
          // Do NOT set isLive=false — the 2s poll keeps prices fresh independently

          // Exponential backoff retry for SSE
          retryCount++;
          const delay = Math.min(1000 * 2 ** retryCount, 30_000);
          console.warn(`[NSE SSE] Connection lost. Retry #${retryCount} in ${delay}ms`);
          setError(`NSE proxy unavailable. Retry in ${(delay / 1000).toFixed(0)}s…`);
          retryTimer = setTimeout(connect, delay);
        };
      } catch (err) {
        console.error('[NSE SSE] Connection block error:', err);
        setError(`SSE connection failed: ${err.message}`);
      }
    }

    connect();

    // ── Tier 2: 2-second quote poll ─────────────────────────────────────
    // setInterval with clearInterval in cleanup — no duplicate intervals
    fetchQuotePoll(symbol); // run immediately on mount/symbol change
    const quotePollId = setInterval(() => {
      fetchQuotePoll(symbol);
    }, 2000);

    // ── Indices polling: every 2 seconds (was 5s) ───────────────────────
    fetchIndices();
    const idxPollId = setInterval(() => {
      fetchIndices();
    }, 2000);

    // ── Option chain polling: every 3 seconds ───────────────────────────
    fetchOptionChain(symbol);
    const ocPollId = setInterval(() => {
      fetchOptionChain(symbol);
    }, 3000);

    ocTimerRef.current = ocPollId;

    // ── Cleanup: always clear ALL intervals and close SSE ───────────────
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(quotePollId); // ← clears the 2s quote poll
      clearInterval(idxPollId);   // ← clears the 2s indices poll
      clearInterval(ocPollId);    // ← clears the 3s option chain poll
    };
  }, [symbol, fetchOptionChain, fetchIndices, fetchQuotePoll]);

  return {
    quote,
    indices,
    optionChain,
    pcr:     optionChain?.pcr      ?? null,
    maxPain: optionChain?.max_pain ?? null,
    marketStatus,
    isLive,
    error,
  };
}

/**
 * useNSESingleQuote — lightweight hook for a single symbol quote
 * Polls /nse/quote every 2s with last-known-value protection.
 * clearInterval is called in the useEffect cleanup — no duplicate intervals.
 */
export function useNSESingleQuote(symbol) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const lastDataRef           = useRef(null);

  useEffect(() => {
    let alive = true;

    const fetchQuote = async () => {
      try {
        const res = await fetch(`/nse/quote?symbol=${encodeURIComponent(symbol)}&_t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Guard: only accept valid, non-NaN prices
        if (
          json &&
          !json.error &&
          typeof json.lastPrice === 'number' &&
          isFinite(json.lastPrice) &&
          json.lastPrice > 0
        ) {
          if (alive) {
            lastDataRef.current = json;
            setData(json);
            setError(null);
          }
        }
        // else: keep last known value — no state reset
      } catch (err) {
        // Keep showing last known data — never show NaN or blank
        if (alive && lastDataRef.current) {
          setData(lastDataRef.current);
        }
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchQuote(); // immediate fetch on mount/symbol change

    // clearInterval in cleanup ensures no duplicate polls across re-renders
    const timer = setInterval(fetchQuote, 2000);

    return () => {
      alive = false;
      clearInterval(timer); // ← always cleared on unmount or symbol change
    };
  }, [symbol]);

  return { data, loading, error };
}
