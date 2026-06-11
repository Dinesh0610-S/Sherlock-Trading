import sys
sys.path.insert(0, '.')
from backend.tick_engine import get_market_status, TickEngine
from backend.stock_db import search_assets, get_stock_count, get_fo_counts

# Test 1: Market Status
status = get_market_status()
print("=== Market Status ===")
print(f"Status: {status['status']}")
print(f"Reason: {status['reason']}")
print(f"IST Time: {status['ist_time']}")

# Test 2: GBM step
print("\n=== GBM Price Walk (5 ticks on INDEX 24000.0) ===")
price = 24000.0
for i in range(5):
    price = TickEngine._gbm_step(price, 'INDEX')
    print(f"  Tick {i+1}: {price}")

# Test 3: Stock Search
print("\n=== Search 'RELIANCE' ===")
results = search_assets('RELIANCE', 'all', 10)
print(f"Found {len(results)} results")
for r in results[:3]:
    print(f"  {r['symbol']} | {r['type']} | {r['label'][:50]}")

# Test 4: Options Search
print("\n=== Search 'NIFTY' Options ===")
results = search_assets('NIFTY', 'options', 5)
print(f"Found {len(results)} option results")
for r in results[:3]:
    print(f"  {r['label']}")

# Test 5: Counts
print(f"\n=== Database Counts ===")
print(f"Stocks: {get_stock_count()}")
counts = get_fo_counts()
print(f"Options: {counts['options']}")
print(f"Futures: {counts['futures']}")

print("\nAll checks passed!")
