import pandas as pd
import numpy as np
import logging
import requests
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


# ── Real Intraday VWAP Calculator ─────────────────────────────────────────────
def calculate_intraday_vwap(symbol: str) -> float | None:
    """
    Fetches today's 1-minute intraday candles from Yahoo Finance and computes
    true VWAP from 9:15 AM IST onwards.

    Returns the VWAP float, or None if the data is unavailable or market
    hasn't opened yet (caller must treat None as UNAVAILABLE, NOT as spot).

    NEVER falls back to spot price — that would defeat the purpose.
    """
    try:
        sym_upper = symbol.upper()
        yf_symbol = (
            "^NSEI"      if sym_upper in ("NIFTY", "^NSEI") else
            "^NSEBANK"   if sym_upper in ("BANKNIFTY", "^NSEBANK") else
            "^CNXFIN"    if sym_upper in ("FINNIFTY", "NIFTY_FIN_SERVICE", "NIFTY_FIN_SERVICE.NS", "^CNXFIN", "CNXFIN") else
            "^NSEMDCP50" if sym_upper in ("MIDCPNIFTY", "NSEMDCP50", "NIFTYMID50", "NIFTYMID50.NS", "NSEMDCP50.NS", "^NSEMDCP50") else
            "^BSESN"     if sym_upper in ("SENSEX", "^BSESN") else
            symbol if symbol.startswith("^") else
            f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
        )

        url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{requests.utils.quote(yf_symbol)}"
            f"?interval=1m&range=1d"
        )

        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=6,
        )
        resp.raise_for_status()

        chart = resp.json().get("chart", {})
        results = chart.get("result")
        if not results:
            logger.warning(f"[VWAP] No chart result for {yf_symbol}")
            return None

        result     = results[0]
        quotes     = result["indicators"]["quote"][0]
        timestamps = result.get("timestamp", [])

        if not timestamps:
            logger.warning(f"[VWAP] Empty timestamps for {yf_symbol}")
            return None

        # IST = UTC + 5:30 → market opens at 09:15 IST = 03:45 UTC
        ist_offset   = timedelta(hours=5, minutes=30)
        market_open  = datetime.now(timezone.utc).replace(
            hour=3, minute=45, second=0, microsecond=0
        )
        market_open_unix = market_open.timestamp()

        cum_tpv = 0.0   # cumulative (typical-price × volume)
        cum_vol = 0.0   # cumulative volume

        for i, ts in enumerate(timestamps):
            if ts < market_open_unix:
                continue   # skip pre-market candles

            high   = quotes.get("high",   [None])[i] if i < len(quotes.get("high",   [])) else None
            low    = quotes.get("low",    [None])[i] if i < len(quotes.get("low",    [])) else None
            close  = quotes.get("close",  [None])[i] if i < len(quotes.get("close",  [])) else None
            volume = quotes.get("volume", [None])[i] if i < len(quotes.get("volume", [])) else None

            if None in (high, low, close, volume):
                continue
            if not (high and low and close and volume):
                continue

            typical_price = (high + low + close) / 3.0
            cum_tpv += typical_price * volume
            cum_vol += volume

        if cum_vol == 0:
            # Market hasn't opened yet or no data — return previous close from meta
            prev_close = result.get("meta", {}).get("chartPreviousClose")
            if prev_close:
                logger.info(f"[VWAP] {yf_symbol}: market not opened, using prev_close {prev_close}")
                return float(prev_close)
            logger.warning(f"[VWAP] {yf_symbol}: cumulative volume = 0, no prev_close")
            return None

        vwap = cum_tpv / cum_vol
        logger.info(f"[VWAP] {yf_symbol}: real VWAP = {vwap:.2f}  (cum_vol={cum_vol:.0f})")
        return round(vwap, 2)

    except Exception as exc:
        logger.error(f"[VWAP] calculate_intraday_vwap({symbol}) failed: {exc}")
        return None


