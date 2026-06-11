import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import time
import threading
import random
import queue
import json
import pytz
from datetime import datetime, time as dt_time
from typing import Optional

# Set Streamlit Page Configuration
st.set_page_config(
    page_title="Groww Live Pro Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ─────────────────────────────────────────────────────────────────────
#  1. CUSTOM CSS STYLING (GROWW SYSTEM THEME)
# ─────────────────────────────────────────────────────────────────────

GROWW_THEME_CSS = """
<style>
    /* Google Fonts Import */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    /* Global Typography & Background Overrides */
    * {
        font-family: 'Outfit', sans-serif !important;
    }
    
    .stApp {
        background-color: #0d1117 !important;
        color: #c9d1d9 !important;
    }

    /* Hide standard Streamlit header and footer */
    header, footer {
        visibility: hidden !important;
        height: 0 !important;
    }
    
    #MainMenu, footer, header {
        display: none !important;
    }

    /* Premium Containers & Cards */
    .spot-card {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: border-color 0.3s ease;
    }
    .spot-card:hover {
        border-color: #444c56;
    }

    .option-card {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 16px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
        transition: all 0.3s ease;
    }
    
    .option-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .option-title {
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
    }
    
    .option-tag {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
    }

    /* Live Open Interest (OI) Bar styling */
    .oi-bar-bg {
        background-color: #21262d;
        height: 5px;
        border-radius: 3px;
        margin-top: 10px;
        overflow: hidden;
    }
    .oi-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.4s ease-in-out;
    }

    /* ── FLASH ANIMATIONS ON PRICE CHANGES ── */
    @keyframes flash-green-anim {
        0% { background-color: rgba(0, 208, 156, 0.22); border-color: #00d09c; }
        100% { background-color: #161b22; border-color: #30363d; }
    }
    @keyframes flash-red-anim {
        0% { background-color: rgba(235, 91, 60, 0.22); border-color: #eb5b3c; }
        100% { background-color: #161b22; border-color: #30363d; }
    }
    @keyframes flash-green-text-anim {
        0% { color: #00d09c !important; }
        100% { color: #ffffff !important; }
    }
    @keyframes flash-red-text-anim {
        0% { color: #eb5b3c !important; }
        100% { color: #ffffff !important; }
    }
    
    .flash-green {
        animation: flash-green-anim 0.5s ease-out;
    }
    .flash-red {
        animation: flash-red-anim 0.5s ease-out;
    }
    .flash-green-text {
        animation: flash-green-text-anim 0.5s ease-out;
    }
    .flash-red-text {
        animation: flash-red-text-anim 0.5s ease-out;
    }

    /* ── GROWW STYLE TOGGLE PILL ── */
    div[data-testid="stRadio"] > div {
        display: flex;
        background-color: #161b22 !important;
        padding: 4px !important;
        border-radius: 24px !important;
        border: 1px solid #30363d !important;
        width: fit-content !important;
        gap: 4px !important;
        margin-bottom: 20px;
    }
    div[data-testid="stRadio"] label {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: transparent !important;
        color: #8b949e !important;
        padding: 6px 20px !important;
        border-radius: 20px !important;
        cursor: pointer !important;
        border: none !important;
        margin: 0 !important;
        font-weight: 500 !important;
        font-size: 13.5px !important;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    div[data-testid="stRadio"] input[type="radio"] {
        display: none !important;
    }
    div[data-testid="stRadio"] label:has(input:checked) {
        font-weight: 600 !important;
    }
    div[data-testid="stRadio"] label:has(input[value="CALL OPTION"]:checked) {
        background-color: #00d09c !important;
        color: #0d1117 !important;
        box-shadow: 0 2px 10px rgba(0, 208, 156, 0.25) !important;
    }
    div[data-testid="stRadio"] label:has(input[value="PUT OPTION"]:checked) {
        background-color: #eb5b3c !important;
        color: #ffffff !important;
        box-shadow: 0 2px 10px rgba(235, 91, 60, 0.25) !important;
    }

    /* Mock Order Entry Box styling */
    .order-box {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .btn-buy {
        background-color: #00d09c !important;
        color: #0d1117 !important;
        font-weight: 600 !important;
        border: none !important;
        padding: 10px 20px !important;
        border-radius: 6px !important;
        cursor: pointer;
    }
    
    .btn-sell {
        background-color: #eb5b3c !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border: none !important;
        padding: 10px 20px !important;
        border-radius: 6px !important;
        cursor: pointer;
    }
</style>
"""

# ─────────────────────────────────────────────────────────────────────
#  2. MARKET HOURS & HOLIDAY ENFORCER LOGIC
# ─────────────────────────────────────────────────────────────────────

def is_market_open(current_dt: Optional[datetime] = None) -> bool:
    """
    Checks if the stock market is open based on strict Indian Standard Time (IST) rules.
    TimeZone: Asia/Kolkata
    Days: Monday through Friday (Weekdays only)
    Hours: 09:15:00 AM to 03:30:00 PM IST
    """
    tz = pytz.timezone("Asia/Kolkata")
    if current_dt is None:
        current_dt = datetime.now(tz)
    else:
        if current_dt.tzinfo is None:
            current_dt = tz.localize(current_dt)
        else:
            current_dt = current_dt.astimezone(tz)
            
    # Check if weekday (0 = Monday, ..., 4 = Friday)
    if current_dt.weekday() > 4:
        return False
        
    market_start = dt_time(9, 15, 0)
    market_end = dt_time(15, 30, 0)
    current_time = current_dt.time()
    
    return market_start <= current_time <= market_end

def is_market_open_simulated(store: dict) -> bool:
    """
    Evaluates whether the market is open, incorporating UI simulation overrides.
    """
    mode = store.get("simulation_mode", "Strict (IST Clock)")
    if mode == "Force Open (Live)":
        return True
    elif mode == "Force Closed (Static)":
        return False
    return is_market_open()

# ─────────────────────────────────────────────────────────────────────
#  3. DECOUPLED WEBSOCKET CLIENT & CONSUMER PIPELINE
# ─────────────────────────────────────────────────────────────────────

class BrokerWebSocketClient:
    """
    A mock WebSocket client simulating real-time market data streaming.
    It runs inside a daemon thread, emits price changes conforming to standard
    order-book tick structures, triggers connection callbacks, and writes parsed
    data to a thread-safe Queue to decouple data logic from presentation.
    """
    def __init__(self, symbols: list, data_queue: queue.Queue, store: dict):
        self.symbols = symbols
        self.data_queue = data_queue
        self.store = store
        self.is_running = False
        self.thread = None
        
    def on_open(self):
        """
        Callback triggered upon successful connection.
        
        # ─────────────────────────────────────────────────────────────────
        # PRODUCTION INTEGRATION NOTES:
        # If swapping with Angel One SmartAPI WebSocket:
        #   from SmartApi.smartConnect import SmartConnect
        #   from SmartApi.smartWebSocketV2 import SmartWebSocketV2
        #   ...
        #   ws = SmartWebSocketV2(auth_token, api_key, client_code, feed_token)
        #   def on_data(ws, message):
        #       self.on_message(message)
        #   ws.on_data = on_data
        #   ws.connect()
        #   ws.subscribe(correlation_id="groww_live", action=1, params={
        #       "tokenList": [{"exchangeType": 1, "tokens": ["26000", "3045"]}]
        #   })
        #
        # If swapping with Upstox API Python SDK WebSockets:
        #   from upstox_client.websocket.portfolio_data_websocket import PortfolioDataWebSocket
        #   ...
        #   ws = PortfolioDataWebSocket(access_token)
        #   ws.on_message = lambda ws, msg: self.on_message(msg)
        #   ws.connect()
        # ─────────────────────────────────────────────────────────────────
        """
        pass

    def on_message(self, raw_message: str):
        """
        Parses incoming raw JSON payload and appends structured tick data
        into the shared queue.
        """
        try:
            data = json.loads(raw_message)
            self.data_queue.put(data)
        except Exception:
            pass

    def on_close(self):
        """Callback triggered when the WebSocket is closed."""
        pass
        
    def _simulation_loop(self):
        self.on_open()
        
        # Indian Stock Market Tick Size: ₹0.05 (paise)
        # Start Baselines
        baselines = {
            "NIFTY": 23611.10,
            "TCS": 2324.10,
            "23750 CE": 120.00,
            "23800 CE": 95.00,
            "23750 PE": 115.00,
            "23700 PE": 90.00
        }
        
        current_prices = dict(baselines)
        volumes = {
            "NIFTY": 14205800,
            "TCS": 810450,
            "23750 CE": 4500000,
            "23800 CE": 6200000,
            "23750 PE": 3800000,
            "23700 PE": 5100000
        }
        
        # Options price changes relative to underlying NIFTY movement
        option_deltas = {
            "23750 CE": 0.52,
            "23800 CE": 0.35,
            "23750 PE": -0.48,
            "23700 PE": -0.30
        }
        
        while self.is_running:
            time.sleep(0.5)
            
            # Check market status (freezes ticks if closed)
            if not is_market_open_simulated(self.store):
                continue
                
            # Formulate Random Walk in increments of standard 0.05 tick sizes
            nifty_tick = random.choice([-0.25, -0.20, -0.15, -0.10, -0.05, 0.00, 0.05, 0.10, 0.15, 0.20, 0.25])
            tcs_tick = random.choice([-0.15, -0.10, -0.05, 0.00, 0.05, 0.10, 0.15])
            
            # 1. Update NIFTY Spot Price
            current_prices["NIFTY"] = round(current_prices["NIFTY"] + nifty_tick, 2)
            nifty_change = round(current_prices["NIFTY"] - baselines["NIFTY"], 2)
            nifty_pct = round((nifty_change / baselines["NIFTY"]) * 100, 2)
            volumes["NIFTY"] += random.randint(1000, 5000)
            
            nifty_msg = {
                "symbol": "NIFTY",
                "ltp": current_prices["NIFTY"],
                "change": nifty_change,
                "pct_change": nifty_pct,
                "volume": volumes["NIFTY"]
            }
            self.on_message(json.dumps(nifty_msg))
            
            # 2. Update TCS Share Price
            current_prices["TCS"] = round(current_prices["TCS"] + tcs_tick, 2)
            tcs_change = round(current_prices["TCS"] - baselines["TCS"], 2)
            tcs_pct = round((tcs_change / baselines["TCS"]) * 100, 2)
            volumes["TCS"] += random.randint(200, 1000)
            
            tcs_msg = {
                "symbol": "TCS",
                "ltp": current_prices["TCS"],
                "change": tcs_change,
                "pct_change": tcs_pct,
                "volume": volumes["TCS"]
            }
            self.on_message(json.dumps(tcs_msg))
            
            # 3. Update Options Premiums
            for opt, delta in option_deltas.items():
                raw_move = nifty_tick * delta + random.uniform(-0.15, 0.15)
                # Round to standard 0.05 tick size
                tick_move = round(raw_move / 0.05) * 0.05
                current_prices[opt] = round(max(5.00, current_prices[opt] + tick_move), 2)
                
                oi_change = random.randint(-8000, 8000)
                volumes[opt] = int(max(100000, volumes[opt] + oi_change))
                
                opt_change = round(current_prices[opt] - baselines[opt], 2)
                opt_pct = round((opt_change / baselines[opt]) * 100, 2)
                
                opt_msg = {
                    "symbol": opt,
                    "ltp": current_prices[opt],
                    "change": opt_change,
                    "pct_change": opt_pct,
                    "volume": volumes[opt],
                    "strike": int(opt.split()[0])
                }
                self.on_message(json.dumps(opt_msg))
                
        self.on_close()
        
    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._simulation_loop, daemon=True)
        self.thread.start()
        
    def stop(self):
        self.is_running = False

