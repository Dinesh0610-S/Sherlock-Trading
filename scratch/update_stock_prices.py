import re
import os
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("update_prices")

db_script_path = "backend/init_stock_db.py"
data_loader_path = "backend/data_loader.py"

# Tickers to fetch
tickers_map = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "INFY": "INFY.NS",
    "SBIN": "SBIN.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "ITC": "ITC.NS",
    "LT": "LT.NS",
    "AXISBANK": "AXISBANK.NS",
    "MARUTI": "MARUTI.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "TITAN": "TITAN.NS",
    "SUNPHARMA": "SUNPHARMA.NS",
    "WIPRO": "WIPRO.NS",
    "TATAMOTORS": "TATAMOTORS.NS",
    "ADANIPORTS": "ADANIPORTS.NS",
    "TECHM": "TECHM.NS",
    "HCLTECH": "HCLTECH.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "NTPC": "NTPC.NS",
    "HINDALCO": "HINDALCO.NS",
    "BPCL": "BPCL.NS",
    "COALINDIA": "COALINDIA.NS",
    "CIPLA": "CIPLA.NS",
    "DRREDDY": "DRREDDY.NS",
    "EICHERMOT": "EICHERMOT.NS",
    "GRASIM": "GRASIM.NS",
    "M&M": "M&M.NS",
    "INDUSINDBK": "INDUSINDBK.NS",
    "DLF": "DLF.NS",
    "TRENT": "TRENT.NS",
    "LTIM": "LTIM.NS",
    "ZOMATO": "ZOMATO.NS",
    "GODREJCP": "GODREJCP.NS",
    "SIEMENS": "SIEMENS.NS",
    "AMBUJACEM": "AMBUJACEM.NS",
    "DABUR": "DABUR.NS",
    "MUTHOOTFIN": "MUTHOOTFIN.NS",
    "NAUKRI": "NAUKRI.NS",
    "BANKBARODA": "BANKBARODA.NS",
    "CHOLAFIN": "CHOLAFIN.NS",
    "SBICARD": "SBICARD.NS",
    "HAL": "HAL.NS",
    "LICI": "LICI.NS",
    "SHRIRAMFIN": "SHRIRAMFIN.NS",
    "IRCTC": "IRCTC.NS",
    "TATAELXSI": "TATAELXSI.NS",
    "VBL": "VBL.NS",
}

# Fetch correct prices
logger.info("Fetching correct prices from yfinance...")
correct_prices = {}
for name, ticker in tickers_map.items():
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="1d")
        if not df.empty:
            correct_prices[name] = round(df["Close"].iloc[-1], 2)
            logger.info(f"Fetched {name}: {correct_prices[name]}")
        else:
            logger.warning(f"Empty data for {name} ({ticker})")
    except Exception as e:
        logger.error(f"Error fetching {name}: {e}")

# Read init_stock_db.py
with open(db_script_path, "r", encoding="utf-8") as f:
    db_content = f.read()

# 1. Update FO_UNDERLYINGS list in init_stock_db.py
# Parse existing FO_UNDERLYINGS block
fo_underlyings_pattern = r"(FO_UNDERLYINGS\s*=\s*\[)([^\]]*)(\])"
match = re.search(fo_underlyings_pattern, db_content)
if match:
    prefix, body, suffix = match.groups()
    new_body = ""
    for line in body.splitlines(keepends=True):
        # Match pattern: ("SYMBOL", lot_size, old_price, strike_step)
        line_match = re.match(r'(\s*\(\s*")([^"]+)("\s*,\s*\d+\s*,\s*)([\d.]+)(.*)', line)
        if line_match:
            start, sym, middle, old_price, end = line_match.groups()
            if sym in correct_prices:
                new_price = correct_prices[sym]
                new_body += f"{start}{sym}{middle}{new_price}{end}\n"
                logger.info(f"Updated FO_UNDERLYING {sym}: {old_price} -> {new_price}")
            else:
                new_body += line
        else:
            new_body += line
    db_content = db_content.replace(match.group(0), prefix + new_body + suffix)

# 2. Update NIFTY_STOCKS list in init_stock_db.py
nifty_stocks_pattern = r"(NIFTY_STOCKS\s*=\s*\[)([^\]]*)(\])"
match_nifty = re.search(nifty_stocks_pattern, db_content)
if match_nifty:
    prefix, body, suffix = match_nifty.groups()
    new_body = ""
    for line in body.splitlines(keepends=True):
        # Match pattern: ("SYMBOL", "ticker", "name", "sector", "index", old_price, lot, eligible)
        line_match = re.match(r'(\s*\(\s*")([^"]+)("\s*,\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*)([\d.]+)(.*)', line)
        if line_match:
            start, sym, middle, old_price, end = line_match.groups()
            if sym in correct_prices:
                new_price = correct_prices[sym]
                new_body += f"{start}{sym}{middle}{new_price}{end}\n"
                logger.info(f"Updated NIFTY_STOCK {sym}: {old_price} -> {new_price}")
            else:
                new_body += line
        else:
            new_body += line
    db_content = db_content.replace(match_nifty.group(0), prefix + new_body + suffix)

# Write updated init_stock_db.py
with open(db_script_path, "w", encoding="utf-8") as f:
    f.write(db_content)
logger.info(f"Successfully updated {db_script_path}")

# 3. Update data_loader.py base prices
with open(data_loader_path, "r", encoding="utf-8") as f:
    dl_content = f.read()

# Replace block:
#     if "^NSEI" in ticker:
#         base_price = 23664.35
#     elif "^NSEBANK" in ticker:
#         base_price = 48250.60
#     elif "RELIANCE" in ticker:
#         base_price = 2910.40
#     elif "HDFCBANK" in ticker:
#         base_price = 1560.15
#     elif "TCS" in ticker:
#         base_price = 3850.00

replacements = {
    'if "^NSEI" in ticker:\n        base_price = 23664.35': f'if "^NSEI" in ticker:\n        base_price = {correct_prices.get("NIFTY", 23242.10)}',
    'elif "^NSEBANK" in ticker:\n        base_price = 48250.60': f'elif "^NSEBANK" in ticker:\n        base_price = {correct_prices.get("BANKNIFTY", 55194.50)}',
    'elif "RELIANCE" in ticker:\n        base_price = 2910.40': f'elif "RELIANCE" in ticker:\n        base_price = {correct_prices.get("RELIANCE", 1269.20)}',
    'elif "HDFCBANK" in ticker:\n        base_price = 1560.15': f'elif "HDFCBANK" in ticker:\n        base_price = {correct_prices.get("HDFCBANK", 738.35)}',
    'elif "TCS" in ticker:\n        base_price = 3850.00': f'elif "TCS" in ticker:\n        base_price = {correct_prices.get("TCS", 2151.00)}'
}

for old, new in replacements.items():
    if old in dl_content:
        dl_content = dl_content.replace(old, new)
        logger.info(f"Updated data_loader.py: {old.splitlines()[1]} -> {new.splitlines()[1]}")

with open(data_loader_path, "w", encoding="utf-8") as f:
    f.write(dl_content)

# Delete existing SQLite DB
db_file = "backend/asset_universe.db"
if os.path.exists(db_file):
    try:
        os.remove(db_file)
        logger.info(f"Removed old database {db_file}")
    except Exception as e:
        logger.error(f"Error removing {db_file}: {e}")

# Run init script to rebuild DB
logger.info("Re-populating database with correct base prices...")
import subprocess
subprocess.run(["python", db_script_path], check=True)
logger.info("Database rebuild complete!")
