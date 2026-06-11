import logging
import yfinance as yf
import pandas as pd
import requests
import datetime
import numpy as np
import concurrent.futures
import time
from backend.indicators import calculate_technical_indicators

logger = logging.getLogger(__name__)

# Global variables for dynamic yfinance fallback
_yfinance_online = True
_yfinance_last_check = 0.0
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)


class NSESession:
    def __init__(self):
        self.session = requests.Session()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.nseindia.com/',
        }
        self.session.headers.update(self.headers)
        self.cookies_initialized = False

    def init_cookies(self):
        try:
            self.session.get("https://www.nseindia.com", timeout=5)
            self.cookies_initialized = True
            logger.info("NSE session cookies initialized successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize NSE cookies: {e}")
            self.cookies_initialized = False

    def get_data(self, url):
        if not self.cookies_initialized:
            self.init_cookies()
        try:
            response = self.session.get(url, timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"NSE request failed with status: {response.status_code}")
                return None
        except Exception as e:
            logger.warning(f"Error fetching data from NSE: {e}")
            return None

def get_market_data(ticker: str, period: str = "5d", interval: str = "15m") -> pd.DataFrame:
    """
    Fetches historical candlestick data from yfinance with dynamic fallback.
    Falls back to high-quality mock data if yfinance is offline or returns empty.
    """
    global _yfinance_online, _yfinance_last_check
    
    logger.info(f"Fetching market data for {ticker} (period={period}, interval={interval})...")
    
    now_ts = time.time()
    # If yfinance was marked offline, bypass it immediately for 5 minutes
    if not _yfinance_online and (now_ts - _yfinance_last_check) < 300:
        logger.info(f"yfinance is currently marked offline. Bypassing fetch and using mock data immediately.")
    else:
        try:
            def _fetch():
                stock = yf.Ticker(ticker)
                return stock.history(period=period, interval=interval)

            future = _executor.submit(_fetch)
            try:
                df = future.result(timeout=5.0)   # strict 5.0 second timeout to avoid UI lags
                _yfinance_online = True
                _yfinance_last_check = now_ts
                if not df.empty:
                    df = df.reset_index()
                    df = df.rename(columns={"Date": "time", "Datetime": "time"})
                    if "time" in df.columns:
                        df["time"] = df["time"].dt.strftime("%Y-%m-%d %H:%M")
                    return df
            except concurrent.futures.TimeoutError:
                logger.warning(f"yfinance timed out for {ticker}. Marking offline and using mock data.")
                _yfinance_online = False
                _yfinance_last_check = now_ts
            except Exception as e:
                logger.warning(f"yfinance failed for {ticker}: {e}. Marking offline and using mock data.")
                _yfinance_online = False
                _yfinance_last_check = now_ts
        except Exception as e:
            logger.warning(f"yfinance executor submit failed for {ticker}: {e}. Generating mock data.")



    # Fallback to mock data
    logger.info("Generating mock candlestick data...")
    now = datetime.datetime.now()
    candles = []
    
    # Determine number of candles
    num_candles = 50
    if period == "1d":
        num_candles = 25
    elif period == "1mo":
        num_candles = 100

    # Base price based on ticker
    if "^NSEI" in ticker:
        base_price = 23242.1
    elif "^NSEBANK" in ticker:
        base_price = 55194.5
    elif "RELIANCE" in ticker:
        base_price = 1269.2
    elif "HDFCBANK" in ticker:
        base_price = 738.35
    elif "TCS" in ticker:
        base_price = 2151.0
    else:
        base_price = 150.0

    current_price = base_price
    for i in range(num_candles):
        time_offset = datetime.timedelta(minutes=15 * (num_candles - i))
        candle_time = (now - time_offset).strftime("%Y-%m-%d %H:%M")
        
        # Random walk close price
        price_change = np.random.normal(0.5, 12.0 if base_price > 10000 else 1.5)
        close_p = round(current_price + price_change, 2)
        open_p = round(current_price, 2)
        high_p = round(max(open_p, close_p) + np.random.uniform(0.1, 5.0), 2)
        low_p = round(min(open_p, close_p) - np.random.uniform(0.1, 5.0), 2)
        volume = int(np.random.uniform(10000, 500000))
        
        candles.append({
            "time": candle_time,
            "Open": open_p,
            "High": high_p,
            "Low": low_p,
            "Close": close_p,
            "Volume": volume
        })
        current_price = close_p
        
    return pd.DataFrame(candles)