# Global state lock
data_lock = threading.Lock()

def consume_queue(data_queue, store):
    """
    Worker thread that retrieves updates from the WebSocket data queue
    and persists them thread-safely into the global store.
    """
    while True:
        try:
            tick = data_queue.get()
            symbol = tick["symbol"]
            
            with data_lock:
                if symbol == "NIFTY":
                    store["prev_spot_price"] = store["spot_price"]
                    store["spot_price"] = tick["ltp"]
                    store["spot_change"] = tick["change"]
                    store["spot_pct"] = tick["pct_change"]
                    store["history"].append(tick["ltp"])
                    if len(store["history"]) > 50:
                        store["history"].pop(0)
                elif symbol == "TCS":
                    store["prev_tcs_price"] = store["tcs_price"]
                    store["tcs_price"] = tick["ltp"]
                    store["tcs_change"] = tick["change"]
                    store["tcs_pct"] = tick["pct_change"]
                    store["tcs_history"].append(tick["ltp"])
                    if len(store["tcs_history"]) > 50:
                        store["tcs_history"].pop(0)
                elif symbol in store["options"]:
                    opt = store["options"][symbol]
                    opt["prev_premium"] = opt["premium"]
                    opt["premium"] = tick["ltp"]
                    opt["oi"] = tick["volume"]
                    
            data_queue.task_done()
        except Exception:
            time.sleep(0.1)

