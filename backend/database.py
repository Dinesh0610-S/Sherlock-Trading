import sqlite3
import os
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "journal.db")
DB_TRADE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trade_journal.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS journal_setups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            setup TEXT,
            direction TEXT,
            conviction TEXT,
            entry REAL,
            target REAL,
            sl REAL,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def init_trade_db():
    conn = sqlite3.connect(DB_TRADE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ticker TEXT,
            trade_type TEXT,
            setup_type TEXT,
            quantity INTEGER,
            entry_price REAL,
            exit_price REAL,
            status TEXT DEFAULT 'OPEN',
            realised_pnl REAL,
            conviction TEXT
        )
    """)
    conn.commit()
    
    # Run migrations for new institutional fields
    cursor.execute("PRAGMA table_info(trades)")
    columns = [row[1] for row in cursor.fetchall()]
    
    new_cols = [
        ("setup_grade", "TEXT"),
        ("adherence_score", "INTEGER"),
        ("exit_reason", "TEXT"),
        ("mistake", "TEXT"),
        ("max_loss", "REAL"),
        ("max_profit", "REAL"),
        ("followed_plan", "INTEGER"),
        ("moved_sl", "INTEGER"),
        ("entered_after_limit", "INTEGER"),
        ("had_setup_grade", "INTEGER")
    ]
    
    for col_name, col_type in new_cols:
        if col_name not in columns:
            cursor.execute(f"ALTER TABLE trades ADD COLUMN {col_name} {col_type}")
            
    conn.commit()
    conn.close()

# Initialize databases
init_db()
init_trade_db()

# --- Legacy Journal Functions ---
def get_journal_entries():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journal_setups ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    
    entries = []
    for r in rows:
        entries.append({
            "id": r["id"],
            "symbol": r["symbol"],
            "setup": r["setup"],
            "direction": r["direction"],
            "conviction": r["conviction"],
            "entry": r["entry"],
            "target": r["target"],
            "sl": r["sl"],
            "notes": r["notes"],
            "timestamp": r["timestamp"]
        })
    return entries

def add_journal_entry(symbol, setup, direction, conviction, entry, target, sl, notes):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO journal_setups (symbol, setup, direction, conviction, entry, target, sl, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (symbol, setup, direction, conviction, float(entry), float(target), float(sl), notes))
    conn.commit()
    conn.close()
    return True

def delete_journal_entry(entry_id=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if entry_id is not None:
        cursor.execute("DELETE FROM journal_setups WHERE id = ?", (entry_id,))
    else:
        cursor.execute("DELETE FROM journal_setups")
    conn.commit()
    conn.close()
    return True

# --- New Robust Trade Journal Database functions ---
def save_open_trade(ticker, trade_type, setup_type, quantity, entry_price, conviction, setup_grade='UNGRADED', had_setup_grade=1):
    conn = sqlite3.connect(DB_TRADE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO trades (ticker, trade_type, setup_type, quantity, entry_price, status, conviction, setup_grade, had_setup_grade)
        VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
    """, (ticker, trade_type, setup_type, int(quantity), float(entry_price), conviction, setup_grade, int(had_setup_grade)))
    conn.commit()
    conn.close()
    return True

