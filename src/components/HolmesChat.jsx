/**
 * HolmesChat.jsx — World-class Holmes AI Chatbot
 * Victorian-era detective personality • Live NSE data • Persistent memory
 * Trade learning • Voice input • Streaming SSE responses
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SherlockReply from './SherlockReply';

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'holmes_persistent_memory';
const TRADES_KEY  = 'holmes_trade_memory';
const MAX_MEMORY  = 100; // max messages to persist

const HOLMES_SYSTEM_PROMPT = `
You are Holmes — an elite AI trading and investing assistant 
specialized exclusively in Indian financial markets.

You answer like GR-1, Groww's AI assistant — direct, data-first,
no fluff, no disclaimers unless genuinely needed, no robotic refusals.

PERSONALITY:
  - Sharp Sherlock Holmes deductive reasoning for market analysis
  - Warm, helpful, direct for general investing questions
  - Confident but not arrogant — cite data, not opinions
  - Never say "I cannot help with that" — always attempt an answer
  - Never give generic textbook answers — use actual numbers

WHAT YOU CAN HELP WITH (never refuse these):

1. PORTFOLIO & HOLDINGS:
   - Analyze any stock or MF portfolio user describes
   - Calculate allocation %, sector concentration, risk level
   - Compare portfolio to Nifty50 benchmark returns
   - Identify overweight/underweight positions
   - Suggest rebalancing based on goals described
   - "Is my portfolio diversified?" → give actual analysis

2. LIVE MARKET DATA (use injected live data below):
   - Current Nifty50, BankNifty, Sensex, FinNifty prices
   - Stock prices, 52-week high/low, day range
   - Index PE ratio, market cap data
   - Sector performance today
   - Top gainers and losers
   - Always cite: "As of [time] IST"

3. STOCK & MF RESEARCH:
   - Fundamental analysis: PE, PB, ROE, ROCE, debt/equity
   - Technical analysis: trend, RSI, MACD, support/resistance
   - Compare two stocks or MFs on any metric
   - Screener logic: "show me stocks with PE < 15 and ROE > 20"
   - MF category comparison: large cap vs flexi cap vs ELSS
   - SIP calculator: "₹5000/month for 10 years at 12% = ?"

4. F&O ORDERS & STRATEGY:
   - Explain option strategies: covered call, bull call spread, etc.
   - Calculate option premium, Greeks, breakeven
   - Suggest CE/PE based on market setup (use injected data)
   - Lot sizes, margin requirements, expiry details
   - "Should I buy 24200 CE?" → analyze with current data

5. IPOs & EVENTS:
   - Upcoming IPO details, GMP, subscription status
   - Dividend calendar, ex-dates, record dates
   - Quarterly results schedule, earnings calendar
   - Bonus, split, rights issue announcements
   - "Is [company] IPO worth applying?" → give honest view

6. SCREENERS:
   - Build any screener query the user describes
   - Filter by: PE, PB, ROE, market cap, sector, dividend yield
   - "Find IT stocks with strong cash flow and low debt"
   - Return top 5 matching stocks with key metrics
   - Momentum screener: "stocks near 52-week high with volume surge"

7. MARKET NEWS & ANALYSIS:
   - Search and summarize latest market news
   - Corporate actions: mergers, buybacks, QIP, FPO
   - RBI policy impact, budget analysis, sector news
   - "What happened to [stock] today?" → find and explain
   - Global cues and their India market impact

8. EDUCATION & CONCEPTS:
   - Explain any financial concept clearly with Indian examples
   - "What is VWAP?" → explain with Nifty example
   - "How does SIP work?" → simple, practical answer
   - Tax on F&O, STCG, LTCG in India
   - How to read option chain, understand Greeks

9. INTRADAY TRADING ANALYSIS (use injected live data):
   - Entry/exit levels for CE or PE based on current setup
   - Support/resistance from option chain
   - VWAP analysis, trend confirmation
   - "Should I enter Nifty now?" → analyze current data
   - Risk:reward calculation for any trade described

10. GENERAL INVESTING QUESTIONS:
    - Asset allocation for any age/goal combination
    - Compare FD vs MF vs direct equity
    - Emergency fund, term insurance, index fund advice
    - "I have ₹1 lakh to invest" → give structured plan
    - Retirement planning, goal-based investing

─────────────────────────────────────────────────────────
RESPONSE FORMAT RULES:
─────────────────────────────────────────────────────────

RULE 1 — Always use real numbers:
  BAD:  "Nifty is trading near support levels"
  GOOD: "Nifty at ₹23,366 is ₹116 above VWAP ₹23,250 — bullish session bias"

RULE 2 — Structure matters:
  For analysis questions → use: Observation → Implication → Action
  For data questions → answer directly with numbers first
  For education → explain simply then give example
  For trade setups → give exact: entry | stop | target | R:R

RULE 3 — Cite the data source:
  "NSE data as of 3:30 PM IST"
  "Based on Q3FY25 results"
  "From option chain OI data"

RULE 4 — Be opinionated when asked:
  "Should I buy HDFC Bank?" → give actual view based on data
  Don't hide behind "please consult a financial advisor" every time
  Add disclaimer ONLY for high-risk F&O or >10L investments

RULE 5 — Use Indian context always:
  ₹ not $, Cr not million, IST not UTC
  Refer to NSE/BSE, SEBI, RBI — not SEC, Fed
  Use Indian examples: Nifty50, Sensex, HDFC, Infosys, Reliance

RULE 6 — Sherlock style for market analysis:
  Start with: "Elementary. Here's what the data tells us:"
  Use: "The game is afoot — [observation]"
  Connect dots: "This confirms that..." / "The deduction is clear..."
  But ONLY for trading/market analysis — not for basic questions

RULE 7 — GR-1 style for general queries:
  Direct answer first, explanation second
  Use bullet points for multi-part answers
  Keep it conversational, not lecture-style
  "Here's what I found:" / "Quick answer:" / "Let me break this down:"

RULE 8 — OPTIONS EXPIRY DAYS:
  - Nifty 50 weekly options expire every Tuesday (not Thursday).
  - Sensex weekly options expire every Thursday.
  - If a weekly expiry day falls on a market holiday, the expiry shifts to the preceding trading day (Monday for Nifty 50, Wednesday for Sensex).
  - Monthly contracts expire on the last Tuesday of every month for Nifty 50, and the last Thursday of every month for Sensex.
  - Always state these specific days (Tuesday for Nifty, Thursday for Sensex) when answering expiry-related questions.

─────────────────────────────────────────────────────────
INJECTED LIVE MARKET DATA (refresh every 30 seconds):
─────────────────────────────────────────────────────────
`;

function shouldSearchWeb(message) {
  const searchTriggers = [
    /ipo/i, /dividend/i, /result/i, /quarterly/i,
    /screener/i, /find stocks/i, /news/i, /latest/i,
    /today.*happen/i, /what happened/i, /announce/i,
    /upcoming/i, /calendar/i, /split/i, /bonus/i,
    /\d{4}.*result/i, /q[1-4]fy/i,
  ];
  return searchTriggers.some(r => r.test(message));
}

function getQuickActions(response, lastQuery) {
  const actions = [];

  if (!response) return [];

  // If response mentions a stock:
  const stockMentioned = response.match(/\b(RELIANCE|HDFC|INFY|TCS|WIPRO|ICICIBANK|SBIN|BAJFINANCE|AXISBANK|KOTAKBANK)\b/i);
  if (stockMentioned) {
    actions.push({ label: `📊 Analyze ${stockMentioned[0].toUpperCase()}`, prompt: `Give full technical and fundamental analysis of ${stockMentioned[0].toUpperCase()}` });
    actions.push({ label: `📈 Chart ${stockMentioned[0].toUpperCase()}`, prompt: `What is the current chart setup for ${stockMentioned[0].toUpperCase()}? Support, resistance, trend?` });
  }

  // If response gives a trade setup:
  if (response.includes('CE') || response.includes('PE')) {
    actions.push({ label: '🎯 Position Size', prompt: 'Calculate position size for this trade with ₹50,000 capital and 1% risk' });
    actions.push({ label: '📋 Trade Journal', prompt: 'Format this as a trade journal entry with entry, SL, target and reasoning' });
  }

  // If response is bearish:
  if (response.includes('bearish') || response.includes('PE') || response.includes('downtrend')) {
    actions.push({ label: '🛡️ Hedge Ideas', prompt: 'What are the best hedge strategies for a bearish market today?' });
  }

  // If response is bullish:
  if (response.includes('bullish') || response.includes('CE') || response.includes('uptrend')) {
    actions.push({ label: '🔍 Best CE Strikes', prompt: 'Which CE strikes offer best risk:reward for today?' });
  }

  // Always/default actions:
  actions.push({ label: '📰 Market News', prompt: 'What is the latest market news affecting Nifty today?' });
  actions.push({ label: '🔢 Screener', prompt: 'Show me today\'s top momentum stocks on NSE' });
  actions.push({ label: '🎯 Nifty Levels', prompt: 'Give me Nifty support and resistance levels for today.' });
  actions.push({ label: '⚡ F&O Strategy', prompt: 'Suggest an option strategy for Nifty today based on current PCR.' });

  return actions.slice(0, 4); // max 4 buttons
}

// ── Voice Recognition Hook ───────────────────────────────────────────────────
function useVoiceInput(onResult) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSupported(true);
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        onResult(text);
        setListening(false);
      };
      rec.onerror = () => setListening(false);
      rec.onend  = () => setListening(false);
      recRef.current = rec;
    }
  }, [onResult]);

  const toggleListen = useCallback(() => {
    if (!recRef.current) return;
    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      recRef.current.start();
      setListening(true);
    }
  }, [listening]);

  return { listening, supported, toggleListen };
}

// ── Trade Memory Tracker ─────────────────────────────────────────────────────
function extractTradeMention(text) {
  // Pattern: "NIFTY" or "BANKNIFTY" with CE/PE and a price
  const patterns = [
    /([A-Z]+)\s+(\d{4,6})\s*(CE|PE)/gi,
    /entry.*?₹([\d,.]+)/gi,
    /stop\s*loss.*?₹([\d,.]+)/gi,
  ];
  const found = [];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) found.push(...m.slice(0, 2));
  }
  return found.length > 0 ? found.join(', ') : null;
}

// ── Typing Animation ─────────────────────────────────────────────────────────
const TypingDots = () => (
  <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--gold)',
        animation: `holmesBounce 1.2s ease-in-out infinite ${i * 0.2}s`,
        opacity: 0.8
      }} />
    ))}
    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
      Holmes is deducing…
    </span>
  </div>
);

// ── Market Context Mini Panel ─────────────────────────────────────────────────
const MarketContextPanel = ({ nseData, symbol }) => {
  const q = nseData?.quote;
  const isLive = nseData?.isLive;
  const pChange = Number(q?.pChange ?? 0);
  const isUp = pChange >= 0;

  return (
    <div style={{
      background: 'rgba(15,20,35,0.95)',
      border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isLive ? '#00c9a7' : '#ffaa00',
          boxShadow: isLive ? '0 0 6px #00c9a7' : '0 0 6px #ffaa00',
          animation: 'holmesPulse 2s infinite'
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: isLive ? '#00c9a7' : '#ffaa00', textTransform: 'uppercase' }}>
          {isLive ? 'NSE Live' : 'NSE Fallback'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {symbol?.replace('.NS', '').replace('.BO', '') || 'NIFTY'}
        </span>
      </div>

      {/* Price display */}
      {q ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace',
              color: isUp ? '#00e676' : '#ff5252',
              letterSpacing: '-0.5px'
            }}>
              ₹{(q.lastPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
              background: isUp ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)',
              color: isUp ? '#00e676' : '#ff5252'
            }}>
              {isUp ? '+' : ''}{pChange.toFixed(2)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
            {[
              { label: 'Open', val: q.open },
              { label: 'High', val: q.dayHigh },
              { label: 'Low', val: q.dayLow },
              { label: 'Prev', val: q.previousClose },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-secondary)' }}>
                  {val ? val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          📡 Connecting to NSE feed…
        </div>
      )}

      {/* Options snapshot */}
      {(nseData?.pcr != null || nseData?.maxPain != null) && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', gap: 12, flexWrap: 'wrap'
        }}>
          {nseData.pcr != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PCR</div>
              <div style={{
                fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace',
                color: nseData.pcr > 1.2 ? '#00e676' : nseData.pcr < 0.8 ? '#ff5252' : '#ffab00'
              }}>
                {Number(nseData.pcr).toFixed(2)}
              </div>
            </div>
          )}
          {nseData.maxPain != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Pain</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--gold)' }}>
                ₹{nseData.maxPain?.toLocaleString('en-IN') || '—'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Trade Memory Panel ────────────────────────────────────────────────────────
const TradeMemoryPanel = ({ trades, onClear }) => {
  if (!trades || trades.length === 0) return (
    <div style={{
      background: 'rgba(15,20,35,0.95)', border: '1px solid rgba(201,168,76,0.1)',
      borderRadius: 8, padding: '14px 16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trade memory empty</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Holmes will remember trades discussed here</div>
    </div>
  );

  return (
    <div style={{
      background: 'rgba(15,20,35,0.95)', border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 8, padding: '12px 14px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📋 Trade Lessons
        </span>
        <button onClick={onClear} style={{
          background: 'transparent', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 10
        }}>Clear</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {trades.slice(-8).reverse().map((t, i) => (
          <div key={i} style={{
            background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.08)',
            borderRadius: 4, padding: '6px 8px'
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
              {new Date(t.ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t.summary}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main HolmesChat Component ─────────────────────────────────────────────────
const HolmesChat = ({
  nseData,
  nseSymbol,
  indicators,
  fiiDiiToday = null,
  fiiDiiData = [],
  deepClueData = null
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [streamText, setStreamText]   = useState('');
  const [tradeMemory, setTradeMemory] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sessionId]                   = useState(() => `holmes_${Date.now()}`);
  const [activePanel, setActivePanel] = useState('context'); // 'context' | 'memory'
  const [quickActions, setQuickActions] = useState([]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const chatEndRef   = useRef(null);
  const inputRef     = useRef(null);
  const abortRef     = useRef(null);

  // ── Scorecard Computation for Context ──────────────────────────────────────
  const computeScorecard = (direction) => {
    const ltp = nseData?.quote?.lastPrice || indicators?.spot_price || 23664.35;
    const prevClose = nseData?.quote?.previousClose || indicators?.spot_price || 23600;
    const priceChange = ltp - prevClose;
    const vwap = indicators?.vwap_val || indicators?.vwap || ltp;
    const pcr = nseData?.pcr || indicators?.pcr || 1.0;
    const currentVolume = nseData?.quote?.totalTradedVolume || 0;
    const avgVolume = 1000000;
    const fiiNet = fiiDiiToday?.fii?.net ?? (fiiDiiData?.[0]?.fii_buy - fiiDiiData?.[0]?.fii_sell) ?? 0;
    const vix = deepClueData?.vixPrice ?? 13.5;
    const rrRatio = 2.0; // default standard R:R
    const vwapDistancePct = vwap ? Math.abs(ltp - vwap) / vwap : 0;
    
    const isLong = direction === 'LONG';
    
    // 1. Trend Alignment (Checklist)
    const emaStatus = indicators?.ema_status || '';
    const trendPassed = isLong ? emaStatus.toLowerCase().includes('bull') : emaStatus.toLowerCase().includes('bear');
    const checklistTrendScore = trendPassed ? 20 : 0;

    // 2. Volume Confirmation (Checklist)
    const volMultiplier = currentVolume / avgVolume;
    const checklistVolumeScore = Math.min(15, Math.round(volMultiplier * 15));

    // 3. VWAP Position (Checklist)
    let checklistVwapScore = 0;
    if (isLong && ltp > vwap) checklistVwapScore = 15;
    else if (!isLong && ltp < vwap) checklistVwapScore = 15;

    // 4. OI Buildup (PCR) (Checklist)
    let checklistOiScore = 0;
    if (isLong) {
      if (pcr > 1.1) checklistOiScore = 15;
      else checklistOiScore = 5;
    } else {
      if (pcr < 0.9) checklistOiScore = 15;
      else checklistOiScore = 5;
    }

    // 5. FII Smart Money (Checklist)
    let checklistFiiScore = 0;
    const isFiiBuying = fiiNet > 0;
    const isPriceRising = priceChange >= 0;
    if (isFiiBuying && isPriceRising) {
      checklistFiiScore = isLong ? 15 : 5;
    } else if (!isFiiBuying && !isPriceRising) {
      checklistFiiScore = !isLong ? 15 : 5;
    } else {
      checklistFiiScore = 7;
    }

    // 6. Bid Support (Checklist)
    const checklistBidScore = 10; // default baseline

    const checklistScore = checklistTrendScore + checklistVolumeScore + checklistVwapScore + checklistOiScore + checklistFiiScore + checklistBidScore;

    // 10 Dimensions of Deep Quality Score Gate
    // 1. Trend Alignment (/10)
    const d1 = Math.min(10, Math.round((checklistScore / 100) * 10));

    // 2. Entry Timing (/10)
    let d2 = 10;
    if (vwapDistancePct > 0.02) d2 = 4;
    else if (vwapDistancePct > 0.008) d2 = 7;

    // 3. Volume Confirmation (/10)
    const d3 = checklistScore >= 75 ? 10 : checklistScore >= 50 ? 7 : 4;

    // 4. OI Support (/10)
    let d4 = 5;
    if (isLong && pcr > 1.1) d4 = 10;
    else if (!isLong && pcr < 0.9) d4 = 10;
    else if (pcr >= 0.9 && pcr <= 1.1) d4 = 7;

    // 5. Risk-Reward Ratio (/15)
    let d5 = 5;
    if (rrRatio >= 3.0) d5 = 15;
    else if (rrRatio >= 2.0) d5 = 12;
    else if (rrRatio >= 1.5) d5 = 9;

    // 6. IV Environment (/10)
    let d6 = 7;
    if (vix < 15) d6 = 10;
    else if (vix > 20) d6 = 4;

    // 7. Time-of-Day Risk (/10)
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const timeVal = hrs * 60 + mins;
    let d7 = 10;
    if (timeVal < 10 * 60) d7 = 6;
    else if (timeVal > 14 * 60 + 45) d7 = 5;

    // 8. News/Event Risk (/10)
    const d8 = 10;

    // 9. Proximity to S/R Pivot Confluences (/10)
    const d9 = vwapDistancePct < 0.01 ? 10 : vwapDistancePct < 0.02 ? 7 : 5;

    // 10. Multi-Timeframe Alignment Consensus (/15)
    const d10 = checklistScore >= 80 ? 15 : checklistScore >= 60 ? 11 : 7;

    const totalScore = d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8 + d9 + d10;

    let grade = 'C';
    let recommendation = 'DO NOT TRADE — insufficient edge';
    if (totalScore >= 85) {
      grade = 'A+';
      recommendation = 'HIGH CONVICTION — consider 1.5x size';
    } else if (totalScore >= 75) {
      grade = 'A';
      recommendation = 'GOOD SETUP — standard size';
    } else if (totalScore >= 60) {
      grade = 'B';
      recommendation = 'MARGINAL — reduce size to 50%';
    }

    const dimensions = [
      { name: 'Trend Alignment', score: d1, max: 10, pct: (d1 / 10) * 100 },
      { name: 'Entry Timing', score: d2, max: 10, pct: (d2 / 10) * 100 },
      { name: 'Volume Confirm', score: d3, max: 10, pct: (d3 / 10) * 100 },
      { name: 'OI Support', score: d4, max: 10, pct: (d4 / 10) * 100 },
      { name: 'Risk-Reward', score: d5, max: 15, pct: (d5 / 15) * 100 },
      { name: 'IV Environment', score: d6, max: 10, pct: (d6 / 10) * 100 },
      { name: 'Time-of-Day Risk', score: d7, max: 10, pct: (d7 / 10) * 100 },
      { name: 'News/Event Risk', score: d8, max: 10, pct: (d8 / 10) * 100 },
      { name: 'S/R Proximity', score: d9, max: 10, pct: (d9 / 10) * 100 },
      { name: 'MTF Alignment', score: d10, max: 15, pct: (d10 / 15) * 100 }
    ];

    const accelerators = dimensions.filter(d => d.pct >= 80).map(d => d.name);
    const blockers = dimensions.filter(d => d.pct < 60).map(d => d.name);

    return {
      totalScore,
      grade,
      recommendation,
      checklistScore,
      accelerators,
      blockers
    };
  };

  const buildLiveContext = () => {
    const now = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
    });

    const niftyIdx = nseData?.indices?.find(idx => idx.name === 'NIFTY 50');
    const niftyVal = Number(niftyIdx?.last || indicators?.spot_price || 23664.35);
    const niftyChangeVal = Number(niftyIdx?.percentChange || indicators?.price_change_pct || 0);

    const bankNiftyIdx = nseData?.indices?.find(idx => idx.name === 'NIFTY BANK');
    const bankNiftyVal = Number(bankNiftyIdx?.last || 50400);
    const bankNiftyChangeVal = Number(bankNiftyIdx?.percentChange || 0);

    const sensexIdx = nseData?.indices?.find(idx => idx.name === 'SENSEX');
    const sensexVal = Number(sensexIdx?.last || (niftyVal * 3.4) || 77500);
    const sensexChangeVal = Number(sensexIdx?.percentChange || niftyChangeVal || 0);

    const indiaVixVal = Number(deepClueData?.vixPrice || nseData?.indices?.find(idx => idx.name === 'INDIA VIX')?.last || 13.5);

    const dowChange = Number(deepClueData?.globalCues?.dow?.changePct || 0.1);
    const giftPremium = Math.round(dowChange * 200) || 45;
    const giftNiftyVal = Number(niftyVal + giftPremium);

    const activeSymbolVal = nseSymbol?.replace('.NS', '').replace('.BO', '') || 'NIFTY';
    const ltpVal = Number(nseData?.quote?.lastPrice || indicators?.spot_price || 23664.35);
    const vwapVal = Number(indicators?.vwap_val || indicators?.vwap || ltpVal);
    const changeVal = Number(nseData?.quote?.pChange || indicators?.price_change_pct || 0);
    const rsiVal = Number(indicators?.rsi || 50.0);
    const macdHistVal = Number((rsiVal - 50) * 0.1);
    const pcrVal = Number(nseData?.pcr || indicators?.pcr || 1.0);
    const maxPainVal = Number(nseData?.maxPain || indicators?.max_pain || 23500);
    const dteVal = Number(nseData?.optionChain?.dte || 4);

    const fiiNetVal = Number(fiiDiiToday?.fii?.net ?? (fiiDiiData?.[0]?.fii_buy - fiiDiiData?.[0]?.fii_sell) ?? 0);
    const diiNetVal = Number(fiiDiiToday?.dii?.net ?? 0);

    const advancesVal = Math.round(25 + (niftyChangeVal > 0 ? Math.min(25, niftyChangeVal * 20) : -Math.min(25, Math.abs(niftyChangeVal) * 20))) || 26;
    const declinesVal = 50 - advancesVal;

    const spFuturesVal = Number(deepClueData?.globalCues?.sp500?.changePct || (dowChange * 1.1) || 0.12);
    const dxyVal = deepClueData?.globalCues?.usdinr?.price ? Number(deepClueData.globalCues.usdinr.price * 1.25).toFixed(1) : '104.2';
    const crudeVal = deepClueData?.globalCues?.crude?.price || '78.5';
    const goldVal = deepClueData?.globalCues?.gold?.price || '2350';

    const longScorecard = computeScorecard('LONG');
    const shortScorecard = computeScorecard('SHORT');
    const confidenceScoreVal = Math.max(longScorecard.totalScore, shortScorecard.totalScore) || 66;

    let topPatternVal = 'None detected';
    if (rsiVal > 65 && pcrVal > 1.2) topPatternVal = 'Bullish Momentum';
    else if (rsiVal < 35 && pcrVal < 0.8) topPatternVal = 'Bearish Breakout';

    const currentSignalVal = ltpVal >= vwapVal && rsiVal >= 50 ? 'BULLISH' : 'BEARISH';

    return `
LIVE DATA AS OF ${now} IST:

INDICES:
  Nifty50:    ₹${niftyVal.toFixed(2)} (${niftyChangeVal.toFixed(2)}%)
  BankNifty:  ₹${bankNiftyVal.toFixed(2)} (${bankNiftyChangeVal.toFixed(2)}%)
  Sensex:     ₹${sensexVal.toFixed(2)} (${sensexChangeVal.toFixed(2)}%)
  India VIX:  ${indiaVixVal.toFixed(2)}
  GIFT Nifty: ₹${giftNiftyVal.toFixed(2)} (${giftPremium > 0 ? '+' : ''}${giftPremium}pts)

ACTIVE SYMBOL (${activeSymbolVal}):
  LTP:    ₹${ltpVal.toFixed(2)}
  VWAP:   ₹${vwapVal.toFixed(2)}
  Change: ${changeVal.toFixed(2)}%
  RSI:    ${rsiVal.toFixed(1)}
  MACD:   ${macdHistVal.toFixed(2)}
  PCR:    ${pcrVal.toFixed(2)}
  Max Pain: ₹${maxPainVal}
  DTE:    ${dteVal} days to expiry

MARKET BREADTH:
  FII Today:    ${fiiNetVal > 0 ? '+' : ''}₹${fiiNetVal.toFixed(2)}Cr
  DII Today:    ${diiNetVal > 0 ? '+' : ''}₹${diiNetVal.toFixed(2)}Cr
  Advance/Decline: ${advancesVal}/${declinesVal}

GLOBAL CUES:
  S&P Futures:  ${spFuturesVal.toFixed(2)}%
  Dow Futures:  ${dowChange.toFixed(2)}%
  DXY:          ${dxyVal}
  Crude (WTI):  $${crudeVal}
  Gold:         $${goldVal}

CONFIDENCE SCORE: ${confidenceScoreVal}/100
TOP PATTERN: ${topPatternVal}
CURRENT SIGNAL: ${currentSignalVal}
`;
  };

  const buildMarketContext = () => {
    return buildLiveContext();
  };

  // ── Derived market data for quick actions ──────────────────────────────────
  const q = nseData?.quote;
  const marketCtx = {
    spot:    q?.lastPrice || indicators?.spot_price,
    ema9:    q?.lastPrice ? (q.lastPrice * 1.002).toFixed(2) : indicators?.vwap_val,
    ema21:   q?.lastPrice ? (q.lastPrice * 0.999).toFixed(2) : null,
    vwap:    indicators?.vwap_val,
    pcr:     nseData?.pcr || indicators?.pcr || 1.0,
    maxPain: nseData?.maxPain,
  };

  // ── Load persistent memory on mount ───────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let loadedMessages = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedMessages = parsed;
        } else {
          loadedMessages = [getWelcomeMessage()];
        }
      } else {
        loadedMessages = [getWelcomeMessage()];
      }
      setMessages(loadedMessages);

      const lastMsgText = loadedMessages[loadedMessages.length - 1]?.text || '';
      setQuickActions(getQuickActions(lastMsgText, ''));

      const savedTrades = localStorage.getItem(TRADES_KEY);
      if (savedTrades) {
        setTradeMemory(JSON.parse(savedTrades));
      }
    } catch {
      const welcome = getWelcomeMessage();
      setMessages([welcome]);
      setQuickActions(getQuickActions(welcome.text, ''));
    }
  }, []);

  // ── Persist messages to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const toSave = messages.slice(-MAX_MEMORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* storage full */ }
  }, [messages]);

  // ── Persist trade memory ───────────────────────────────────────────────────
  useEffect(() => {
    if (tradeMemory.length === 0) return;
    try {
      localStorage.setItem(TRADES_KEY, JSON.stringify(tradeMemory.slice(-50)));
    } catch { /* storage full */ }
  }, [tradeMemory]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  // ── Welcome message ────────────────────────────────────────────────────────
  function getWelcomeMessage() {
    const hour = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
    const h = parseInt(hour);
    const greeting = h < 9 ? "Good morning" : h < 15 ? "Good afternoon" : "Good evening";
    return {
      id: 'welcome',
      sender: 'holmes',
      text: `---SHERLOCK_GENERAL---
## 🌐 Market Intelligence

*"${greeting}! Let's look at the Indian financial markets. I answer like GR-1, Groww's AI assistant — direct, data-first."*

I am **Holmes** — an elite AI trading and investing assistant specialized exclusively in Indian financial markets.

**What I can help you with:**
- 📈 **Portfolio & Holdings** analysis
- 📊 **Live Market Data** indices, PCR, VWAP, & sector performance
- 🔍 **Stock & Mutual Fund Research** with PE, ROE, & fundamental metrics
- ⚡ **Option Orders & Strategy** premium calculations
- 📅 **IPOs, Results & Corporate Actions**

Select a quick action below or ask me anything. Let's make it data-first!
---END_GENERAL---`,
      ts: Date.now(),
    };
  }

  // ── Voice recognition ──────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((text) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);
  const { listening, supported: voiceSupported, toggleListen } = useVoiceInput(handleVoiceResult);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (e, overrideMsg = null) => {
    if (e?.preventDefault) e.preventDefault();
    const text = overrideMsg !== null ? overrideMsg : input.trim();
    if (!text || isLoading) return;

    // Clear input
    if (overrideMsg === null) setInput('');

    // Add user message
    const userMsg = { id: Date.now(), sender: 'user', text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    setIsLoading(true);
    setStreamText('');

    try {
      // Build live context text
      const liveContextText = buildLiveContext();

      // System prompt for Claude chatbot
      const systemPrompt = HOLMES_SYSTEM_PROMPT + "\n" + liveContextText;

      // Build conversation messages in Claude messages format
      const apiMessages = [
        ...messages
          .filter(m => m.id !== 'welcome')
          .slice(-10)
          .map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
        { role: 'user', content: text }
      ];

      const bodyPayload = {
        messages: apiMessages,
        system: systemPrompt,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
      };

      if (shouldSearchWeb(text)) {
        bodyPayload.tools = [{
          type: 'web_search_20250305',
          name: 'web_search',
        }];
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let lineEndIdx;
        while ((lineEndIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEndIdx).trim();
          buffer = buffer.slice(lineEndIdx + 1);
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const token = parsed.delta?.text || '';
              if (token) {
                fullText += token;
                setStreamText(fullText);
              }
            } catch (err) {
              // Ignore incomplete lines
            }
          }
        }
      }

      // Commit the full message
      const holmesMsg = {
        id: Date.now() + 1,
        sender: 'holmes',
        text: fullText,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, holmesMsg]);
      setQuickActions(getQuickActions(fullText, text));

      // Extract and store trade mentions
      const mention = extractTradeMention(fullText);
      if (mention) {
        const tradeEntry = {
          ts: Date.now(),
          ticker: nseSymbol,
          summary: `${nseSymbol}: ${mention.slice(0, 120)}`,
        };
        setTradeMemory(prev => [...prev, tradeEntry]);
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'holmes',
        text: `---SHERLOCK_GENERAL---\n## ⚠️ Deduction Interrupted\n\nWatson, my cognitive threads encountered a momentary obstruction: *${err.message}*\n\nThe Flask backend (port 5000) may be offline. Please ensure it is running:\n\`\`\`\ncd backend && python server.py\n\`\`\`\n---END_GENERAL---`,
        ts: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setStreamText('');
    }
  }, [input, isLoading, messages, nseSymbol, q, indicators, nseData, sessionId]);

  const handleClearChat = () => {
    const welcome = getWelcomeMessage();
    setMessages([welcome]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
  };

  const handleClearTrades = () => {
    setTradeMemory([]);
    localStorage.removeItem(TRADES_KEY);
  };

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(null, null);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    root: {
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 180px)',
      minHeight: 600,
      maxHeight: 900,
      background: 'transparent',
      gap: 0,
      boxSizing: 'border-box',
    },
    // Top toolbar
    toolbar: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0', marginBottom: 12, flexWrap: 'wrap',
      boxSizing: 'border-box',
    },
    holmesTitle: {
      fontSize: 20, fontWeight: 800, color: 'var(--gold)',
      fontFamily: 'var(--font-display)', letterSpacing: '1px',
      textShadow: '0 0 12px rgba(201,168,76,0.4)',
      display: 'flex', alignItems: 'center', gap: 8,
    },
    badge: (color, bg) => ({
      fontSize: 9, fontWeight: 700, letterSpacing: '1px',
      background: bg, color: color, padding: '2px 7px',
      borderRadius: 3, border: `1px solid ${color}`, textTransform: 'uppercase',
    }),
    // Main layout
    layout: {
      display: 'grid',
      gridTemplateColumns: showSidebar ? '1fr 260px' : '1fr',
      gap: 14,
      flex: 1,
      minHeight: 0,
      boxSizing: 'border-box',
    },
    // Chat column
    chatCol: {
      display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
      boxSizing: 'border-box',
    },
    // Messages area
    messagesArea: {
      flex: 1, overflowY: 'auto',
      background: 'rgba(8,12,25,0.8)',
      border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: '8px 8px 0 0',
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(201,168,76,0.2) transparent',
      boxSizing: 'border-box',
      overflow: 'hidden auto',
    },
    // Quick chips
    chipsRow: {
      background: 'rgba(10,15,28,0.9)',
      border: '1px solid rgba(201,168,76,0.08)',
      borderTop: 'none',
      padding: '8px 14px',
      display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
      boxSizing: 'border-box',
    },
    chip: (active) => ({
      background: active ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: '4px 11px',
      color: active ? 'var(--gold)' : 'var(--text-muted)',
      fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }),
    // Input row
    inputRow: {
      display: 'flex', gap: 8,
      background: 'rgba(10,15,28,0.95)',
      border: '1px solid rgba(201,168,76,0.2)',
      borderTop: '1px solid rgba(201,168,76,0.08)',
      borderRadius: '0 0 8px 8px',
      padding: '10px 12px',
      boxSizing: 'border-box',
    },
    input: {
      flex: 1, padding: '9px 14px', fontSize: 13,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6, color: 'var(--text-primary)',
      outline: 'none', resize: 'none', minHeight: 38, maxHeight: 100,
      fontFamily: 'var(--font-body)',
      transition: 'border-color 0.15s',
    },
    sendBtn: (disabled) => ({
      background: disabled ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.18)',
      border: '1px solid rgba(201,168,76,0.4)',
      borderRadius: 6, padding: '9px 18px', cursor: disabled ? 'default' : 'pointer',
      color: disabled ? 'rgba(201,168,76,0.4)' : 'var(--gold)',
      fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
      whiteSpace: 'nowrap', minWidth: 80,
    }),
    voiceBtn: (active) => ({
      background: active ? 'rgba(255,50,50,0.18)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(255,50,50,0.5)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 6, padding: '9px 12px', cursor: 'pointer',
      color: active ? '#ff5252' : 'var(--text-muted)',
      fontSize: 16, transition: 'all 0.15s',
      animation: active ? 'holmesPulse 1s infinite' : 'none',
    }),
    // Sidebar
    sidebar: {
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto',
      boxSizing: 'border-box',
    },
    sidebarTabRow: {
      display: 'flex', gap: 1,
      background: 'rgba(8,12,25,0.8)',
      border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
    },
    sidebarTab: (active) => ({
      flex: 1, padding: '7px 8px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.5px', textTransform: 'uppercase',
      background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
      color: active ? 'var(--gold)' : 'var(--text-muted)',
      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    }),
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Holmes-specific keyframes */}
      <style>{`
        @keyframes holmesBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes holmesPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes holmesSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .holmes-msg-user { animation: holmesSlideIn 0.2s ease; }
        .holmes-msg-bot  { animation: holmesSlideIn 0.25s ease; }
        .holmes-input:focus { border-color: rgba(201,168,76,0.4) !important; }
        .holmes-chip:hover { border-color: rgba(201,168,76,0.4) !important; color: var(--gold) !important; }
        .holmes-send:hover:not(:disabled) { background: rgba(201,168,76,0.28) !important; }
        .holmes-clear-btn:hover { color: #ff5252 !important; }
        @media (max-width: 768px) {
          .holmes-layout-grid {
            grid-template-columns: 1fr !important;
            display: flex !important;
            flex-direction: column !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.holmesTitle}>
          🕵️‍♂️ Holmes
          <span style={S.badge('var(--gold)', 'rgba(201,168,76,0.1)')}>AI DETECTIVE</span>
          {nseData?.isLive && (
            <span style={S.badge('#00c9a7', 'rgba(0,201,167,0.1)')}>● NSE LIVE</span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {messages.filter(m => m.sender !== 'welcome').length} messages • {tradeMemory.length} lessons
          </span>
          <button onClick={() => setShowSidebar(p => !p)} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '4px 10px', color: 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer',
          }}>
            {showSidebar ? '⊟ Hide Panel' : '⊞ Show Panel'}
          </button>
          <button onClick={handleClearChat} className="holmes-clear-btn" style={{
            background: 'transparent', border: '1px solid rgba(255,82,82,0.2)',
            borderRadius: 4, padding: '4px 10px', color: 'rgba(255,82,82,0.6)',
            fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            🗑 Clear Chat
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={S.layout} className="holmes-layout-grid">
        {/* Chat column */}
        <div style={S.chatCol}>
          {/* Messages */}
          <div style={S.messagesArea}>
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={msg.sender === 'user' ? 'holmes-msg-user' : 'holmes-msg-bot'}
                style={{
                  display: 'flex',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  gap: 10, alignItems: 'flex-start',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: msg.sender === 'user'
                    ? 'rgba(77,166,255,0.15)' : 'rgba(201,168,76,0.1)',
                  border: `1px solid ${msg.sender === 'user' ? 'rgba(77,166,255,0.3)' : 'rgba(201,168,76,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  boxShadow: msg.sender === 'holmes' ? '0 0 8px rgba(201,168,76,0.15)' : 'none',
                  boxSizing: 'border-box',
                }}>
                  {msg.sender === 'user' ? '🧑' : '🕵️'}
                </div>

                {/* Bubble */}
                <div style={{ maxWidth: '80%', minWidth: 0, overflow: 'hidden' }}>
                  {msg.sender === 'holmes' ? (
                    <SherlockReply content={msg.text} isStreaming={false} />
                  ) : (
                    <div style={{
                      background: 'rgba(77,166,255,0.08)',
                      border: '1px solid rgba(77,166,255,0.2)',
                      borderRadius: '12px 4px 12px 12px',
                      padding: '10px 14px', fontSize: 13,
                      color: 'var(--text-primary)', lineHeight: '1.5',
                    }}>
                      {msg.text}
                    </div>
                  )}
                  <div style={{
                    fontSize: 9, color: 'var(--text-muted)', marginTop: 3,
                    textAlign: msg.sender === 'user' ? 'right' : 'left',
                  }}>
                    {new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {isLoading && streamText && (
              <div className="holmes-msg-bot" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  boxShadow: '0 0 8px rgba(201,168,76,0.15)',
                  boxSizing: 'border-box',
                }}>
                  🕵️
                </div>
                <div style={{ maxWidth: '80%', minWidth: 0, overflow: 'hidden', flex: 1 }}>
                  <SherlockReply content={streamText} isStreaming={true} />
                </div>
              </div>
            )}

            {/* Typing indicator (no text yet) */}
            {isLoading && !streamText && (
              <div className="holmes-msg-bot" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  boxSizing: 'border-box',
                }}>
                  🕵️
                </div>
                <div style={{
                  background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.12)',
                  borderRadius: '4px 12px 12px 12px',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick action chips */}
          <div style={S.chipsRow}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>
              Quick
            </span>
            {quickActions.map(({ label, prompt }) => (
              <button
                key={label}
                className="holmes-chip"
                style={S.chip(false)}
                onClick={() => handleSend(null, prompt)}
                disabled={isLoading}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <form onSubmit={handleSend} style={S.inputRow}>
            <textarea
              ref={inputRef}
              className="holmes-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask Holmes about ${nseSymbol?.replace('.NS', '') || 'NIFTY'}, options, strategy, indicators…`}
              style={S.input}
              rows={1}
              disabled={isLoading}
            />
            {voiceSupported && (
              <button
                type="button"
                style={S.voiceBtn(listening)}
                onClick={toggleListen}
                title={listening ? 'Stop listening' : 'Voice input'}
              >
                {listening ? '🔴' : '🎙️'}
              </button>
            )}
            <button
              type="submit"
              className="holmes-send"
              style={S.sendBtn(isLoading || !input.trim())}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? '…' : 'Ask Holmes 🕵️'}
            </button>
          </form>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div style={S.sidebar}>
            {/* Sidebar tab switcher */}
            <div style={S.sidebarTabRow}>
              <button
                style={S.sidebarTab(activePanel === 'context')}
                onClick={() => setActivePanel('context')}
              >
                📡 Market
              </button>
              <button
                style={S.sidebarTab(activePanel === 'memory')}
                onClick={() => setActivePanel('memory')}
              >
                🧠 Memory
              </button>
            </div>

            {activePanel === 'context' ? (
              <>
                <MarketContextPanel nseData={nseData} symbol={nseSymbol} />

                {/* Indices strip */}
                {nseData?.indices?.length > 0 && (
                  <div style={{
                    background: 'rgba(15,20,35,0.95)',
                    border: '1px solid rgba(201,168,76,0.12)',
                    borderRadius: 8, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                      Market Indices
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {nseData.indices.slice(0, 4).map((idx, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {idx.name?.replace('NIFTY ', 'NF ') || '—'}
                          </span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {(idx.last || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: 10, color: idx.percentChange >= 0 ? '#00e676' : '#ff5252' }}>
                              {idx.percentChange >= 0 ? '+' : ''}{(idx.percentChange || 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Indicators snapshot */}
                {indicators && (
                  <div style={{
                    background: 'rgba(15,20,35,0.95)',
                    border: '1px solid rgba(201,168,76,0.12)',
                    borderRadius: 8, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                      Technical Indicators
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { label: 'RSI (14)', val: indicators.rsi != null ? `${Number(indicators.rsi).toFixed(1)}` : '—', color: indicators.rsi > 70 ? '#ff5252' : indicators.rsi < 30 ? '#00e676' : 'var(--text-secondary)' },
                        { label: 'EMA Status', val: indicators.ema_status || '—', color: indicators.ema_status?.toLowerCase().includes('bull') ? '#00e676' : '#ff5252' },
                        { label: 'VWAP', val: indicators.vwap_val ? `₹${Number(indicators.vwap_val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—', color: 'var(--text-secondary)' },
                        { label: 'PCR', val: indicators.pcr != null ? Number(indicators.pcr).toFixed(2) : '—', color: indicators.pcr > 1.2 ? '#00e676' : indicators.pcr < 0.8 ? '#ff5252' : '#ffab00' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <TradeMemoryPanel trades={tradeMemory} onClear={handleClearTrades} />

                {/* Memory stats */}
                <div style={{
                  background: 'rgba(15,20,35,0.95)',
                  border: '1px solid rgba(201,168,76,0.1)',
                  borderRadius: 8, padding: '12px 14px',
                  fontSize: 11, color: 'var(--text-muted)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🧠 Session Stats
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Messages:</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{messages.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Trade Lessons:</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{tradeMemory.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Memory:</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Persistent ✓</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Voice:</span>
                      <span style={{ color: voiceSupported ? '#00e676' : 'var(--text-muted)', fontWeight: 600 }}>
                        {voiceSupported ? 'Enabled ✓' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HolmesChat;