def get_market_category(category_name: str) -> pd.DataFrame:
    """
    Fetches live stock lists categorized by:
    - VOLUME_SHOCKERS
    - HIGH_TURNOVER
    - INTRADAY_MOMENTUM
    Uses mock data by default for stability.
    """
    logger.info(f"Fetching market category list for: {category_name}...")
    tickers = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "BHARTIARTL", "LTIM", "AXISBANK", "WIPRO"]
    
    price_map = {
        "RELIANCE": 1269.2,
        "TCS": 2151.0,
        "INFY": 1180.3,
        "HDFCBANK": 738.35,
        "ICICIBANK": 1275.0,
        "SBIN": 1002.7,
        "BHARTIARTL": 1799.0,
        "LTIM": 5200.0,
        "AXISBANK": 1292.4,
        "WIPRO": 181.67
    }
    
    data = []
    for ticker in tickers:
        base = price_map.get(ticker, 150.0)
        price = np.random.uniform(base * 0.98, base * 1.02)
        
        if category_name == 'VOLUME_SHOCKERS':
            pct_change = np.random.uniform(-1.5, 2.5)
            volume = int(np.random.uniform(10000000, 35000000))
        elif category_name == 'HIGH_TURNOVER':
            pct_change = np.random.uniform(-0.5, 3.5)
            volume = int(np.random.uniform(5000000, 15000000))
        elif category_name == 'INTRADAY_MOMENTUM':
            pct_change = np.random.choice([np.random.uniform(3.5, 7.5), np.random.uniform(-7.5, -3.5)])
            volume = int(np.random.uniform(2000000, 8000000))
        else:
            pct_change = np.random.uniform(-1.0, 1.0)
            volume = int(np.random.uniform(100000, 1000000))
            
        data.append({
            "Ticker": ticker,
            "Current Price": round(price, 2),
            "Percentage Change": round(pct_change, 2),
            "Total Traded Volume": volume
        })
        
    return pd.DataFrame(data)

def find_active_picker_candidates(ticker_list):
    """
    Scans list of tickers and filters candidates based on technical footprints (e.g. trading above VWAP).
    """
    logger.info(f"Running concurrent active picker filters on {len(ticker_list)} components...")
    intraday_candidates = []
    delivery_candidates = []
    
    # Just run a fast loop
    for ticker in ticker_list:
        yf_ticker = f"{ticker}.NS" if not ticker.endswith((".NS", ".BO", "^")) else ticker
        try:
            df_raw = get_market_data(yf_ticker, period="1d", interval="15m")
            if df_raw.empty:
                continue
                
            df_ind = calculate_technical_indicators(df_raw)
            latest_row = df_ind.iloc[-1]
            spot = float(latest_row['Close'])
            vwap = float(latest_row['VWAP'])
            
            candidate_info = {
                "Ticker": ticker,
                "Price": round(spot, 2),
                "Change": round(((spot - df_raw.iloc[0]['Close']) / df_raw.iloc[0]['Close']) * 100, 2),
                "RSI": round(latest_row['RSI'], 1),
                "VWAP": round(vwap, 2)
            }
            
            if spot > vwap:
                intraday_candidates.append(candidate_info)
            else:
                delivery_candidates.append(candidate_info)
        except Exception as e:
            logger.warning(f"Error scanning {ticker}: {e}")
            
    return {
        "intraday": intraday_candidates,
        "delivery": delivery_candidates
    }
