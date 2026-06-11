"""
tick_engine.py — Market-Aware GBM Price Simulation Engine
==========================================================
Replaces the old `background_price_ticker()` in server.py.

Features:
- Checks IST market hours (09:15–15:30, Mon–Fri, excl. 2026 holidays)
- CLOSED  → Prices are FROZEN at last_close_price. Zero drift.
- OPEN    → Geometric Brownian Motion walk at 1–3 ticks/sec per asset.
            GBM formula: S(t+dt) = S(t) * exp((μ - σ²/2)dt + σ√dt·Z)
- Thread-safe shared price store for Flask endpoint consumption.
"""

import math
import random
import threading
import time
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ─── IST timezone ────────────────────────────────────────────────────────────
IST = timezone(timedelta(hours=5, minutes=30))

# NSE/BSE 2026 public holidays (weekdays only)
MARKET_HOLIDAYS_2026 = {
    "2026-01-26",  # Republic Day
    "2026-03-03",  # Holi
    "2026-03-26",  # Ram Navami
    "2026-03-31",  # Mahavir Jayanti
    "2026-04-03",  # Good Friday
    "2026-04-14",  # Ambedkar Jayanti
    "2026-05-01",  # Maharashtra Day
    "2026-05-28",  # Bakri Id
    "2026-06-26",  # Muharram
    "2026-09-14",  # Ganesh Chaturthi
    "2026-10-02",  # Gandhi Jayanti
    "2026-10-20",  # Dussehra
    "2026-11-10",  # Diwali Balipratipada
    "2026-11-24",  # Guru Nanak Jayanti
    "2026-12-25",  # Christmas
}

MARKET_OPEN_H, MARKET_OPEN_M   = 9, 15   # 09:15 IST
MARKET_CLOSE_H, MARKET_CLOSE_M = 15, 30  # 15:30 IST


def get_market_status() -> dict:
    """
    Returns the current Indian stock market status in IST.
    Returns dict: { status: 'OPEN'|'CLOSED', reason: str, ist_time: str }
    """
    now_ist = datetime.now(IST)
    weekday  = now_ist.weekday()          # 0=Mon … 6=Sun
    date_str = now_ist.strftime("%Y-%m-%d")
    hour     = now_ist.hour
    minute   = now_ist.minute

    # Weekend
    if weekday >= 5:
        day_name = "Saturday" if weekday == 5 else "Sunday"
        return {"status": "CLOSED", "reason": f"Weekend ({day_name})", "ist_time": now_ist.strftime("%H:%M:%S")}

    # Holiday
    if date_str in MARKET_HOLIDAYS_2026:
        return {"status": "CLOSED", "reason": f"Market Holiday ({date_str})", "ist_time": now_ist.strftime("%H:%M:%S")}

    # Pre-market / Post-market
    open_mins  = MARKET_OPEN_H  * 60 + MARKET_OPEN_M
    close_mins = MARKET_CLOSE_H * 60 + MARKET_CLOSE_M
    now_mins   = hour * 60 + minute

    if now_mins < open_mins:
        return {"status": "CLOSED", "reason": "Pre-market (before 09:15 IST)", "ist_time": now_ist.strftime("%H:%M:%S")}
    if now_mins >= close_mins:
        return {"status": "CLOSED", "reason": "Post-market (after 15:30 IST)", "ist_time": now_ist.strftime("%H:%M:%S")}

    return {"status": "OPEN", "reason": "Regular trading session", "ist_time": now_ist.strftime("%H:%M:%S")}


# ─── GBM Parameters per asset class ─────────────────────────────────────────
# Annual volatility σ and drift μ, scaled to per-second dt internally.
# ANNUALIZED values — engine converts to per-second automatically.
_ASSET_PARAMS = {
    "INDEX":   {"mu": 0.08,  "sigma": 0.15},   # NIFTY, BANKNIFTY
    "LARGECAP":{"mu": 0.10,  "sigma": 0.22},   # Nifty 50 stocks
    "MIDCAP":  {"mu": 0.12,  "sigma": 0.28},   # Nifty Midcap
    "SMALLCAP":{"mu": 0.14,  "sigma": 0.35},   # Nifty Smallcap
    "OPTIONS": {"mu": 0.00,  "sigma": 0.60},   # Option premiums (high vol)
}

TRADING_SECONDS_PER_YEAR = 252 * 6.25 * 3600   # 252 trading days × 6h15m