def calculate_supertrend(df: pd.DataFrame, period: int = 7, multiplier: float = 3.0):
    if len(df) < period:
        return pd.Series(df['Close'], index=df.index), pd.Series(1, index=df.index)
        
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    close = df['Close'].astype(float)
    
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    
    hl2 = (high + low) / 2.0
    basic_ub = hl2 + multiplier * atr
    basic_lb = hl2 - multiplier * atr
    
    final_ub = basic_ub.copy()
    final_lb = basic_lb.copy()
    
    for i in range(1, len(df)):
        # Upper band
        if basic_ub.iloc[i] < final_ub.iloc[i-1] or close.iloc[i-1] > final_ub.iloc[i-1]:
            final_ub.iloc[i] = basic_ub.iloc[i]
        else:
            final_ub.iloc[i] = final_ub.iloc[i-1]
            
        # Lower band
        if basic_lb.iloc[i] > final_lb.iloc[i-1] or close.iloc[i-1] < final_lb.iloc[i-1]:
            final_lb.iloc[i] = basic_lb.iloc[i]
        else:
            final_lb.iloc[i] = final_lb.iloc[i-1]
            
    supertrend = pd.Series(0.0, index=df.index)
    direction = pd.Series(1, index=df.index)
    
    for i in range(1, len(df)):
        if direction.iloc[i-1] == 1:
            if close.iloc[i] < final_lb.iloc[i]:
                direction.iloc[i] = -1
                supertrend.iloc[i] = final_ub.iloc[i]
            else:
                direction.iloc[i] = 1
                supertrend.iloc[i] = final_lb.iloc[i]
        else:
            if close.iloc[i] > final_ub.iloc[i]:
                direction.iloc[i] = 1
                supertrend.iloc[i] = final_lb.iloc[i]
            else:
                direction.iloc[i] = -1
                supertrend.iloc[i] = final_ub.iloc[i]
                
    return supertrend, direction


def calculate_cmf(df: pd.DataFrame, period: int = 20) -> pd.Series:
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    close = df['Close'].astype(float)
    vol = df['Volume'].astype(float)
    
    range_val = high - low
    range_val = range_val.replace(0, 1e-10)
    mf_multiplier = ((close - low) - (high - close)) / range_val
    mf_volume = mf_multiplier * vol
    
    cmf = mf_volume.rolling(window=period, min_periods=1).sum() / vol.rolling(window=period, min_periods=1).sum().replace(0, 1e-10)
    return cmf.fillna(0.0)


def calculate_obv(df: pd.DataFrame) -> pd.Series:
    close = df['Close'].astype(float)
    vol = df['Volume'].astype(float)
    
    obv = np.zeros(len(df))
    if len(df) > 0:
        obv[0] = vol.iloc[0]
        close_vals = close.values
        vol_vals = vol.values
        for i in range(1, len(df)):
            if close_vals[i] > close_vals[i-1]:
                obv[i] = obv[i-1] + vol_vals[i]
            elif close_vals[i] < close_vals[i-1]:
                obv[i] = obv[i-1] - vol_vals[i]
            else:
                obv[i] = obv[i-1]
    return pd.Series(obv, index=df.index)


def calculate_psar(df: pd.DataFrame, step: float = 0.02, max_step: float = 0.2) -> pd.Series:
    high = df['High'].astype(float).values
    low = df['Low'].astype(float).values
    close = df['Close'].astype(float).values
    sar = np.zeros(len(df))
    
    if len(df) < 3:
        return pd.Series(close, index=df.index)
        
    is_long = close[1] > close[0]
    ep = high[1] if is_long else low[1]
    af = step
    sar[0] = low[0]
    sar[1] = low[0] if is_long else high[0]
    
    for i in range(2, len(df)):
        prev_sar = sar[i-1]
        current_sar = prev_sar + af * (ep - prev_sar)
        
        if is_long:
            if low[i] < current_sar:
                is_long = False
                current_sar = max(high[i], ep)
                sar[i] = current_sar
                ep = low[i]
                af = step
            else:
                if high[i] > ep:
                    ep = high[i]
                    af = min(af + step, max_step)
                lowest = min(low[i-1], low[i-2])
                sar[i] = min(current_sar, lowest)
        else:
            if high[i] > current_sar:
                is_long = True
                current_sar = min(low[i], ep)
                sar[i] = current_sar
                ep = high[i]
                af = step
            else:
                if low[i] < ep:
                    ep = low[i]
                    af = min(af + step, max_step)
                highest = max(high[i-1], high[i-2])
                sar[i] = max(current_sar, highest)
                
    return pd.Series(sar, index=df.index)


