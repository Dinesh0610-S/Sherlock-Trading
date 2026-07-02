import logging
import os
import sys
import json

import requests
# Ensure workspace root is in path for backend imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request, Response
from flask_cors import CORS

from backend.data_loader import get_market_data, get_market_category, find_active_picker_candidates
from backend.indicators import calculate_technical_indicators, calculate_intraday_vwap
from backend.options_chain import get_options_chain, calculate_pcr_and_pain
from backend.ai_advisory import get_sherlock_verdict, get_sherlock_chat_response, get_sherlock_signal, validate_metrics_and_direction
from backend.database import (
    get_journal_entries, add_journal_entry, delete_journal_entry,
    save_open_trade, close_active_trade, get_trades, delete_trade,
    clear_trades, calculate_metrics
)
from backend.fii_dii import fetch_fii_dii_data, get_fii_dii_ai_verdict
from backend.morning_brief import get_morning_brief
from backend.backtester import (
    fetch_ohlcv, add_indicators, detect_signals, run_backtest, calc_stats, get_backtest_ai_analysis
)
from backend.tick_engine import tick_engine, get_market_status
from backend.stock_db import search_assets, get_fo_contracts, get_stock_count
from backend.init_stock_db import init_if_empty

import time

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Legacy LIVE_DATA dict — proxied to TickEngine for backward-compat ─────────
# Other endpoints still use LIVE_DATA[ticker]['spot_price'] etc.
# We keep the dict but populate it from the TickEngine store.
live_data_lock = tick_engine._store_lock

class _LiveDataProxy:
    """Thin proxy so existing code using LIVE_DATA[ticker] still works."""
    def __contains__(self, ticker):
        return tick_engine.get_entry(ticker) is not None

    def __getitem__(self, ticker):
        entry = tick_engine.get_entry(ticker)
        if entry is None:
            raise KeyError(ticker)
        return {
            'spot_price':       entry['spot_price'],
            'prev_spot_price':  entry['prev_price'],
            'base_spot_price':  entry['last_close_price'],
            'last_fetch':       entry['last_fetch'],
            'df_ind':           entry.get('df_ind'),
            'period':           entry.get('period', '5d'),
            'interval':         entry.get('interval', '15m'),
        }

    def __setitem__(self, ticker, data):
        """Called when market-data endpoint caches fresh OHLCV data."""
        spot = data.get('spot_price', 0.0)
        tick_engine.register_asset(ticker, spot)
        # Store extra fields (df_ind, period, interval) directly in engine store
        with tick_engine._store_lock:
            if ticker in tick_engine._store:
                tick_engine._store[ticker]['df_ind']   = data.get('df_ind')
                tick_engine._store[ticker]['period']   = data.get('period', '5d')
                tick_engine._store[ticker]['interval'] = data.get('interval', '15m')

    def get(self, ticker, default=None):
        try:
            return self[ticker]
        except KeyError:
            return default

LIVE_DATA = _LiveDataProxy()

# ── Start GBM Tick Engine ─────────────────────────────────────────────────────
tick_engine.start()
logger.info("[Server] GBM TickEngine started.")

# ── Initialize asset universe DB (no-op if already populated) ─────────────────
try:
    init_if_empty()
except Exception as e:
    logger.warning(f"[Server] Asset universe init warning: {e}")