# ─────────────────────────────────────────────────────────────────────
#  4. GLOBAL REAL-TIME DATA STORE (Thread-Safe & Cached Singleton)
# ─────────────────────────────────────────────────────────────────────

@st.cache_resource
def get_global_store():
    """
    Returns the persistent global store dictionary. Cache resource ensures
    this stays active and shared across Streamlit rerun cycles.
    """
    return {
        "spot_price": 23611.10,
        "prev_spot_price": 23611.10,
        "spot_change": 0.0,
        "spot_pct": 0.0,
        "history": [23611.10] * 50,
        
        "tcs_price": 2324.10,
        "prev_tcs_price": 2324.10,
        "tcs_change": 0.0,
        "tcs_pct": 0.0,
        "tcs_history": [2324.10] * 50,
        
        "simulation_mode": "Strict (IST Clock)",
        
        "options": {
            "23750 CE": {"premium": 120.00, "prev_premium": 120.00, "oi": 4500000, "prev_oi": 4500000, "strike": 23750},
            "23800 CE": {"premium": 95.00, "prev_premium": 95.00, "oi": 6200000, "prev_oi": 6200000, "strike": 23800},
            "23750 PE": {"premium": 115.00, "prev_premium": 115.00, "oi": 3800000, "prev_oi": 3800000, "strike": 23750},
            "23700 PE": {"premium": 90.00, "prev_premium": 90.00, "oi": 5100000, "prev_oi": 5100000, "strike": 23700},
        }
    }