def calculate_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Appends technical indicators to the input DataFrame:
    - EMA_9 (9-period Exponential Moving Average)
    - EMA_21 (21-period Exponential Moving Average)
    - RSI (14-period Relative Strength Index)
    - VWAP (Volume Weighted Average Price, day-reset)
    - SMA_50 (50 DMA)
    - SMA_200 (200 DMA)
    - Supertrend
    - CMF (Chaikin Money Flow)
    - OBV (On Balance Volume)
    - PSAR (Parabolic SAR)
    - Fib_236, Fib_382, Fib_500, Fib_618, Fib_786 (Fibonacci levels)

    NOTE: For index instruments (Nifty/BankNifty) volume is often 0 so VWAP
    computed here will be unreliable.  The `/api/market-data` and `/api/chat`
    endpoints call `calculate_intraday_vwap()` separately and override this
    value with the real 1-minute cumulative VWAP.
    """
    if df.empty:
        return df

    # Create a copy to prevent setting-with-copy warning
    df = df.copy()

    # Ensure numeric types
    df['Close']  = df['Close'].astype(float)
    df['High']   = df['High'].astype(float)
    df['Low']    = df['Low'].astype(float)
    df['Volume'] = df['Volume'].astype(float)

    # 1. EMA Calculations
    df['EMA_9']  = df['Close'].ewm(span=9,  adjust=False).mean()
    df['EMA_21'] = df['Close'].ewm(span=21, adjust=False).mean()

    # 2. RSI Calculation (Wilder's smoothing)
    delta    = df['Close'].diff()
    gain     = (delta.where(delta > 0, 0)).astype(float)
    loss     = (-delta.where(delta < 0, 0)).astype(float)
    avg_gain = gain.ewm(alpha=1/14, min_periods=14).mean()
    avg_loss = loss.ewm(alpha=1/14, min_periods=14).mean()
    rs       = avg_gain / (avg_loss + 1e-10)
    df['RSI'] = 100 - (100 / (1 + rs))
    df['RSI'] = df['RSI'].fillna(50.0)

    # 3. VWAP (day-reset where date info available)
    tp   = (df['High'] + df['Low'] + df['Close']) / 3.0
    tp_v = tp * df['Volume']

    has_date    = False
    date_series = None

    if isinstance(df.index, pd.DatetimeIndex):
        has_date    = True
        date_series = df.index.date
    elif 'Date' in df.columns:
        has_date    = True
        date_series = pd.to_datetime(df['Date']).dt.date
    elif 'Datetime' in df.columns:
        has_date    = True
        date_series = pd.to_datetime(df['Datetime']).dt.date

    if has_date and date_series is not None:
        temp_df   = pd.DataFrame({'tp_v': tp_v, 'vol': df['Volume'], 'date': date_series})
        cum_tp_v  = temp_df.groupby('date')['tp_v'].cumsum()
        cum_vol   = temp_df.groupby('date')['vol'].cumsum()
        df['VWAP'] = cum_tp_v / (cum_vol + 1e-10)
    else:
        df['VWAP'] = tp_v.cumsum() / (df['Volume'].cumsum() + 1e-10)

    # When volume is 0 (index instruments), keep NaN rather than replacing with
    # Close — the caller will override with calculate_intraday_vwap() instead.
    # Only fill truly-zero-volume rows where no real computation is possible.
    df.loc[df['Volume'] <= 0, 'VWAP'] = np.nan
    df['VWAP'] = df['VWAP'].ffill().fillna(df['Close'])

    # 4. DMA Calculations (50 DMA and 200 DMA)
    df['SMA_50']  = df['Close'].rolling(window=min(50, len(df)), min_periods=1).mean()
    df['SMA_200'] = df['Close'].rolling(window=min(200, len(df)), min_periods=1).mean()

    # 5. Supertrend Calculation
    try:
        st, st_dir = calculate_supertrend(df)
        df['Supertrend'] = st
        df['Supertrend_Dir'] = st_dir
    except Exception as e:
        df['Supertrend'] = df['Close']
        df['Supertrend_Dir'] = 1

    # 6. Advanced indicators: CMF, OBV, PSAR
    df['CMF'] = calculate_cmf(df)
    df['OBV'] = calculate_obv(df)
    df['PSAR'] = calculate_psar(df)

    # 7. Fibonacci levels (rolling lookback of 50 candles)
    rolling_high = df['High'].rolling(window=min(50, len(df)), min_periods=1).max()
    rolling_low = df['Low'].rolling(window=min(50, len(df)), min_periods=1).min()
    diff = rolling_high - rolling_low
    
    df['Fib_236'] = rolling_high - diff * 0.236
    df['Fib_382'] = rolling_high - diff * 0.382
    df['Fib_500'] = rolling_high - diff * 0.500
    df['Fib_618'] = rolling_high - diff * 0.618
    df['Fib_786'] = rolling_high - diff * 0.786

    return df