def _get_asset_class(ticker: str) -> str:
    """Classify an asset ticker into a GBM parameter bucket."""
    t = ticker.upper()
    if t.startswith("^") or t in ("NIFTY", "BANKNIFTY", "NIFTY50", "NIFTYBANK"):
        return "INDEX"
    if t.endswith("CE") or t.endswith("PE"):
        return "OPTIONS"
    # Simple heuristic — expand with DB lookup later
    nifty50 = {
        "RELIANCE","TCS","HDFCBANK","ICICIBANK","INFY","SBIN","BHARTIARTL",
        "HDFC","KOTAKBANK","ITC","LT","AXISBANK","MARUTI","BAJFINANCE",
        "TITAN","SUNPHARMA","ULTRACEMCO","ASIANPAINT","WIPRO","POWERGRID",
        "TATAMOTORS","ONGC","ADANIPORTS","TECHM","DIVISLAB","NESTLEIND",
        "HCLTECH","JSWSTEEL","TATASTEEL","NTPC","HINDALCO","BAJAJFINSV",
        "GRASIM","BPCL","COALINDIA","CIPLA","EICHERMOT","BRITANNIA","UPL",
        "DRREDDY","M&M","INDUSINDBK","HEROMOTOCO","APOLLOHOSP","TATACONSUM",
        "SBILIFE","HDFCLIFE","PIDILITIND","ADANIENT","BAJAJ-AUTO",
    }
    base = t.replace(".NS", "").replace(".BO", "")
    if base in nifty50:
        return "LARGECAP"
    return "MIDCAP"


# ─── TickEngine ──────────────────────────────────────────────────────────────

class TickEngine:
    """
    Singleton GBM-based price simulation engine.

    Usage:
        engine = TickEngine.get_instance()
        engine.register_asset("^NSEI", 24000.0)
        price = engine.get_price("^NSEI")
    """

    _instance = None
    _lock      = threading.Lock()

    @classmethod
    def get_instance(cls) -> "TickEngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def __init__(self):
        # price_store: { ticker -> { spot_price, prev_price, last_close_price,
        #                            next_tick_at, asset_class, last_fetch } }
        self._store: dict = {}
        self._store_lock  = threading.RLock()
        self._running     = False
        self._thread      = None

    # ── Public API ──────────────────────────────────────────────────────────

    def start(self):
        """Start the background tick loop."""
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._tick_loop, daemon=True, name="TickEngine")
        self._thread.start()
        logger.info("[TickEngine] Background GBM tick loop started.")

    def register_asset(self, ticker: str, initial_price: float):
        """
        Register or update an asset's base price.
        Call this whenever fresh OHLCV data is fetched from yfinance/mock.
        """
        with self._store_lock:
            if ticker not in self._store:
                self._store[ticker] = {
                    "spot_price":       initial_price,
                    "prev_price":       initial_price,
                    "last_close_price": initial_price,
                    "asset_class":      _get_asset_class(ticker),
                    "next_tick_at":     time.monotonic(),
                    "last_fetch":       time.time(),
                }
                logger.info(f"[TickEngine] Registered asset: {ticker} @ {initial_price}")
            else:
                # Only update last_close_price if price is meaningfully new
                existing = self._store[ticker]
                existing["last_close_price"] = initial_price
                existing["last_fetch"]        = time.time()

    def get_price(self, ticker: str) -> float | None:
        with self._store_lock:
            entry = self._store.get(ticker)
            return entry["spot_price"] if entry else None

    def get_entry(self, ticker: str) -> dict | None:
        with self._store_lock:
            entry = self._store.get(ticker)
            return dict(entry) if entry else None

    def get_all_prices(self) -> dict:
        with self._store_lock:
            return {t: e["spot_price"] for t, e in self._store.items()}

    # ── Internal tick loop ──────────────────────────────────────────────────

    def _tick_loop(self):
        """
        Runs every 100 ms. For each registered asset, checks whether it's time
        for its next tick and applies GBM or freezes based on market status.
        """
        while self._running:
            time.sleep(0.1)   # 100 ms granularity — precise per-asset scheduling

            mkt = get_market_status()
            market_open = (mkt["status"] == "OPEN")

            now = time.monotonic()

            with self._store_lock:
                for ticker, entry in self._store.items():
                    if not market_open:
                        # Market CLOSED — freeze at last_close_price, no drift
                        entry["prev_price"] = entry["spot_price"]
                        entry["spot_price"] = entry["last_close_price"]
                        continue

                    # Market OPEN — only tick when next_tick_at is reached
                    if now < entry["next_tick_at"]:
                        continue

                    # Apply GBM step
                    entry["prev_price"] = entry["spot_price"]
                    entry["spot_price"] = self._gbm_step(
                        entry["spot_price"],
                        entry["asset_class"]
                    )

                    # Schedule next tick: random 333ms – 1000ms (1–3 ticks/sec)
                    entry["next_tick_at"] = now + random.uniform(0.333, 1.0)

    @staticmethod
    def _gbm_step(price: float, asset_class: str) -> float:
        """
        One GBM tick:
          S_next = S * exp( (μ - σ²/2)·dt + σ·√dt·Z )
        where dt is the actual elapsed tick interval in years.
        """
        params = _ASSET_PARAMS.get(asset_class, _ASSET_PARAMS["MIDCAP"])
        mu    = params["mu"]
        sigma = params["sigma"]

        # Use a small representative dt (0.5 sec) for per-step calculation
        dt = 0.5 / TRADING_SECONDS_PER_YEAR

        Z       = random.gauss(0, 1)
        drift   = (mu - 0.5 * sigma ** 2) * dt
        diffuse = sigma * math.sqrt(dt) * Z

        new_price = price * math.exp(drift + diffuse)
        return round(new_price, 2)


# ─── Module-level singleton ──────────────────────────────────────────────────
# Import and call `tick_engine.start()` from server.py
tick_engine = TickEngine.get_instance()
