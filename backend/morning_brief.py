"""
SHERLOCK HOLMES PRE-MARKET MORNING BRIEF
Backend module: live data fetching via Node proxy, and AI/rule-based analysis.

Data sources (all server-side via Node proxy on port 3001):
  - /api/morning/market-data  →  Yahoo Finance: US indices, commodities, NSE, VIX, USDINR
  - /api/fiidii/today          →  NSE: FII/DII net buy/sell
  - Google News RSS            →  Free live financial headlines

Fallback to last-known values only when Node proxy is completely unreachable.
"""
import logging
import requests
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from backend.ai_client import call_llm

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
#  LAST-RESORT FALLBACKS (used ONLY if Node proxy is DOWN)
# ─────────────────────────────────────────────

_FALLBACK_GLOBAL = {
    "dow":    {"price": 0, "change": 0, "change_pct": 0},
    "sp500":  {"price": 0, "change": 0, "change_pct": 0},
    "nasdaq": {"price": 0, "change": 0, "change_pct": 0},
}
_FALLBACK_COMMODITIES = {
    "crude": {"price": 0, "change_pct": 0},
    "gold":  {"price": 0, "change_pct": 0},
}
_FALLBACK_NSE = {
    "nifty_current":    0,
    "banknifty_current": 0,
    "sgx_nifty":        0,
    "sgx_change_pct":   0,
    "usdinr":           0,
    "usdinr_change_pct": 0,
    "vix":              0,
    "vix_change_pct":   0,
    "fii_dii": {"fii_net": 0, "dii_net": 0, "date": ""},
}
_FALLBACK_NEWS: List[Dict] = []

# Shared session for all proxy calls
_SESSION = requests.Session()
_SESSION.headers.update({"Accept": "application/json"})

NODE_PROXY = "http://localhost:3001"


# ─────────────────────────────────────────────
#  LIVE DATA FETCHING (via Node proxy)
# ─────────────────────────────────────────────

def _proxy_get(path: str, timeout: int = 6) -> Optional[Dict]:
    """Fetch JSON from Node proxy with graceful failure."""
    try:
        resp = _SESSION.get(f"{NODE_PROXY}{path}", timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Node proxy GET {path} failed: {e}")
    return None


def fetch_all_market_data() -> Dict:
    """
    Fetch the single /api/morning/market-data endpoint from Node proxy.
    This returns: global (dow/sp500/nasdaq), commodities (crude/gold),
    india (nifty_current, sgx_nifty, vix, usdinr).
    """
    data = _proxy_get("/api/morning/market-data", timeout=10)
    if data and data.get("global", {}).get("dow", {}).get("price", 0) > 0:
        return data
    logger.warning("Morning market data from Node proxy returned no price — using fallback.")
    return {
        "global":      _FALLBACK_GLOBAL,
        "commodities": _FALLBACK_COMMODITIES,
        "india":       _FALLBACK_NSE,
    }


def fetch_fii_dii() -> Dict:
    """Fetch today's FII/DII from Node proxy."""
    data = _proxy_get("/api/fiidii/today", timeout=6)
    if data and "fii" in data:
        return {
            "fii_net": float(data["fii"].get("net", 0)),
            "dii_net": float(data["dii"].get("net", 0)),
            "date":    data.get("date", ""),
        }
    return {"fii_net": 0, "dii_net": 0, "date": ""}


def fetch_news() -> List[Dict]:
    """
    Fetch live Indian financial news from Google News RSS (no API key needed).
    Falls back to an empty list if unavailable.
    """
    feeds = [
        "https://news.google.com/rss/search?q=India+stock+market+Nifty+NSE&hl=en-IN&gl=IN&ceid=IN:en",
        "https://news.google.com/rss/search?q=FII+DII+Nifty+market+outlook&hl=en-IN&gl=IN&ceid=IN:en",
        "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
    ]

    articles: List[Dict] = []
    seen_titles = set()

    for feed_url in feeds:
        if len(articles) >= 6:
            break
        try:
            resp = requests.get(feed_url, timeout=5, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SherlockBot/1.0)"
            })
            if resp.status_code != 200:
                continue
            root = ET.fromstring(resp.content)
            items = root.findall(".//item")
            for item in items[:4]:
                title = (item.findtext("title") or "").strip()
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)
                pub_date = item.findtext("pubDate") or ""
                # Simple sentiment classification
                title_lower = title.lower()
                bullish_kws = ["surge", "rise", "gain", "rally", "jump", "bull", "record", "high", "positive", "inflow", "buy", "boost", "growth"]
                bearish_kws = ["fall", "drop", "decline", "sell", "crash", "weak", "outflow", "loss", "cut", "rate hike", "inflation", "bear", "down"]
                bullish_score = sum(1 for kw in bullish_kws if kw in title_lower)
                bearish_score = sum(1 for kw in bearish_kws if kw in title_lower)
                if bullish_score > bearish_score:
                    sentiment = "BULLISH"
                elif bearish_score > bullish_score:
                    sentiment = "BEARISH"
                else:
                    sentiment = "NEUTRAL"
                articles.append({
                    "title":     title,
                    "source":    "Google News",
                    "sentiment": sentiment,
                    "impact":    "",
                    "category":  "Market",
                    "pub_date":  pub_date,
                })
                if len(articles) >= 6:
                    break
        except Exception as e:
            logger.debug(f"News RSS fetch failed ({feed_url}): {e}")

    return articles if articles else _FALLBACK_NEWS