@st.cache_resource
def start_websocket_pipeline():
    """
    Triggers the mock WebSocket background thread and queue consumer exactly once.
    """
    store = get_global_store()
    data_queue = queue.Queue()
    
    symbols = ["NIFTY", "TCS", "23750 CE", "23800 CE", "23750 PE", "23700 PE"]
    
    client = BrokerWebSocketClient(symbols, data_queue, store)
    client.start()
    
    consumer = threading.Thread(target=consume_queue, args=(data_queue, store), daemon=True)
    consumer.start()
    
    return client, consumer

# Initialize global store and start websocket threads
store_instance = get_global_store()
ws_client, ws_consumer = start_websocket_pipeline()

# Inject Groww theme Custom CSS
st.markdown(GROWW_THEME_CSS, unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────
#  5. SIDEBAR / CONTROL PANEL
# ─────────────────────────────────────────────────────────────────────

st.sidebar.markdown("""
<div style="padding: 10px 0px; border-bottom: 1px solid #30363d; margin-bottom: 20px;">
    <span style="font-size: 18px; font-weight: 700; color: #00d09c;">Control Panel</span>
</div>
""", unsafe_allow_html=True)

sim_mode = st.sidebar.selectbox(
    "Market Hour Simulation",
    ["Strict (IST Clock)", "Force Open (Live)", "Force Closed (Static)"],
    index=0,
    help="Force live updates or test closed hours behavior."
)

with data_lock:
    store_instance["simulation_mode"] = sim_mode

# ─────────────────────────────────────────────────────────────────────
#  6. APPLICATION LAYOUT & HEADER
# ─────────────────────────────────────────────────────────────────────

st.markdown("""
<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0px; border-bottom: 1px solid #21262d; margin-bottom: 24px;">
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 24px; font-weight: 700; color: #00d09c; letter-spacing: -0.5px;">groww</span>
        <span style="font-size: 11px; background-color: #21262d; padding: 2px 6px; border-radius: 4px; color: #8b949e; font-weight: 600;">PRO</span>
    </div>
    <div style="display: flex; gap: 24px; font-size: 14px; font-weight: 500; color: #8b949e;">
        <span style="color: #ffffff; cursor: pointer; border-bottom: 2px solid #00d09c; padding-bottom: 14px;">Option Chain</span>
        <span style="cursor: pointer; padding-bottom: 14px;">Markets</span>
        <span style="cursor: pointer; padding-bottom: 14px;">Holdings</span>
        <span style="cursor: pointer; padding-bottom: 14px;">Orders</span>
    </div>
    <div style="font-size: 13px; background-color: rgba(0, 208, 156, 0.08); border: 1px solid rgba(0, 208, 156, 0.2); color: #00d09c; padding: 6px 14px; border-radius: 18px; font-weight: 600;">
        🟢 Wallet: ₹1,54,320
    </div>
</div>
""", unsafe_allow_html=True)

# Render live status badge based on state
is_active = is_market_open_simulated(store_instance)
if is_active:
    st.markdown("""
    <div style="background-color: rgba(0, 208, 156, 0.08); border: 1px solid rgba(0, 208, 156, 0.25); color: #00d09c; padding: 8px 16px; border-radius: 8px; font-weight: 600; text-align: center; margin-bottom: 24px; font-size: 14px; letter-spacing: 0.5px;">
        🟢 LIVE MARKET DATA (Streaming Active)
    </div>
    """, unsafe_allow_html=True)
else:
    st.markdown("""
    <div style="background-color: rgba(235, 91, 60, 0.08); border: 1px solid rgba(235, 91, 60, 0.25); color: #eb5b3c; padding: 8px 16px; border-radius: 8px; font-weight: 600; text-align: center; margin-bottom: 24px; font-size: 14px; letter-spacing: 0.5px;">
        🔴 MARKET CLOSED (Displaying Last Session Close Data)
    </div>
    """, unsafe_allow_html=True)

# Define Main Layout Grid
layout_col_left, layout_col_right = st.columns([2, 1], gap="large")

with layout_col_left:
    # Option Type Toggle Switcher
    selected_option = st.radio(
        "Option selection toggle",
        ["CALL OPTION", "PUT OPTION"],
        label_visibility="collapsed",
        horizontal=True
    )
    
    # ── LOCALIZED HIGH FREQUENCY STREAMING CONTAINER ──
    @st.fragment(run_every=0.5)
    def render_live_components(opt_type):
        store = get_global_store()
        
        # Thread-safe read values from global state
        with data_lock:
            spot_val = store["spot_price"]
            prev_spot_val = store["prev_spot_price"]
            change_val = store["spot_change"]
            change_pct = store["spot_pct"]
            history_data = list(store["history"])
            
            tcs_val = store["tcs_price"]
            prev_tcs_val = store["prev_tcs_price"]
            tcs_change_val = store["tcs_change"]
            tcs_change_pct = store["tcs_pct"]
            tcs_history_data = list(store["tcs_history"])
            
            # Prepare options structures
            if "CALL" in opt_type:
                opts = {
                    "23750 CE": store["options"]["23750 CE"],
                    "23800 CE": store["options"]["23800 CE"]
                }
            else:
                opts = {
                    "23750 PE": store["options"]["23750 PE"],
                    "23700 PE": store["options"]["23700 PE"]
                }
                
        # NIFTY Flash Class & Colors
        spot_color = "#00d09c" if change_val >= 0 else "#eb5b3c"
        spot_sign = "+" if change_val >= 0 else ""
        spot_flash = ""
        if spot_val > prev_spot_val:
            spot_flash = "flash-green-text"
        elif spot_val < prev_spot_val:
            spot_flash = "flash-red-text"
            
        # TCS Flash Class & Colors
        tcs_color = "#00d09c" if tcs_change_val >= 0 else "#eb5b3c"
        tcs_sign = "+" if tcs_change_val >= 0 else ""
        tcs_flash = ""
        if tcs_val > prev_tcs_val:
            tcs_flash = "flash-green-text"
        elif tcs_val < prev_tcs_val:
            tcs_flash = "flash-red-text"
            
        # Render dynamic dual spot/stock cards side-by-side
        spot_col1, spot_col2 = st.columns(2)
        
        with spot_col1:
            st.markdown(f"""
            <div class="spot-card">
                <div style="font-size: 13px; color: #8b949e; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Nifty 50 Index</div>
                <div style="display: flex; align-items: baseline; gap: 14px;">
                    <div class="spot-price-val {spot_flash}" style="font-size: 34px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                        ₹{spot_val:,.2f}
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: {spot_color};">
                        {spot_sign}{change_val:,.2f} ({spot_sign}{change_pct:,.2f}%)
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
        with spot_col2:
            st.markdown(f"""
            <div class="spot-card">
                <div style="font-size: 13px; color: #8b949e; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">TCS Share Price</div>
                <div style="display: flex; align-items: baseline; gap: 14px;">
                    <div class="spot-price-val {tcs_flash}" style="font-size: 34px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                        ₹{tcs_val:,.2f}
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: {tcs_color};">
                        {tcs_sign}{tcs_change_val:,.2f} ({tcs_sign}{tcs_change_pct:,.2f}%)
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
        # Render Option Cards Grid
        st.markdown("<h4 style='color: #ffffff; margin-bottom: 12px; font-weight: 600;'>Live Premiums & Open Interest</h4>", unsafe_allow_html=True)
        grid_cols = st.columns(len(opts))
        
        for idx, (lbl, opt_data) in enumerate(opts.items()):
            with grid_cols[idx]:
                prem = opt_data["premium"]
                prev_prem = opt_data["prev_premium"]
                oi = opt_data["oi"]
                strike = opt_data["strike"]
                
                opt_flash_class = ""
                if prem > prev_prem:
                    opt_flash_class = "flash-green"
                elif prem < prev_prem:
                    opt_flash_class = "flash-red"
                    
                st.markdown(f"""
                <div class="option-card {opt_flash_class}">
                    <div class="option-header">
                        <span class="option-title">{lbl}</span>
                        <span class="option-tag" style="background-color: {"rgba(0, 208, 156, 0.10)" if "CE" in lbl else "rgba(235, 91, 60, 0.10)"}; color: {"#00d09c" if "CE" in lbl else "#eb5b3c"};">
                            {"CALL" if "CE" in lbl else "PUT"}
                        </span>
                    </div>
                    <div style="font-size: 26px; font-weight: 700; margin: 6px 0; color: #ffffff; letter-spacing: -0.5px;">
                        ₹{prem:,.2f}
                    </div>
                    <div style="font-size: 13px; color: #8b949e; display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Strike Price</span>
                        <span style="color: #ffffff; font-weight: 500;">₹{strike}</span>
                    </div>
                    <div style="font-size: 13px; color: #8b949e; display: flex; justify-content: space-between;">
                        <span>Open Interest (OI)</span>
                        <span style="color: #ffffff; font-weight: 600;">{oi:,}</span>
                    </div>
                    <div class="oi-bar-bg">
                        <div class="oi-bar-fill" style="width: {min(100, oi / 8000000 * 100)}%; background-color: {"#00d09c" if "CE" in lbl else "#eb5b3c"};"></div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                
        # Trend Chart Asset selector and chart rendering
        st.markdown("<h4 style='color: #ffffff; margin: 16px 0px 8px 0px; font-weight: 600;'>Real-time Trend Chart (50 Ticks)</h4>", unsafe_allow_html=True)
        chart_asset = st.radio("Select Trend Chart", ["NIFTY 50", "TCS"], key="chart_asset_selector", horizontal=True, label_visibility="collapsed")
        
        if chart_asset == "NIFTY 50":
            y_data = history_data
            line_color = spot_color
            fill_color = "rgba(0, 208, 156, 0.03)" if change_val >= 0 else "rgba(235, 91, 60, 0.03)"
        else:
            y_data = tcs_history_data
            line_color = tcs_color
            fill_color = "rgba(0, 208, 156, 0.03)" if tcs_change_val >= 0 else "rgba(235, 91, 60, 0.03)"
            
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            y=y_data,
            mode="lines",
            line=dict(color=line_color, width=2),
            fill="tozeroy",
            fillcolor=fill_color
        ))
        
        fig.update_layout(
            margin=dict(t=5, b=5, l=5, r=5),
            height=260,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(showgrid=False, showticklabels=False),
            yaxis=dict(
                showgrid=True,
                gridcolor="#21262d",
                zeroline=False,
                tickfont=dict(color="#8b949e", size=10),
                side="right"
            ),
            hovermode="x"
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    # Trigger Fragment render
    render_live_components(selected_option)

# Right Sidebar Layout - Static Order Panel (Doesn't reload or blink on tick updates)
with layout_col_right:
    st.markdown("<h4 style='color: #ffffff; margin-bottom: 12px; font-weight: 600;'>Order Execution Panel</h4>", unsafe_allow_html=True)
    
    with st.container():
        st.markdown("""
        <div class="order-box">
            <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #21262d; padding-bottom: 10px;">
                <span style="color: #00d09c; font-weight: 600; cursor: pointer; padding-bottom: 8px; border-bottom: 2px solid #00d09c;">Regular</span>
                <span style="color: #8b949e; cursor: pointer; padding-bottom: 8px;">Cover Order</span>
                <span style="color: #8b949e; cursor: pointer; padding-bottom: 8px;">Bracket Order</span>
            </div>
        """, unsafe_allow_html=True)
        
        # Order inputs
        order_ticker = st.selectbox(
            "Ticker Asset",
            ["NIFTY 23750 CE", "NIFTY 23800 CE", "NIFTY 23750 PE", "NIFTY 23700 PE", "TCS"],
            key="order_ticker_select"
        )
        
        order_type_col1, order_type_col2 = st.columns(2)
        with order_type_col1:
            st.radio("Transaction Type", ["Buy", "Sell"], key="order_tx_type")
        with order_type_col2:
            st.radio("Product", ["Delivery (CNC)", "Intraday (MIS)"], key="order_product")
            
        qty_col1, qty_col2 = st.columns(2)
        with qty_col1:
            default_qty = 10 if order_ticker == "TCS" else 50
            min_qty = 1 if order_ticker == "TCS" else 50
            step_qty = 1 if order_ticker == "TCS" else 50
            order_qty = st.number_input("Quantity", min_value=min_qty, step=step_qty, value=default_qty, key="order_qty_input")
        with qty_col2:
            default_price = 2324.10 if order_ticker == "TCS" else 120.00
            order_price = st.number_input("Limit Price (₹)", min_value=0.0, value=default_price, step=0.05, key="order_price_input")
            
        st.markdown("<hr style='border: none; border-top: 1px solid #21262d; margin: 16px 0;'>", unsafe_allow_html=True)
        
        # Calculate estimate margin required
        margin_est = order_qty * order_price
        st.markdown(f"""
            <div style="display: flex; justify-content: space-between; font-size: 13.5px; color: #8b949e; margin-bottom: 16px;">
                <span>Required Margin:</span>
                <span style="color: #ffffff; font-weight: 600;">₹{margin_est:,.2f}</span>
            </div>
        """, unsafe_allow_html=True)
        
        submit_btn = st.button("EXECUTE ORDER", use_container_width=True, type="primary")
        if submit_btn:
            st.success(f"Order Placed! Placed Order to BUY {order_qty} shares of {order_ticker} at ₹{order_price:.2f}")
            
        st.markdown("</div>", unsafe_allow_html=True)