def close_active_trade(trade_id, exit_price, exit_reason='', mistake='', max_loss=0.0, max_profit=0.0, adherence_score=100, followed_plan=1, moved_sl=0, entered_after_limit=0):
    conn = sqlite3.connect(DB_TRADE_PATH)
    cursor = conn.cursor()
    
    # 1. Fetch trade details
    cursor.execute("SELECT trade_type, entry_price, quantity FROM trades WHERE id = ?", (trade_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    trade_type, entry_price, quantity = row
    exit_price = float(exit_price)
    
    # 2. Calculate P&L based on trade type
    if trade_type.upper() == 'LONG':
        realised_pnl = (exit_price - entry_price) * quantity
    else:
        realised_pnl = (entry_price - exit_price) * quantity
        
    # 3. Update status, exit price, and realised pnl
    cursor.execute("""
        UPDATE trades 
        SET exit_price = ?, status = 'CLOSED', realised_pnl = ?,
            exit_reason = ?, mistake = ?, max_loss = ?, max_profit = ?,
            adherence_score = ?, followed_plan = ?, moved_sl = ?, entered_after_limit = ?
        WHERE id = ?
    """, (exit_price, realised_pnl, exit_reason, mistake, float(max_loss), float(max_profit),
          int(adherence_score), int(followed_plan), int(moved_sl), int(entered_after_limit), trade_id))
    
    conn.commit()
    conn.close()
    return True

def get_trades():
    conn = sqlite3.connect(DB_TRADE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trades ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    
    trades = []
    for r in rows:
        keys = r.keys()
        trades.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "ticker": r["ticker"],
            "trade_type": r["trade_type"],
            "setup_type": r["setup_type"],
            "quantity": r["quantity"],
            "entry_price": r["entry_price"],
            "exit_price": r["exit_price"],
            "status": r["status"],
            "realised_pnl": r["realised_pnl"],
            "conviction": r["conviction"],
            "setup_grade": r["setup_grade"] if "setup_grade" in keys else "UNGRADED",
            "adherence_score": r["adherence_score"] if "adherence_score" in keys else 100,
            "exit_reason": r["exit_reason"] if "exit_reason" in keys else "",
            "mistake": r["mistake"] if "mistake" in keys else "",
            "max_loss": r["max_loss"] if "max_loss" in keys else 0.0,
            "max_profit": r["max_profit"] if "max_profit" in keys else 0.0,
            "followed_plan": r["followed_plan"] if "followed_plan" in keys else 1,
            "moved_sl": r["moved_sl"] if "moved_sl" in keys else 0,
            "entered_after_limit": r["entered_after_limit"] if "entered_after_limit" in keys else 0,
            "had_setup_grade": r["had_setup_grade"] if "had_setup_grade" in keys else 1
        })
    return trades

def delete_trade(trade_id):
    conn = sqlite3.connect(DB_TRADE_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
    conn.commit()
    conn.close()
    return True

def clear_trades():
    conn = sqlite3.connect(DB_TRADE_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trades")
    conn.commit()
    conn.close()
    return True

# --- New Pandas Analytical Engine ---
def calculate_metrics():
    trades = get_trades()
    # Filter closed trades
    closed_trades = [t for t in trades if t["status"] == "CLOSED"]
    
    if not closed_trades:
        return {
            "total_pnl": 0.0,
            "win_rate": 0.0,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "current_streak": "0 Wins 🧊",
            "equity_curve": [],
            "strategy_performance": []
        }
        
    df = pd.DataFrame(closed_trades)
    
    # Sort chronologically
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(by='timestamp').reset_index(drop=True)
    
    # Total PNL
    total_pnl = float(df['realised_pnl'].sum())
    
    # Wins / Losses / Win Rate
    wins = int((df['realised_pnl'] > 0).sum())
    losses = int((df['realised_pnl'] <= 0).sum())
    total_trades = len(df)
    win_rate = float((wins / total_trades) * 100) if total_trades > 0 else 0.0
    
    # Current Streak Tracker (consecutive wins or losses up to the most recent trade)
    pnl_list = df['realised_pnl'].tolist()
    current_streak = "0 Wins 🧊"
    if pnl_list:
        most_recent = pnl_list[-1]
        is_win_streak = most_recent > 0
        streak_count = 0
        for p in reversed(pnl_list):
            if is_win_streak and p > 0:
                streak_count += 1
            elif not is_win_streak and p <= 0:
                streak_count += 1
            else:
                break
        emoji = "🔥" if is_win_streak else "🧊"
        label = "Wins" if is_win_streak else "Losses"
        current_streak = f"{streak_count} {label} {emoji}"
        
    # Cumulative Equity Curve
    df['cum_pnl'] = df['realised_pnl'].cumsum()
    equity_curve = []
    # Start at 0
    equity_curve.append({"timestamp": "Start", "cum_pnl": 0.0})
    for _, row in df.iterrows():
        equity_curve.append({
            "timestamp": row['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
            "cum_pnl": float(row['cum_pnl'])
        })
        
    # Strategy Performance (grouped by setup_type)
    strategy_group = df.groupby('setup_type')['realised_pnl'].sum().reset_index()
    strategy_performance = []
    for _, row in strategy_group.iterrows():
        strategy_performance.append({
            "setup_type": row['setup_type'],
            "total_pnl": float(row['realised_pnl'])
        })
        
    return {
        "total_pnl": total_pnl,
        "win_rate": win_rate,
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "current_streak": current_streak,
        "equity_curve": equity_curve,
        "strategy_performance": strategy_performance
    }