# ─────────────────────────────────────────────
#  RULE-BASED MORNING BRIEF GENERATOR
# ─────────────────────────────────────────────

def _sentiment(pct: float) -> str:
    if pct > 0.5:  return "BULLISH"
    if pct < -0.5: return "BEARISH"
    return "NEUTRAL"


def generate_rule_based_brief(market_data: Dict, news: List[Dict]) -> Dict:
    """High-quality deterministic morning brief as Sherlock Holmes."""
    now = datetime.now()

    global_data  = market_data.get("global", _FALLBACK_GLOBAL)
    commodities  = market_data.get("commodities", _FALLBACK_COMMODITIES)
    india        = market_data.get("india", _FALLBACK_NSE)
    fii_dii      = india.get("fii_dii", {"fii_net": 0, "dii_net": 0})

    dow    = global_data.get("dow",    {})
    sp500  = global_data.get("sp500",  {})
    nasdaq = global_data.get("nasdaq", {})
    crude  = commodities.get("crude",  {})
    gold   = commodities.get("gold",   {})

    dow_pct    = dow.get("change_pct", 0.0)
    sp_pct     = sp500.get("change_pct", 0.0)
    nas_pct    = nasdaq.get("change_pct", 0.0)
    fii_net    = fii_dii.get("fii_net", 0.0)
    dii_net    = fii_dii.get("dii_net", 0.0)
    nifty_prev = india.get("nifty_current", 0) or india.get("nifty_prev_close", 0)
    sgx_nifty  = india.get("sgx_nifty", nifty_prev)
    sgx_gap    = round(sgx_nifty - nifty_prev) if nifty_prev > 0 else 0

    # Count bullish/bearish signals
    bullish_signals = 0
    bearish_signals = 0
    if dow_pct > 0.3:    bullish_signals += 1
    elif dow_pct < -0.3: bearish_signals += 1
    if nas_pct > 0.3:    bullish_signals += 1
    elif nas_pct < -0.3: bearish_signals += 1
    if fii_net > 500:    bullish_signals += 1
    elif fii_net < -500: bearish_signals += 1
    if dii_net > 0:      bullish_signals += 1
    else:                bearish_signals += 1
    crude_pct = crude.get("change_pct", 0.0)
    if crude_pct < -1:   bullish_signals += 1   # lower crude = good for India
    elif crude_pct > 2:  bearish_signals += 1

    # Decide status and conviction
    if bullish_signals >= 4:
        market_status = "OPEN LONG"
        conviction = "HIGH" if bullish_signals >= 5 else "MEDIUM"
        global_bias = "BULLISH"
    elif bearish_signals >= 4:
        market_status = "OPEN SHORT"
        conviction = "HIGH" if bearish_signals >= 5 else "MEDIUM"
        global_bias = "BEARISH"
    elif bullish_signals > bearish_signals:
        market_status = "OPEN LONG"
        conviction = "MEDIUM"
        global_bias = "BULLISH"
    elif bearish_signals > bullish_signals:
        market_status = "OPEN SHORT"
        conviction = "MEDIUM"
        global_bias = "BEARISH"
    else:
        market_status = "STAY SIDELINED"
        conviction = "LOW"
        global_bias = "NEUTRAL"

    # Open direction
    if sgx_gap > 30:
        direction = "GAP UP"
    elif sgx_gap < -30:
        direction = "GAP DOWN"
    else:
        direction = "FLAT OPEN"

    # Support/Resistance
    support    = round(nifty_prev - 100 - (abs(sgx_gap) * 0.5)) if nifty_prev > 0 else 0
    resistance = round(nifty_prev + 100 + (abs(sgx_gap) * 0.5)) if nifty_prev > 0 else 0

    # Probability
    if conviction == "HIGH":    prob = "80% +"
    elif conviction == "MEDIUM": prob = "60-80%"
    else:                        prob = "<60%"

    # FII signal
    if fii_net > 1500:    fii_signal = "STRONG BUY"
    elif fii_net > 0:     fii_signal = "BUY"
    elif fii_net > -1500: fii_signal = "SELL"
    else:                 fii_signal = "STRONG SELL"

    # FII interpretation
    if fii_net > 0:
        fii_interp = (f"Watson, yesterday's FII bought a net ₹{abs(fii_net):,.0f} cr "
                      f"from the markets, showing strong foreign institutional conviction. "
                      f"This is highly predictive of today's upward price action.")
    elif fii_net < 0:
        fii_interp = (f"Watson, FII sold a net ₹{abs(fii_net):,.0f} cr yesterday, "
                      f"signalling institutional caution. DII support may absorb some selling pressure.")
    else:
        fii_interp = "Watson, FII/DII data is unavailable yet — await NSE publication post 6 PM."

    # Global interpretation
    if global_bias == "BULLISH":
        global_interp = (f"Dow {dow_pct:+.2f}%, Nasdaq {nas_pct:+.2f}% overnight — a risk-on session. "
                         f"Tech strength (Nasdaq) is positive for India IT stocks like TCS, Infosys, Wipro.")
    elif global_bias == "BEARISH":
        global_interp = (f"Dow {dow_pct:.2f}%, Nasdaq {nas_pct:.2f}% — risk-off overnight. "
                         f"Expect defensive positioning in Nifty. IT and metals may underperform at open.")
    else:
        global_interp = (f"Mixed global cues — Dow {dow_pct:+.2f}%, Nasdaq {nas_pct:+.2f}%. "
                         f"Nifty open will depend heavily on domestic FII/DII flow confirmation.")

    # Overnight catalyst (most important event from news)
    news_bullish = [n for n in news if n.get("sentiment") == "BULLISH"]
    news_bearish = [n for n in news if n.get("sentiment") == "BEARISH"]
    if news_bullish and global_bias == "BULLISH":
        catalyst = news_bullish[0]["title"]
    elif news_bearish and global_bias == "BEARISH":
        catalyst = news_bearish[0]["title"]
    elif news:
        catalyst = news[0]["title"]
    else:
        if sgx_gap != 0:
            catalyst = f"SGX Nifty suggests a {direction.lower()} of {abs(sgx_gap)} points."
        else:
            catalyst = "Awaiting overnight catalyst data."

    # Sectors in focus
    sectors = []
    rationale_parts = []
    if nas_pct > 0.5:
        sectors.append("IT")
        rationale_parts.append("IT benefits from Nasdaq strength (TCS, Infy, Wipro)")
    if crude_pct < -0.5:
        sectors.append("AVIATION")
        rationale_parts.append("Aviation benefits from crude oil weakness (lower ATF costs)")
    if fii_net > 1000:
        sectors.append("BANKING")
        rationale_parts.append("Banking receives largest FII weightage flows")
    if crude_pct > 1:
        sectors.append("OIL & GAS")
        rationale_parts.append("Oil & Gas benefits from crude price rise")
    if not sectors:
        sectors = ["BANKING", "IT", "AUTO"]
        rationale_parts = ["Diversified defensive positioning across index heavyweights"]

    # Intraday plan
    if nifty_prev > 0:
        open_est = nifty_prev + sgx_gap
    else:
        open_est = sgx_nifty if sgx_nifty > 0 else 24000
    if market_status == "OPEN LONG":
        entry_strategy = (f"Buy Nifty CE above {open_est + 20:,.0f} on breakout of 9:30 VWAP. "
                          f"Wait for first 15-minute candle to close above SGX gap level before entering.")
        first_target = open_est + 80
        stop_loss    = open_est - 40
        best_window  = "9:15-11:00 AM"
    elif market_status == "OPEN SHORT":
        entry_strategy = (f"Buy Nifty PE below {open_est - 20:,.0f} on breakdown of 9:30 VWAP. "
                          f"Wait for gap-fill confirmation before shorting into the weakness.")
        first_target = open_est - 80
        stop_loss    = open_est + 40
        best_window  = "9:15-11:00 AM"
    else:
        entry_strategy = ("Await first 30-minute price action. Do NOT initiate positions before 9:45 AM. "
                          "Look for range breakout setup after SGX gap levels are tested and confirmed.")
        first_target = open_est + 60
        stop_loss    = open_est - 40
        best_window  = "11:00 AM-2:00 PM"

    # Swing plan
    hold_longs = (market_status == "OPEN LONG" and fii_net > 0)
    add_on_weakness = (conviction in ("HIGH", "MEDIUM") and fii_net > 500)
    short_bias = (market_status == "OPEN SHORT" and bearish_signals >= 3)
    swing_reason = (
        f"Sustained FII buying (₹{fii_net:,.0f} cr) + positive global cues suggest holding longs "
        f"through the week. Trail stop at {support:,} on Nifty." if hold_longs else
        f"Mixed signals — FII net ₹{fii_net:,.0f} cr, globals {global_bias}. "
        f"Reduce position size and wait for clear directional confirmation."
    )

    # Red flags
    red_flags = []
    if abs(dow_pct) > 1 and _sentiment(fii_net / 100 if fii_net else 0) != _sentiment(dow_pct):
        red_flags.append("Conflicting FII vs US markets — wait for opening momentum before entering")
    if crude_pct > 2:
        red_flags.append(f"Crude oil up +{crude_pct:.1f}% — watch INR and auto/aviation sector impact")
    if conviction == "LOW":
        red_flags.append("Low conviction setup — reduce position size to 50% of normal")
    if nifty_prev == 0:
        red_flags.append("Live Nifty price unavailable — verify data before placing trades")
    if not red_flags:
        red_flags.append("No major red flags — clean setup with aligned signals")

    # Sherlock summary
    if market_status == "OPEN LONG" and conviction == "HIGH":
        summary = ("A clean LONG setup today — FII buying + positive US markets create high conviction. "
                   "Enter on VWAP breakout at open, target resistance with disciplined trailing stop.")
    elif market_status == "OPEN SHORT" and conviction == "HIGH":
        summary = ("A clear SHORT opportunity — US weakness + FII selling align bearishly. "
                   "Short the gap-up bounce or sell on opening range breakdown below VWAP.")
    elif market_status == "STAY SIDELINED":
        summary = ("Conflicting signals today — stay in cash until the market shows its hand after 9:45 AM. "
                   "Patience is the highest probability trade in ambiguous setups.")
    else:
        summary = (f"Moderate {market_status} setup with MEDIUM conviction — "
                   f"scale in with half position and add only on confirmation of SGX gap direction.")

    return {
        "briefing_time": now.strftime("%H:%M") + " IST",
        "date_display":  now.strftime("%A, %B %d, %Y"),
        "market_status": market_status,
        "conviction":    conviction,
        "nifty_open_prediction": {
            "direction":        direction,
            "expected_points":  sgx_gap,
            "support_level":    support,
            "resistance_level": resistance,
            "probability":      prob,
        },
        "overnight_catalyst":   catalyst,
        "fii_signal":           fii_signal,
        "fii_interpretation":   fii_interp,
        "global_bias":          global_bias,
        "global_interpretation": global_interp,
        "sectors_in_focus":     sectors[:3],
        "sector_rationale":     "; ".join(rationale_parts),
        "key_events_today":     [
            "NSE Open (9:15 AM)", "F&O Expiry check (if applicable)", "FII/DII data (EOD 6 PM)"
        ],
        "intraday_plan": {
            "timeframe":         "1-minute to 15-minute trades",
            "entry_strategy":    entry_strategy,
            "first_target":      first_target,
            "stop_loss":         stop_loss,
            "best_trading_window": best_window,
        },
        "swing_plan": {
            "hold_existing_longs": hold_longs,
            "add_on_weakness":     add_on_weakness,
            "short_bias":          short_bias,
            "target_days":         3,
            "reason":              swing_reason,
        },
        "red_flags":       red_flags,
        "sherlock_summary": summary,
        "next_update":     "After 10:30 AM when volume confirms the gap direction",
        "_raw": _build_raw(global_data, commodities, india, news),
    }


