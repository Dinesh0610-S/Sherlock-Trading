"""
stock_db.py — Asset Universe Database (SQLite)
================================================
Provides:
  - Schema creation for stocks, fo_options, fo_futures tables
  - CRUD helpers for the asset universe
  - Search/filter API used by Flask endpoints
"""

import sqlite3
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Store in same dir as other .db files (backend/)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "asset_universe.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # Better concurrent read performance
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema():
    """Create all tables if they don't already exist."""
    conn = get_connection()
    cur  = conn.cursor()

    # ── Equity universe (Nifty 500 + additional F&O eligible stocks) ─────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol           TEXT    UNIQUE NOT NULL,
            yf_ticker        TEXT    NOT NULL,
            company_name     TEXT    NOT NULL,
            sector           TEXT    DEFAULT 'Unknown',
            index_membership TEXT    DEFAULT 'NIFTY500',
            base_price       REAL    DEFAULT 100.0,
            lot_size         INTEGER DEFAULT 1,
            is_fo_eligible   INTEGER DEFAULT 0,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── F&O Options (CE/PE per underlying + strike + expiry) ─────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fo_options (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            underlying    TEXT    NOT NULL,
            instrument    TEXT    DEFAULT 'OPT',
            option_type   TEXT    NOT NULL CHECK(option_type IN ('CE','PE')),
            strike        REAL    NOT NULL,
            expiry        TEXT    NOT NULL,
            lot_size      INTEGER NOT NULL,
            display_label TEXT    NOT NULL,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(underlying, option_type, strike, expiry)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fo_opt_underlying ON fo_options(underlying)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fo_opt_expiry     ON fo_options(expiry)")

    # ── F&O Futures ───────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fo_futures (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            underlying    TEXT    NOT NULL,
            expiry        TEXT    NOT NULL,
            near_month    INTEGER DEFAULT 1,
            lot_size      INTEGER NOT NULL,
            display_label TEXT    NOT NULL,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(underlying, expiry)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fo_fut_underlying ON fo_futures(underlying)")

    conn.commit()
    conn.close()
    logger.info("[StockDB] Schema initialized successfully.")


# ─── Insert helpers ───────────────────────────────────────────────────────────

def upsert_stock(symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, is_fo_eligible):
    conn = get_connection()
    conn.execute("""
        INSERT INTO stocks (symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, is_fo_eligible)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(symbol) DO UPDATE SET
            yf_ticker=excluded.yf_ticker,
            company_name=excluded.company_name,
            sector=excluded.sector,
            index_membership=excluded.index_membership,
            base_price=excluded.base_price,
            lot_size=excluded.lot_size,
            is_fo_eligible=excluded.is_fo_eligible
    """, (symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, int(is_fo_eligible)))
    conn.commit()
    conn.close()


def upsert_fo_option(underlying, option_type, strike, expiry, lot_size, display_label):
    conn = get_connection()
    conn.execute("""
        INSERT OR IGNORE INTO fo_options (underlying, option_type, strike, expiry, lot_size, display_label)
        VALUES (?,?,?,?,?,?)
    """, (underlying, option_type, float(strike), expiry, lot_size, display_label))
    conn.commit()
    conn.close()


def bulk_upsert_stocks(rows: list[tuple]):
    """rows: list of (symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, is_fo_eligible)"""
    conn = get_connection()
    conn.executemany("""
        INSERT INTO stocks (symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, is_fo_eligible)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(symbol) DO UPDATE SET
            yf_ticker=excluded.yf_ticker,
            company_name=excluded.company_name,
            sector=excluded.sector,
            index_membership=excluded.index_membership,
            base_price=excluded.base_price,
            lot_size=excluded.lot_size,
            is_fo_eligible=excluded.is_fo_eligible
    """, rows)
    conn.commit()
    conn.close()


def bulk_insert_fo_options(rows: list[tuple]):
    """rows: list of (underlying, option_type, strike, expiry, lot_size, display_label)"""
    conn = get_connection()
    conn.executemany("""
        INSERT OR IGNORE INTO fo_options (underlying, option_type, strike, expiry, lot_size, display_label)
        VALUES (?,?,?,?,?,?)
    """, rows)
    conn.commit()
    conn.close()


def bulk_insert_fo_futures(rows: list[tuple]):
    """rows: list of (underlying, expiry, near_month, lot_size, display_label)"""
    conn = get_connection()
    conn.executemany("""
        INSERT OR IGNORE INTO fo_futures (underlying, expiry, near_month, lot_size, display_label)
        VALUES (?,?,?,?,?)
    """, rows)
    conn.commit()
    conn.close()


# ─── Query helpers ────────────────────────────────────────────────────────────

def search_assets(q: str = "", asset_type: str = "all", limit: int = 50) -> list[dict]:
    """
    Unified search across stocks + fo_options + fo_futures.
    Returns list of dicts with: { label, symbol, type, sector, yf_ticker, lot_size }
    """
    results = []
    q_like  = f"%{q.upper()}%"

    conn = get_connection()

    if asset_type in ("all", "equity"):
        cur = conn.execute("""
            SELECT symbol, yf_ticker, company_name, sector, index_membership, lot_size, is_fo_eligible
            FROM stocks
            WHERE UPPER(symbol) LIKE ? OR UPPER(company_name) LIKE ? OR UPPER(sector) LIKE ?
            ORDER BY
                CASE WHEN UPPER(index_membership) LIKE '%NIFTY50%' THEN 0
                     WHEN UPPER(index_membership) LIKE '%NIFTY100%' THEN 1
                     ELSE 2 END,
                symbol
            LIMIT ?
        """, (q_like, q_like, q_like, limit))
        for row in cur.fetchall():
            results.append({
                "label":      f"{row['symbol']} — {row['company_name']}",
                "symbol":     row["symbol"],
                "yf_ticker":  row["yf_ticker"],
                "type":       "FO_EQUITY" if row["is_fo_eligible"] else "EQUITY",
                "sector":     row["sector"],
                "membership": row["index_membership"],
                "lot_size":   row["lot_size"],
            })

    if asset_type in ("all", "options") and len(results) < limit:
        cur = conn.execute("""
            SELECT underlying, option_type, strike, expiry, lot_size, display_label
            FROM fo_options
            WHERE UPPER(display_label) LIKE ? OR UPPER(underlying) LIKE ?
            ORDER BY expiry, strike, option_type
            LIMIT ?
        """, (q_like, q_like, limit - len(results)))
        for row in cur.fetchall():
            results.append({
                "label":      row["display_label"],
                "symbol":     f"{row['underlying']}{int(row['strike'])}{row['option_type']}",
                "yf_ticker":  None,
                "type":       "OPTION",
                "sector":     row["option_type"],
                "membership": "F&O",
                "lot_size":   row["lot_size"],
                "strike":     row["strike"],
                "expiry":     row["expiry"],
                "option_type":row["option_type"],
                "underlying": row["underlying"],
            })

    if asset_type in ("all", "futures") and len(results) < limit:
        cur = conn.execute("""
            SELECT underlying, expiry, near_month, lot_size, display_label
            FROM fo_futures
            WHERE UPPER(display_label) LIKE ? OR UPPER(underlying) LIKE ?
            ORDER BY near_month, expiry
            LIMIT ?
        """, (q_like, q_like, limit - len(results)))
        for row in cur.fetchall():
            results.append({
                "label":      row["display_label"],
                "symbol":     f"{row['underlying']}FUT{row['expiry'].replace('-','')}",
                "yf_ticker":  None,
                "type":       "FUTURE",
                "sector":     "FUTURE",
                "membership": "F&O",
                "lot_size":   row["lot_size"],
                "expiry":     row["expiry"],
                "underlying": row["underlying"],
            })

    conn.close()
    return results


def get_fo_contracts(underlying: str, expiry_filter: Optional[str] = None) -> dict:
    """Get all F&O contracts for an underlying (options + futures)."""
    conn = get_connection()

    opt_query = "SELECT * FROM fo_options WHERE UPPER(underlying)=UPPER(?)"
    fut_query = "SELECT * FROM fo_futures WHERE UPPER(underlying)=UPPER(?)"
    params    = [underlying]

    if expiry_filter:
        opt_query += " AND expiry=?"
        fut_query += " AND expiry=?"
        params.append(expiry_filter)

    options  = [dict(r) for r in conn.execute(opt_query + " ORDER BY expiry, strike, option_type", params[:2] if expiry_filter else params[:1]).fetchall()]
    futures  = [dict(r) for r in conn.execute(fut_query + " ORDER BY near_month", params[:2] if expiry_filter else params[:1]).fetchall()]

    conn.close()
    return {"options": options, "futures": futures}


def get_stock_count() -> int:
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM stocks").fetchone()[0]
    conn.close()
    return count


def get_fo_counts() -> dict:
    conn = get_connection()
    opts = conn.execute("SELECT COUNT(*) FROM fo_options").fetchone()[0]
    futs = conn.execute("SELECT COUNT(*) FROM fo_futures").fetchone()[0]
    conn.close()
    return {"options": opts, "futures": futs}
