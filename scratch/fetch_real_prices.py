import yfinance as yf

symbols = {
    "^NSEI": "Nifty 50",
    "^NSEBANK": "Nifty Bank",
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "Tata Consultancy Services",
    "HDFCBANK.NS": "HDFC Bank",
    "INFY.NS": "Infosys",
    "ICICIBANK.NS": "ICICI Bank",
    "SBIN.NS": "State Bank of India",
    "BHARTIARTL.NS": "Bharti Airtel"
}

for sym, name in symbols.items():
    try:
        t = yf.Ticker(sym)
        df = t.history(period="5d")
        if not df.empty:
            last_close = df["Close"].iloc[-1]
            print(f"{sym} ({name}): Real={last_close:.2f}")
        else:
            print(f"{sym} ({name}): Empty data")
    except Exception as e:
        print(f"{sym} ({name}): Error: {e}")