# ─────────────────────────────────────────────
#  OLLAMA AI CALL WITH FALLBACK
# ─────────────────────────────────────────────

MORNING_BRIEF_PROMPT = """You are Sherlock Holmes, pre-market analyst for Indian equity markets.

== LIVE MARKET DATA (do NOT hallucinate — use ONLY these numbers) ==
Time: {TIME} IST | Date: {DATE}
Dow Jones: {DOW_P:,.0f} ({DOW_PCT:+.2f}%) | S&P 500: {SP_P:,.0f} ({SP_PCT:+.2f}%) | Nasdaq: {NAS_P:,.0f} ({NAS_PCT:+.2f}%)
Crude Oil: ${CRUDE:.2f}/bbl ({CRUDE_PCT:+.2f}%) | Gold: ${GOLD:.2f}/oz ({GOLD_PCT:+.2f}%)
Nifty close yesterday: {NIFTY:,.0f} | SGX Nifty: {SGX:,.0f} ({SGX_GAP:+.0f} pts gap)
India VIX: {VIX:.2f} ({VIX_PCT:+.2f}%) | USD/INR: ₹{USDINR:.2f} ({USDINR_PCT:+.2f}%)
FII net: ₹{FII_NET:+,.0f} cr | DII net: ₹{DII_NET:+,.0f} cr
Key news: {NEWS}

CRITICAL RULES:
1. market_status MUST be consistent with the data above (e.g. if Dow < -0.5% AND FII sold heavily, do NOT say OPEN LONG)
2. conviction MUST be LOW if data is missing (price = 0) or signals conflict
3. Use ONLY the prices given above — do NOT invent any number

Return ONLY valid JSON with this structure (no markdown, no preamble):
{{
  "briefing_time": "{TIME} IST",
  "date_display": "{DATE}",
  "market_status": "OPEN LONG"|"OPEN SHORT"|"TAKE PROFIT / REDUCE"|"STAY SIDELINED",
  "conviction": "HIGH"|"MEDIUM"|"LOW",
  "nifty_open_prediction": {{
    "direction": "GAP UP"|"GAP DOWN"|"FLAT OPEN",
    "expected_points": <integer>,
    "support_level": <integer>,
    "resistance_level": <integer>,
    "probability": "80% +"|"60-80%"|"<60%"
  }},
  "overnight_catalyst": "<single most important event>",
  "fii_signal": "STRONG BUY"|"BUY"|"NEUTRAL"|"SELL"|"STRONG SELL",
  "fii_interpretation": "Watson, yesterday's FII ...",
  "global_bias": "BULLISH"|"NEUTRAL"|"BEARISH",
  "global_interpretation": "The overnight US/global moves suggest ...",
  "sectors_in_focus": ["SECTOR1","SECTOR2","SECTOR3"],
  "sector_rationale": "...",
  "key_events_today": ["Event1 (time)","Event2 (time)"],
  "intraday_plan": {{
    "timeframe": "1-minute to 15-minute trades",
    "entry_strategy": "...",
    "first_target": <integer>,
    "stop_loss": <integer>,
    "best_trading_window": "9:15-11:00 AM"|"11:00 AM-2:00 PM"|"2:00-3:30 PM"
  }},
  "swing_plan": {{
    "hold_existing_longs": true|false,
    "add_on_weakness": true|false,
    "short_bias": true|false,
    "target_days": <2-5>,
    "reason": "..."
  }},
  "red_flags": ["..."],
  "sherlock_summary": "...",
  "next_update": "..."
}}
"""