app = Flask(__name__)
CORS(app)  # Enable CORS for development flexibility

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def get_node_proxy_quote(ticker):
    symbol_map = {
        '^NSEI': 'NIFTY', '^NSEBANK': 'BANKNIFTY', 'RELIANCE.NS': 'RELIANCE',
        'HDFCBANK.NS': 'HDFCBANK', 'TCS.NS': 'TCS', 'INFY.NS': 'INFY',
        'ICICIBANK.NS': 'ICICIBANK', 'SBIN.NS': 'SBIN', 'BHARTIARTL.NS': 'BHARTIARTL',
        'ITC.NS': 'ITC', 'LT.NS': 'LT', 'KOTAKBANK.NS': 'KOTAKBANK',
        '^BSESN': 'SENSEX', '^CNXFIN': 'FINNIFTY', '^NSEMDCP50': 'MIDCPNIFTY',
    }
    symbol = symbol_map.get(ticker) or ticker.replace('.NS','').replace('.BO','').replace('^','')
    url = f"http://localhost:3001/api/nse/quote?symbol={symbol}"
    logger.info(f"[get_node_proxy_quote] Fetching from Node proxy: {url}")
    try:
        resp = requests.get(url, timeout=1.0)
        logger.info(f"[get_node_proxy_quote] Node proxy response status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            logger.info(f"[get_node_proxy_quote] Node proxy data: {data}")
            if data and 'lastPrice' in data and data['lastPrice'] > 0:
                return data
    except Exception as e:
        logger.warning(f"[get_node_proxy_quote] Failed to fetch live price from Node proxy for {ticker}: {e}")
    return None


@app.route('/api/market-data', methods=['GET'])
def api_market_data():
    ticker = request.args.get('ticker')
    period = request.args.get('period', '5d')
    interval = request.args.get('interval', '15m')
    
    if not ticker:
        return jsonify({"error": "Ticker parameter is required"}), 400
        
    try:
        now_ts = time.time()
        with live_data_lock:
            must_fetch = (
                ticker not in LIVE_DATA or
                (now_ts - LIVE_DATA[ticker].get('last_fetch', 0)) > 60 or
                LIVE_DATA[ticker].get('period') != period or
                LIVE_DATA[ticker].get('interval') != interval
            )
            
        if must_fetch:
            df = get_market_data(ticker, period=period, interval=interval)
            if df.empty:
                return jsonify({"error": f"No data found for {ticker}"}), 404
                
            df_ind = calculate_technical_indicators(df)
            latest_row = df_ind.iloc[-1]
            spot_price = float(latest_row.get("Close", 0.0))
            
            with live_data_lock:
                LIVE_DATA[ticker] = {
                    'df_ind': df_ind,
                    'last_fetch': now_ts,
                    'period': period,
                    'interval': interval,
                    'spot_price': spot_price,
                    'prev_spot_price': spot_price,
                    'base_spot_price': spot_price
                }
                
        # Get cached data
        with live_data_lock:
            ticker_data = LIVE_DATA[ticker]
            spot_price = ticker_data['spot_price']
            prev_spot_val = ticker_data['prev_spot_price']
            df_ind = ticker_data['df_ind'].copy()
            
        # Try to overlay live quote from the Node proxy server (port 3001)
        node_quote = get_node_proxy_quote(ticker)
        if node_quote:
            spot_price = float(node_quote['lastPrice'])
            # Update cache and tick engine store so other components see the real price
            with live_data_lock:
                LIVE_DATA[ticker]['spot_price'] = spot_price
            tick_engine.register_asset(ticker, spot_price)
            
        # Update the last row of df_ind with live spot price
        if not df_ind.empty:
            idx = df_ind.index[-1]
            df_ind.at[idx, 'Close'] = spot_price
            if spot_price > df_ind.at[idx, 'High']:
                df_ind.at[idx, 'High'] = spot_price
            if spot_price < df_ind.at[idx, 'Low']:
                df_ind.at[idx, 'Low'] = spot_price
                
            # Re-calculate indicators
            df_ind = calculate_technical_indicators(df_ind)
            
            # Calculate additional indicators for Top 1% checklists
            df_ind['EMA_50'] = df_ind['Close'].ewm(span=50, adjust=False).mean()
            df_ind['Avg_Volume_20d'] = df_ind['Volume'].rolling(window=20, min_periods=1).mean()
            
        # Convert df rows into candles with lowercase keys
        candles = []
        for idx, row in df_ind.iterrows():
            candles.append({
                "time": str(row.get("time", "")),
                "open": float(row.get("Open", 0.0)),
                "high": float(row.get("High", 0.0)),
                "low": float(row.get("Low", 0.0)),
                "close": float(row.get("Close", 0.0)),
                "volume": float(row.get("Volume", 0.0)),
                "ema9": float(row.get("EMA_9", 0.0)),
                "ema21": float(row.get("EMA_21", 0.0)),
                "vwap": float(row.get("VWAP", 0.0)),
                "sma50": float(row.get("SMA_50", 0.0)),
                "sma200": float(row.get("SMA_200", 0.0)),
                "supertrend": float(row.get("Supertrend", 0.0)),
                "supertrend_dir": int(row.get("Supertrend_Dir", 1)),
                "cmf": float(row.get("CMF", 0.0)),
                "obv": float(row.get("OBV", 0.0)),
                "psar": float(row.get("PSAR", 0.0)),
                "fib_236": float(row.get("Fib_236", 0.0)),
                "fib_382": float(row.get("Fib_382", 0.0)),
                "fib_500": float(row.get("Fib_500", 0.0)),
                "fib_618": float(row.get("Fib_618", 0.0)),
                "fib_786": float(row.get("Fib_786", 0.0))
            })
            
        # Extract latest values for indicators dashboard
        latest_row = df_ind.iloc[-1]
        rsi_val   = float(latest_row.get("RSI", 50.0))
        ema9_val  = float(latest_row.get("EMA_9", 0.0))
        ema21_val = float(latest_row.get("EMA_21", 0.0))
        ema50_val = float(latest_row.get("EMA_50", 0.0))
        sma50_val = float(latest_row.get("SMA_50", 0.0))
        sma200_val = float(latest_row.get("SMA_200", 0.0))
        supertrend_val = float(latest_row.get("Supertrend", 0.0))
        supertrend_dir_val = int(latest_row.get("Supertrend_Dir", 1))
        avg_vol_20d = float(latest_row.get("Avg_Volume_20d", 0.0))
        latest_vol = float(latest_row.get("Volume", 0.0))
 
        # ── Real intraday VWAP (1-minute candles from 9:15 AM IST) ───────────
        # Derive the yf-compatible symbol for intraday fetch
        _vwap_sym = ticker.replace('.NS','').replace('.BO','').replace('^NSEI','NIFTY').replace('^NSEBANK','BANKNIFTY')
        real_vwap = calculate_intraday_vwap(_vwap_sym)
 
        # Fall back to df_ind VWAP only when real VWAP is truly unavailable
        # (pre-market / data error) — NEVER silently use spot price.
        df_vwap = float(latest_row.get("VWAP", 0.0))
        if real_vwap is not None and abs(real_vwap - spot_price) > 0.5:
            # Real intraday VWAP is meaningfully different from spot → use it
            vwap_val = real_vwap
            vwap_valid = True
        elif df_vwap > 0 and abs(df_vwap - spot_price) > 0.5:
            # df_ind VWAP is available and differs from spot → use it
            vwap_val  = df_vwap
            vwap_valid = True
        else:
            # All sources collapsed to spot — mark as unavailable
            vwap_val   = real_vwap or df_vwap or spot_price
            vwap_valid = False
            logger.warning(f"[VWAP] {ticker}: VWAP={vwap_val:.2f} equals spot — data unreliable")
 
        ema_status    = "Bullish (9 > 21 EMA)" if ema9_val > ema21_val else "Bearish (9 < 21 EMA)"
        vwap_position = (
            "UNAVAILABLE" if not vwap_valid
            else "above" if spot_price > vwap_val
            else "below"
        )
        
        # Get Options PCR and Max Pain centered around spot
        chain = get_options_chain(ticker, spot_price)
        pcr_pain = calculate_pcr_and_pain(chain)
        pcr_val = pcr_pain["pcr"]
        max_pain_val = pcr_pain["max_pain"]
        
        # Price change pct over series
        if node_quote and 'pChange' in node_quote:
            price_change_pct = float(node_quote['pChange'])
        else:
            first_close = float(df_ind.iloc[0].get("Close", spot_price))
            price_change_pct = round(((spot_price - first_close) / (first_close + 1e-10)) * 100, 2)
        
        spot_below_ema21 = spot_price < ema21_val
        validation = validate_metrics_and_direction(spot_price, rsi_val, spot_below_ema21, pcr_val)
        is_restricted = validation['is_restricted']
        deduced_direction = validation['deduced_direction']
        
        indicators = {
            "spot_price": spot_price,
            "prev_spot_price": prev_spot_val,
            "rsi": rsi_val,
            "ema_9": ema9_val,
            "ema_21": ema21_val,
            "ema_50": ema50_val,
            "sma_50": sma50_val,
            "sma_200": sma200_val,
            "supertrend": supertrend_val,
            "supertrend_dir": supertrend_dir_val,
            "avg_volume_20d": avg_vol_20d,
            "volume": latest_vol,
            "daily_trend": "Bullish" if spot_price > ema21_val * 0.99 else "Bearish",
            "hourly_trend": "Bullish" if spot_price > ema21_val * 0.995 else "Bearish",
            "trend_15m": "Bullish" if spot_price > ema21_val else "Bearish",
            "ema_status": ema_status,
            "vwap_position": vwap_position,
            "vwap_val": vwap_val,
            "vwap_valid": vwap_valid,
            "pcr": pcr_val,
            "max_pain": max_pain_val,
            "price_change_pct": price_change_pct,
            "spot_below_ema21": spot_below_ema21,
            "is_restricted": is_restricted,
            "deduced_direction": deduced_direction,
            "cmf": float(latest_row.get("CMF", 0.0)),
            "obv": float(latest_row.get("OBV", 0.0)),
            "psar": float(latest_row.get("PSAR", 0.0)),
            "fibonacci": {
                "level236": float(latest_row.get("Fib_236", 0.0)),
                "level382": float(latest_row.get("Fib_382", 0.0)),
                "level500": float(latest_row.get("Fib_500", 0.0)),
                "level618": float(latest_row.get("Fib_618", 0.0)),
                "level786": float(latest_row.get("Fib_786", 0.0))
            }
        }
        
        return jsonify({
            "candles": candles,
            "indicators": indicators
        })
        
    except Exception as e:
        logger.error(f"Error serving market data for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/options-data', methods=['GET'])
def api_options_data():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker parameter is required"}), 400
        
    try:
        spot_price = 23242.1
        try:
            from backend.stock_db import get_connection
            conn = get_connection()
            clean_sym = ticker.upper().replace('.NS', '').replace('^', '')
            if clean_sym == 'NSEI': clean_sym = 'NIFTY'
            if clean_sym == 'NSEBANK': clean_sym = 'BANKNIFTY'
            row = conn.execute("SELECT base_price FROM stocks WHERE UPPER(symbol)=? OR UPPER(yf_ticker)=?", (clean_sym, ticker.upper())).fetchone()
            if row:
                spot_price = row['base_price']
            conn.close()
        except Exception as db_err:
            logger.warning(f"Failed to query base price from DB for {ticker}: {db_err}")
            
        with live_data_lock:
            if ticker in LIVE_DATA:
                spot_price = LIVE_DATA[ticker]['spot_price']
            else:
                # fetch once to cache
                df = get_market_data(ticker, period="1d", interval="15m")
                if not df.empty:
                    spot_price = float(df.iloc[-1].get("Close", spot_price))
                    # cache temporarily
                    LIVE_DATA[ticker] = {
                        'df_ind': calculate_technical_indicators(df),
                        'last_fetch': time.time(),
                        'period': '1d',
                        'interval': '15m',
                        'spot_price': spot_price,
                        'prev_spot_price': spot_price,
                        'base_spot_price': spot_price
                    }
                    
        chain = get_options_chain(ticker, spot_price)
        return jsonify({"chain": chain})
    except Exception as e:
        logger.error(f"Error serving options data for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/journal', methods=['GET'])
def api_get_journal():
    try:
        entries = get_journal_entries()
        return jsonify(entries)
    except Exception as e:
        logger.error(f"Error fetching journal entries: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/journal', methods=['POST'])
def api_add_journal():
    try:
        data = request.json or {}
        symbol = data.get("symbol", "Asset")
        setup = data.get("setup", "N/A")
        direction = data.get("direction", "LONG")
        conviction = data.get("conviction", "Medium")
        entry = data.get("entry", 0.0)
        target = data.get("target", 0.0)
        sl = data.get("sl", 0.0)
        notes = data.get("notes", "")
        
        add_journal_entry(symbol, setup, direction, conviction, entry, target, sl, notes)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error adding journal entry: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/journal', methods=['DELETE'])
def api_delete_journal():
    try:
        entry_id = request.args.get('id')
        if entry_id:
            delete_journal_entry(int(entry_id))
        else:
            delete_journal_entry()  # clears all if no specific id given
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error clearing/deleting journal: {e}")
        return jsonify({"error": str(e)}), 500

# --- Full P&L Trade Journal & Analytics Endpoints ---
@app.route('/api/trades', methods=['GET'])
def api_get_trades():
    try:
        trades = get_trades()
        metrics = calculate_metrics()
        return jsonify({
            "trades": trades,
            "metrics": metrics
        })
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/trades', methods=['POST'])
def api_add_trade():
    try:
        data = request.json or {}
        ticker = data.get("ticker", "Asset")
        trade_type = data.get("trade_type", "LONG")
        setup_type = data.get("setup_type", "N/A")
        quantity = int(data.get("quantity", 1))
        entry_price = float(data.get("entry_price", 0.0))
        conviction = data.get("conviction", "Medium")
        setup_grade = data.get("setup_grade", "UNGRADED")
        had_setup_grade = int(data.get("had_setup_grade", 1))
        
        save_open_trade(ticker, trade_type, setup_type, quantity, entry_price, conviction, setup_grade, had_setup_grade)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error adding trade: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/trades/close', methods=['POST'])
def api_close_trade():
    try:
        data = request.json or {}
        trade_id = int(data.get("id"))
        exit_price = float(data.get("exit_price"))
        exit_reason = data.get("exit_reason", "")
        mistake = data.get("mistake", "")
        max_loss = float(data.get("max_loss", 0.0))
        max_profit = float(data.get("max_profit", 0.0))
        adherence_score = int(data.get("adherence_score", 100))
        followed_plan = int(data.get("followed_plan", 1))
        moved_sl = int(data.get("moved_sl", 0))
        entered_after_limit = int(data.get("entered_after_limit", 0))
        
        success = close_active_trade(
            trade_id, exit_price, exit_reason=exit_reason, mistake=mistake,
            max_loss=max_loss, max_profit=max_profit, adherence_score=adherence_score,
            followed_plan=followed_plan, moved_sl=moved_sl, entered_after_limit=entered_after_limit
        )
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Trade not found or already closed"}), 404
    except Exception as e:
        logger.error(f"Error closing trade: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/trades', methods=['DELETE'])
def api_delete_trade():
    try:
        trade_id = request.args.get('id')
        if trade_id:
            delete_trade(int(trade_id))
        else:
            clear_trades()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error clearing/deleting trades: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/deduct', methods=['POST'])
def api_deduct():
    try:
        data = request.json or {}
        ticker = data.get("ticker", "Asset")
        spot_price = float(data.get("spot_price", 0.0))
        rsi = float(data.get("rsi", 50.0))
        ema_status = data.get("ema_status", "Neutral")
        vwap_position = data.get("vwap_position", "near")
        vwap_val = float(data.get("vwap_val", 0.0))
        pcr = float(data.get("pcr", 1.0))
        max_pain = float(data.get("max_pain", 0.0))
        
        spot_below_ema21 = data.get("spot_below_ema21")
        if spot_below_ema21 is None:
            if ticker in LIVE_DATA:
                with live_data_lock:
                    df_ind = LIVE_DATA[ticker].get('df_ind')
                    if df_ind is not None and not df_ind.empty:
                        latest_row = df_ind.iloc[-1]
                        ema21_val = latest_row.get("EMA_21", 0.0)
                        spot_below_ema21 = spot_price < ema21_val
        
        verdict = get_sherlock_verdict(
            ticker=ticker,
            spot_price=spot_price,
            rsi=rsi,
            ema_status=ema_status,
            vwap_position=vwap_position,
            vwap_val=vwap_val,
            pcr=pcr,
            max_pain=max_pain,
            spot_below_ema21=spot_below_ema21
        )
        return jsonify({"verdict": verdict})
    except Exception as e:
        logger.error(f"Error running deduction: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-signal', methods=['POST'])
def api_generate_signal():
    try:
        data = request.json or {}
        ticker = data.get("ticker", "Asset")
        direction = data.get("direction", "LONG")
        metrics = data.get("metrics")
        
        if not metrics and ticker in LIVE_DATA:
            with live_data_lock:
                ticker_data = LIVE_DATA[ticker]
                spot_price = ticker_data['spot_price']
                df_ind = ticker_data['df_ind']
                if df_ind is not None and not df_ind.empty:
                    latest_row = df_ind.iloc[-1]
                    rsi_val = float(latest_row.get("RSI", 50.0))
                    ema21_val = float(latest_row.get("EMA_21", 0.0))
                    spot_below_ema21 = spot_price < ema21_val
                    vwap_val = float(latest_row.get("VWAP", spot_price))
                    ema_status = "Bullish" if float(latest_row.get("EMA_9", 0.0)) > ema21_val else "Bearish"
                    
                    chain = get_options_chain(ticker, spot_price)
                    pcr_pain = calculate_pcr_and_pain(chain)
                    pcr_val = pcr_pain["pcr"]
                    max_pain_val = pcr_pain["max_pain"]
                    
                    metrics = {
                        "spot_price": spot_price,
                        "rsi": rsi_val,
                        "ema_status": ema_status,
                        "vwap_val": vwap_val,
                        "spot_below_ema21": spot_below_ema21,
                        "pcr": pcr_val,
                        "max_pain": max_pain_val
                    }
        
        sig = get_sherlock_signal(ticker, direction, metrics=metrics)
        return jsonify({"signal": sig})
    except Exception as e:
        logger.error(f"Error generating signal: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    try:
        data = request.json or {}
        message = data.get("message", "")
        ticker = data.get("ticker", "Asset")
        history = data.get("history", [])
        metrics = data.get("metrics")
        
        if not metrics and ticker in LIVE_DATA:
            with live_data_lock:
                ticker_data = LIVE_DATA[ticker]
                spot_price = ticker_data['spot_price']
                df_ind = ticker_data['df_ind']
                if df_ind is not None and not df_ind.empty:
                    latest_row   = df_ind.iloc[-1]
                    rsi_val      = float(latest_row.get("RSI", 50.0))
                    ema9_v       = float(latest_row.get("EMA_9", 0.0))
                    ema21_val    = float(latest_row.get("EMA_21", 0.0))
                    spot_below_ema21 = spot_price < ema21_val
                    ema_status   = "Bullish" if ema9_v > ema21_val else "Bearish"

                    # ── Real intraday VWAP ────────────────────────────────────
                    _sym = ticker.replace('.NS','').replace('.BO','')\
                                 .replace('^NSEI','NIFTY').replace('^NSEBANK','BANKNIFTY')
                    real_vwap   = calculate_intraday_vwap(_sym)
                    df_vwap     = float(latest_row.get("VWAP", 0.0))
                    if real_vwap is not None and abs(real_vwap - spot_price) > 0.5:
                        vwap_val  = real_vwap
                        vwap_valid = True
                    elif df_vwap > 0 and abs(df_vwap - spot_price) > 0.5:
                        vwap_val   = df_vwap
                        vwap_valid = True
                    else:
                        vwap_val   = real_vwap or df_vwap or spot_price
                        vwap_valid = False

                    vwap_position = (
                        "UNAVAILABLE" if not vwap_valid
                        else "above" if spot_price > vwap_val else "below"
                    )

                    chain      = get_options_chain(ticker, spot_price)
                    pcr_pain   = calculate_pcr_and_pain(chain)
                    pcr_val    = pcr_pain["pcr"]
                    max_pain_val = pcr_pain["max_pain"]

                    # Support/resistance pivots from latest candle
                    high  = float(latest_row.get("High",  spot_price))
                    low   = float(latest_row.get("Low",   spot_price))
                    close = float(latest_row.get("Close", spot_price))
                    p  = (high + low + close) / 3.0
                    s1 = (2.0 * p) - high
                    r1 = (2.0 * p) - low
                    s2 = p - (high - low)
                    r2 = p + (high - low)

                    metrics = {
                        "spot_price":      spot_price,
                        "rsi":             rsi_val,
                        "ema_9":           ema9_v,
                        "ema_21":          ema21_val,
                        "ema_status":      ema_status,
                        "vwap_val":        vwap_val,
                        "vwap_valid":      vwap_valid,
                        "vwap_position":   vwap_position,
                        "spot_below_ema21": spot_below_ema21,
                        "pcr":             pcr_val,
                        "max_pain":        max_pain_val,
                        "pivot": round(p,  2),
                        "s1":    round(s1, 2),
                        "r1":    round(r1, 2),
                        "s2":    round(s2, 2),
                        "r2":    round(r2, 2),
                        "cmf": float(latest_row.get("CMF", 0.0)),
                        "obv": float(latest_row.get("OBV", 0.0)),
                        "psar": float(latest_row.get("PSAR", 0.0)),
                        "fibonacci": {
                            "level236": float(latest_row.get("Fib_236", 0.0)),
                            "level382": float(latest_row.get("Fib_382", 0.0)),
                            "level500": float(latest_row.get("Fib_500", 0.0)),
                            "level618": float(latest_row.get("Fib_618", 0.0)),
                            "level786": float(latest_row.get("Fib_786", 0.0))
                        }
                    }
        
        result = get_sherlock_chat_response(message, ticker, history, metrics=metrics)
        reply = result.get("reply", "")
        
        def generate():
            import time
            # Stream the generated reply text to the client in small chunks
            chunk_size = 4
            for i in range(0, len(reply), chunk_size):
                chunk = reply[i:i+chunk_size]
                data_payload = json.dumps({"delta": {"text": chunk}})
                yield f"data: {data_payload}\n\n"
                time.sleep(0.005)
            yield "data: [DONE]\n\n"
            
        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        logger.error(f"Error running chat: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/fii-dii', methods=['GET'])
def api_get_fii_dii():
    try:
        data = fetch_fii_dii_data()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error fetching FII/DII data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/fii-dii/analyze', methods=['POST'])
def api_analyze_fii_dii():
    try:
        data = request.json or {}
        fii_buy = float(data.get("fii_buy", 0.0))
        fii_sell = float(data.get("fii_sell", 0.0))
        dii_buy = float(data.get("dii_buy", 0.0))
        dii_sell = float(data.get("dii_sell", 0.0))
        history = data.get("history", [])
        
        analysis = get_fii_dii_ai_verdict(fii_buy, fii_sell, dii_buy, dii_sell, history)
        
        metadata = {
            "verdict": analysis.get("verdict", "NEUTRAL"),
            "confidence": analysis.get("confidence", 70),
            "fii_signal": analysis.get("fii_signal", "NEUTRAL"),
            "dii_signal": analysis.get("dii_signal", "NEUTRAL"),
            "recommended_action": analysis.get("recommended_action", "HOLD"),
            "intraday_bias": analysis.get("intraday_bias", "NEUTRAL"),
            "swing_bias": analysis.get("swing_bias", "NEUTRAL"),
            "momentum": analysis.get("momentum", "STEADY"),
            "risk_flags": analysis.get("risk_flags", []),
            "red_flag": analysis.get("red_flag", "None")
        }
        
        fii_interpret = analysis.get("fii_interpretation", "")
        dii_interpret = analysis.get("dii_interpretation", "")
        market_implication = analysis.get("market_implication", "")
        
        def generate_stream():
            import time
            # 1. Stream metadata first
            yield f"data: {json.dumps({'type': 'metadata', 'data': metadata})}\n\n"
            time.sleep(0.1)
            
            # 2. Stream FII Interpretation
            chunk_size = 4
            for i in range(0, len(fii_interpret), chunk_size):
                chunk = fii_interpret[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'delta', 'field': 'fii_interpretation', 'text': chunk})}\n\n"
                time.sleep(0.005)
                
            # 3. Stream DII Interpretation
            for i in range(0, len(dii_interpret), chunk_size):
                chunk = dii_interpret[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'delta', 'field': 'dii_interpretation', 'text': chunk})}\n\n"
                time.sleep(0.005)
                
            # 4. Stream Market Implication
            for i in range(0, len(market_implication), chunk_size):
                chunk = market_implication[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'delta', 'field': 'market_implication', 'text': chunk})}\n\n"
                time.sleep(0.005)
                
            yield "data: [DONE]\n\n"
            
        return Response(generate_stream(), mimetype='text/event-stream')
    except Exception as e:
        logger.error(f"Error analyzing FII/DII data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/morning-brief', methods=['GET'])
def api_morning_brief():
    try:
        brief = get_morning_brief()
        return jsonify(brief)
    except Exception as e:
        logger.error(f"Error generating morning brief: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest', methods=['POST'])
def api_backtest():
    try:
        data = request.json or {}
        ticker = data.get("ticker", "^NSEI")
        period = data.get("period", "6mo")
        interval = data.get("interval", "1d")
        strategy = data.get("strategy", "ALL")
        sl_pct = float(data.get("sl_pct", 1.2))
        t1_pct = float(data.get("t1_pct", 1.8))
        t2_pct = float(data.get("t2_pct", 3.0))
        t1_exit_pct = float(data.get("t1_exit_pct", 50.0))
        capital = float(data.get("capital", 100000.0))
        max_hold = int(data.get("max_hold", 5))
        cooldown = int(data.get("cooldown", 2))
        
        # 1. Fetch OHLCV data
        df = fetch_ohlcv(ticker, period, interval)
        if df is None or df.empty:
            return jsonify({"error": f"No historical data found for ticker {ticker}"}), 404
            
        # 2. Add indicators
        df_ind = add_indicators(df)
        
        # 3. Detect signals
        df_sig = detect_signals(df_ind, strategy)
        
        # 4. Run simulation
        tdf = run_backtest(df_sig, ticker, sl_pct, t1_pct, t2_pct, t1_exit_pct, capital, max_hold, cooldown)
        
        if tdf.empty:
            return jsonify({
                "trades": [],
                "stats": {
                    "total": 0, "wins": 0, "losses": 0, "win_rate": 0.0,
                    "total_pnl": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
                    "best_trade": 0.0, "worst_trade": 0.0, "profit_factor": 0.0,
                    "expectancy": 0.0, "max_drawdown_inr": 0.0, "max_drawdown_pct": 0.0,
                    "max_win_streak": 0, "max_loss_streak": 0, "final_capital": capital
                }
            })
            
        # 5. Compute stats
        stats = calc_stats(tdf, capital)
        
        # 6. Convert trades DataFrame to records
        trades = tdf.to_dict(orient="records")
        return jsonify({
            "trades": trades,
            "stats": stats
        })
        
    except Exception as e:
        logger.error(f"Error executing backtest: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/backtest/ai-analysis', methods=['POST'])
def api_backtest_ai():
    try:
        data = request.json or {}
        trades = data.get("trades", [])
        stats = data.get("stats", {})
        ticker = data.get("ticker", "^NSEI")
        period = data.get("period", "6mo")
        interval = data.get("interval", "1d")
        strategy = data.get("strategy", "ALL")
        
        import pandas as pd
        tdf = pd.DataFrame(trades)
        
        analysis = get_backtest_ai_analysis(tdf, stats, ticker, period, interval, strategy)
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error running backtest AI analysis: {e}")
        return jsonify({"error": str(e)}), 500

# ── Market Status Endpoint ────────────────────────────────────────────────────
@app.route('/api/market-status', methods=['GET'])
def api_market_status():
    """
    Returns current Indian stock market (NSE/BSE) status in IST.
    Response: { status: 'OPEN'|'CLOSED', reason: str, ist_time: str }
    """
    try:
        status = get_market_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting market status: {e}")
        return jsonify({"error": str(e)}), 500


# ── Asset Universe Search Endpoint ────────────────────────────────────────────
@app.route('/api/asset-universe', methods=['GET'])
def api_asset_universe():
    """
    Searchable, filterable asset universe endpoint.
    Query params:
      q      = search string (searches symbol, company_name, sector)
      type   = equity | options | futures | all  (default: all)
      limit  = max results per type         (default: 50)
    Response: [ { label, symbol, yf_ticker, type, sector, lot_size, ... } ]
    """
    try:
        q          = request.args.get('q', '').strip()
        asset_type = request.args.get('type', 'all').lower()
        limit      = int(request.args.get('limit', 50))

        results = search_assets(q=q, asset_type=asset_type, limit=limit)
        return jsonify({
            "results": results,
            "count":   len(results),
            "query":   q,
            "type":    asset_type
        })
    except Exception as e:
        logger.error(f"Error searching asset universe: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/asset-universe/fo-contracts', methods=['GET'])
def api_fo_contracts():
    """
    Get all F&O contracts for a specific underlying.
    Query params:
      underlying = e.g. NIFTY, RELIANCE
      expiry     = (optional) filter by specific expiry date YYYY-MM-DD
    Response: { options: [...], futures: [...] }
    """
    try:
        underlying    = request.args.get('underlying', '')
        expiry_filter = request.args.get('expiry', None)

        if not underlying:
            return jsonify({"error": "underlying parameter is required"}), 400

        contracts = get_fo_contracts(underlying.upper(), expiry_filter)
        return jsonify(contracts)
    except Exception as e:
        logger.error(f"Error fetching F&O contracts: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Run Flask server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