def get_morning_brief() -> Dict:
    """
    Fetch all real market data via Node proxy, call AI for brief, fall back to rule-based.
    Returns the complete brief dict plus raw market data.
    """
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_market = ex.submit(fetch_all_market_data)
        f_news   = ex.submit(fetch_news)
        market_data = f_market.result()
        news        = f_news.result()

    # Merge FII/DII into market_data.india
    fii_dii = fetch_fii_dii()
    market_data["india"]["fii_dii"] = fii_dii

    global_data = market_data.get("global", _FALLBACK_GLOBAL)
    commodities = market_data.get("commodities", _FALLBACK_COMMODITIES)
    india       = market_data.get("india", _FALLBACK_NSE)

    # Try AI brief first
    now      = datetime.now()
    news_txt = "; ".join([n["title"] for n in news[:3]]) or "No live news available"
    nifty    = india.get("nifty_current", 0)
    sgx      = india.get("sgx_nifty", nifty)

    prompt = MORNING_BRIEF_PROMPT.format(
        TIME     = now.strftime("%H:%M"),
        DATE     = now.strftime("%A, %B %d, %Y"),
        DOW_P    = global_data.get("dow",    {}).get("price",      0),
        DOW_PCT  = global_data.get("dow",    {}).get("change_pct", 0),
        SP_P     = global_data.get("sp500",  {}).get("price",      0),
        SP_PCT   = global_data.get("sp500",  {}).get("change_pct", 0),
        NAS_P    = global_data.get("nasdaq", {}).get("price",      0),
        NAS_PCT  = global_data.get("nasdaq", {}).get("change_pct", 0),
        CRUDE    = commodities.get("crude",  {}).get("price",      0),
        CRUDE_PCT= commodities.get("crude",  {}).get("change_pct", 0),
        GOLD     = commodities.get("gold",   {}).get("price",      0),
        GOLD_PCT = commodities.get("gold",   {}).get("change_pct", 0),
        NIFTY    = nifty,
        SGX      = sgx,
        SGX_GAP  = sgx - nifty,
        VIX      = india.get("vix",              0),
        VIX_PCT  = india.get("vix_change_pct",   0),
        USDINR   = india.get("usdinr",            0),
        USDINR_PCT = india.get("usdinr_change_pct", 0),
        FII_NET  = fii_dii.get("fii_net", 0),
        DII_NET  = fii_dii.get("dii_net", 0),
        NEWS     = news_txt,
    )

    try:
        raw_ai = call_llm(prompt, temperature=0.4, timeout=12)
        if raw_ai:
            raw_ai = re.sub(r"```json|```", "", raw_ai).strip()
            start_idx = raw_ai.find("{")
            end_idx   = raw_ai.rfind("}")
            if start_idx != -1 and end_idx != -1:
                raw_ai = raw_ai[start_idx:end_idx + 1]
            brief = json.loads(raw_ai)
            brief["_raw"] = _build_raw(global_data, commodities, india, news)
            return brief
    except Exception as e:
        logger.warning(f"AI morning brief failed: {e}. Using rule-based.")

    return generate_rule_based_brief(market_data, news)


def _build_raw(global_data, commodities, india, news):
    fii_dii = india.get("fii_dii", {})
    nifty   = india.get("nifty_current", 0)
    sgx     = india.get("sgx_nifty", nifty)
    return {
        "dow":              global_data.get("dow",    {}),
        "sp500":            global_data.get("sp500",  {}),
        "nasdaq":           global_data.get("nasdaq", {}),
        "crude":            commodities.get("crude",  {}),
        "gold":             commodities.get("gold",   {}),
        "nifty_current":    nifty,
        "sgx_nifty":        sgx,
        "sgx_gap":          sgx - nifty,
        "sgx_change_pct":   india.get("sgx_change_pct",   0),
        "usdinr":           india.get("usdinr",            0),
        "usdinr_change_pct": india.get("usdinr_change_pct", 0),
        "vix":              india.get("vix",              0),
        "vix_change_pct":   india.get("vix_change_pct",   0),
        "fii_net":          fii_dii.get("fii_net", 0),
        "dii_net":          fii_dii.get("dii_net", 0),
        "news":             news,
    }
