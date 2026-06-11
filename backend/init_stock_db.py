"""
init_stock_db.py — Asset Universe Population Script
=====================================================
Run once (or to refresh) to populate the SQLite asset_universe.db with:
  1. ~500 Nifty 500 stocks with sector, index membership, base price
  2. F&O Options for all F&O-eligible underlyings (CE + PE, 11 strikes × 3 expiries)
  3. F&O Futures for all F&O underlyings (near-month + next-month)

Usage:
    python backend/init_stock_db.py
    OR imported and called from server startup via init_if_empty()
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from datetime import date, timedelta
import calendar

from backend.stock_db import init_schema, bulk_upsert_stocks, bulk_insert_fo_options, bulk_insert_fo_futures, get_stock_count, get_fo_counts

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. NIFTY 500 + MAJOR STOCKS
#    Format: (symbol, yf_ticker, company_name, sector, index_membership, base_price, lot_size, is_fo_eligible)
# ─────────────────────────────────────────────────────────────────────────────

NIFTY_STOCKS = [
    # ── Indices ──────────────────────────────────────────────────────────────
    ("^NSEI",      "^NSEI",         "Nifty 50 Index",         "Index",      "INDEX",    24000.0,  25, 1),
    ("^NSEBANK",   "^NSEBANK",      "Bank Nifty Index",       "Index",      "INDEX",    52000.0,  15, 1),
    ("NIFTYMID50", "^NSEMDCP50",    "Nifty Midcap 50",        "Index",      "INDEX",    13500.0,  40, 0),
    ("FINNIFTY",   "NIFTY_FIN_SERVICE.NS", "Nifty Financial Services","Index","INDEX",  25152.45,  40, 1),

    # ── Nifty 50 Stocks ───────────────────────────────────────────────────────
    ("RELIANCE",    "RELIANCE.NS",    "Reliance Industries",      "Energy",          "NIFTY50,NIFTY500",  1269.2,  250, 1),
    ("TCS",         "TCS.NS",         "Tata Consultancy Services","IT",              "NIFTY50,NIFTY500",  2151.0,  150, 1),
    ("HDFCBANK",    "HDFCBANK.NS",    "HDFC Bank",                "Banking",         "NIFTY50,NIFTY500",  738.35,  550, 1),
    ("ICICIBANK",   "ICICIBANK.NS",   "ICICI Bank",               "Banking",         "NIFTY50,NIFTY500",  1275.0,  700, 1),
    ("INFY",        "INFY.NS",        "Infosys",                  "IT",              "NIFTY50,NIFTY500",  1180.3,  600, 1),
    ("SBIN",        "SBIN.NS",        "State Bank of India",      "Banking",         "NIFTY50,NIFTY500",   1002.7, 1500, 1),
    ("BHARTIARTL",  "BHARTIARTL.NS",  "Bharti Airtel",            "Telecom",         "NIFTY50,NIFTY500",  1799.0,  500, 1),
    ("KOTAKBANK",   "KOTAKBANK.NS",   "Kotak Mahindra Bank",      "Banking",         "NIFTY50,NIFTY500",  381.7,  400, 1),
    ("ITC",         "ITC.NS",         "ITC Limited",              "FMCG",            "NIFTY50,NIFTY500",   280.0, 3200, 1),
    ("LT",          "LT.NS",          "Larsen & Toubro",          "Infrastructure",  "NIFTY50,NIFTY500",  3900.6,  150, 1),
    ("AXISBANK",    "AXISBANK.NS",    "Axis Bank",                "Banking",         "NIFTY50,NIFTY500",  1292.4,  625, 1),
    ("MARUTI",      "MARUTI.NS",      "Maruti Suzuki",            "Auto",            "NIFTY50,NIFTY500", 13120.0,  100, 1),
    ("BAJFINANCE",  "BAJFINANCE.NS",  "Bajaj Finance",            "NBFC",            "NIFTY50,NIFTY500",  886.9,  125, 1),
    ("TITAN",       "TITAN.NS",       "Titan Company",            "Consumer",        "NIFTY50,NIFTY500",  4104.9,  175, 1),
    ("SUNPHARMA",   "SUNPHARMA.NS",   "Sun Pharmaceutical",       "Pharma",          "NIFTY50,NIFTY500",  1779.0,  350, 1),
    ("ULTRACEMCO",  "ULTRACEMCO.NS",  "UltraTech Cement",         "Cement",          "NIFTY50,NIFTY500",  9900.0,  100, 1),
    ("ASIANPAINT",  "ASIANPAINT.NS",  "Asian Paints",             "Consumer",        "NIFTY50,NIFTY500",  2340.0,  200, 1),
    ("WIPRO",       "WIPRO.NS",       "Wipro",                    "IT",              "NIFTY50,NIFTY500",   181.67, 1500, 1),
    ("POWERGRID",   "POWERGRID.NS",   "Power Grid Corporation",   "Utilities",       "NIFTY50,NIFTY500",   330.0, 2700, 1),
    ("TATAMOTORS",  "TATAMOTORS.NS",  "Tata Motors",              "Auto",            "NIFTY50,NIFTY500",   910.0, 1350, 1),
    ("ONGC",        "ONGC.NS",        "Oil & Natural Gas Corp",   "Energy",          "NIFTY50,NIFTY500",   270.0, 3850, 1),
    ("ADANIPORTS",  "ADANIPORTS.NS",  "Adani Ports & SEZ",        "Infrastructure",  "NIFTY50,NIFTY500",  1826.4,  625, 1),
    ("TECHM",       "TECHM.NS",       "Tech Mahindra",            "IT",              "NIFTY50,NIFTY500",  1483.8,  500, 1),
    ("DIVISLAB",    "DIVISLAB.NS",    "Divi's Laboratories",      "Pharma",          "NIFTY50,NIFTY500",  4800.0,  100, 1),
    ("NESTLEIND",   "NESTLEIND.NS",   "Nestlé India",             "FMCG",            "NIFTY50,NIFTY500",  2410.0,  400, 1),
    ("HCLTECH",     "HCLTECH.NS",     "HCL Technologies",         "IT",              "NIFTY50,NIFTY500",  1146.3,  350, 1),
    ("JSWSTEEL",    "JSWSTEEL.NS",    "JSW Steel",                "Metals",          "NIFTY50,NIFTY500",   920.0,  600, 1),
    ("TATASTEEL",   "TATASTEEL.NS",   "Tata Steel",               "Metals",          "NIFTY50,NIFTY500",   203.18, 5500, 1),
    ("NTPC",        "NTPC.NS",        "NTPC Limited",             "Utilities",       "NIFTY50,NIFTY500",   355.65, 2700, 1),
    ("HINDALCO",    "HINDALCO.NS",    "Hindalco Industries",      "Metals",          "NIFTY50,NIFTY500",   1076.7, 1400, 1),
    ("BAJAJFINSV",  "BAJAJFINSV.NS",  "Bajaj Finserv",            "NBFC",            "NIFTY50,NIFTY500",  1920.0,  500, 1),
    ("GRASIM",      "GRASIM.NS",      "Grasim Industries",        "Diversified",     "NIFTY50,NIFTY500",  3095.5,  175, 1),
    ("BPCL",        "BPCL.NS",        "Bharat Petroleum",         "Energy",          "NIFTY50,NIFTY500",   289.1, 1800, 1),
    ("COALINDIA",   "COALINDIA.NS",   "Coal India",               "Mining",          "NIFTY50,NIFTY500",   466.9, 1600, 1),
    ("CIPLA",       "CIPLA.NS",       "Cipla",                    "Pharma",          "NIFTY50,NIFTY500",  1376.5,  650, 1),
    ("EICHERMOT",   "EICHERMOT.NS",   "Eicher Motors",            "Auto",            "NIFTY50,NIFTY500",  7203.0,  175, 1),
    ("BRITANNIA",   "BRITANNIA.NS",   "Britannia Industries",     "FMCG",            "NIFTY50,NIFTY500",  5380.0,  200, 1),
    ("UPL",         "UPL.NS",         "UPL Limited",              "Agro-Chemicals",  "NIFTY50,NIFTY500",   610.0, 1300, 1),
    ("DRREDDY",     "DRREDDY.NS",     "Dr Reddy's Laboratories",  "Pharma",          "NIFTY50,NIFTY500",  1268.5,  125, 1),
    ("M&M",         "M&M.NS",         "Mahindra & Mahindra",      "Auto",            "NIFTY50,NIFTY500",  2990.1,  175, 1),
    ("INDUSINDBK",  "INDUSINDBK.NS",  "IndusInd Bank",            "Banking",         "NIFTY50,NIFTY500",   922.8, 1000, 1),
    ("HEROMOTOCO",  "HEROMOTOCO.NS",  "Hero MotoCorp",            "Auto",            "NIFTY50,NIFTY500",  4390.0,  300, 1),
    ("APOLLOHOSP",  "APOLLOHOSP.NS",  "Apollo Hospitals",         "Healthcare",      "NIFTY50,NIFTY500",  7250.0,  125, 1),
    ("TATACONSUM",  "TATACONSUM.NS",  "Tata Consumer Products",   "FMCG",            "NIFTY50,NIFTY500",  1055.0,  675, 1),
    ("SBILIFE",     "SBILIFE.NS",     "SBI Life Insurance",       "Insurance",       "NIFTY50,NIFTY500",  1690.0,  375, 1),
    ("HDFCLIFE",    "HDFCLIFE.NS",    "HDFC Life Insurance",      "Insurance",       "NIFTY50,NIFTY500",   735.0, 1100, 1),
    ("PIDILITIND",  "PIDILITIND.NS",  "Pidilite Industries",      "Consumer",        "NIFTY50,NIFTY500",  2870.0,  175, 1),
    ("ADANIENT",    "ADANIENT.NS",    "Adani Enterprises",        "Diversified",     "NIFTY50,NIFTY500",  2720.0,  250, 1),
    ("BAJAJ-AUTO",  "BAJAJ-AUTO.NS",  "Bajaj Auto",               "Auto",            "NIFTY50,NIFTY500",  9250.0,   75, 1),

    # ── Nifty Next 50 / Nifty 100 (additional) ────────────────────────────────
    ("GODREJCP",    "GODREJCP.NS",    "Godrej Consumer Products", "FMCG",            "NIFTY100,NIFTY500", 1013.2,  500, 1),
    ("SIEMENS",     "SIEMENS.NS",     "Siemens India",            "Capital Goods",   "NIFTY100,NIFTY500", 3619.8,  100, 1),
    ("HAVELLS",     "HAVELLS.NS",     "Havells India",            "Capital Goods",   "NIFTY100,NIFTY500", 1780.0,  250, 1),
    ("AMBUJACEM",   "AMBUJACEM.NS",   "Ambuja Cements",           "Cement",          "NIFTY100,NIFTY500",  416.0, 1000, 1),
    ("SHREECEM",    "SHREECEM.NS",    "Shree Cement",             "Cement",          "NIFTY100,NIFTY500",25500.0,   50, 1),
    ("LUPIN",       "LUPIN.NS",       "Lupin",                    "Pharma",          "NIFTY100,NIFTY500", 2150.0,  300, 1),
    ("BERGEPAINT",  "BERGEPAINT.NS",  "Berger Paints",            "Consumer",        "NIFTY100,NIFTY500",  560.0, 1000, 0),
    ("DABUR",       "DABUR.NS",       "Dabur India",              "FMCG",            "NIFTY100,NIFTY500",  426.15, 1250, 1),
    ("COLPAL",      "COLPAL.NS",      "Colgate-Palmolive India",  "FMCG",            "NIFTY100,NIFTY500", 2850.0,  175, 0),
    ("MUTHOOTFIN",  "MUTHOOTFIN.NS",  "Muthoot Finance",          "NBFC",            "NIFTY100,NIFTY500", 2991.1,  300, 1),
    ("NAUKRI",      "NAUKRI.NS",      "Info Edge (India)",        "Technology",      "NIFTY100,NIFTY500", 982.6,  100, 1),
    ("BANKBARODA",  "BANKBARODA.NS",  "Bank of Baroda",           "Banking",         "NIFTY100,NIFTY500",  273.75, 5400, 1),
    ("PFC",         "PFC.NS",         "Power Finance Corporation","NBFC",            "NIFTY100,NIFTY500",  475.0, 1350, 1),
    ("RECLTD",      "RECLTD.NS",      "REC Limited",              "NBFC",            "NIFTY100,NIFTY500",  505.0, 1300, 1),
    ("CHOLAFIN",    "CHOLAFIN.NS",    "Cholamandalam Investment",  "NBFC",           "NIFTY100,NIFTY500", 1495.4,  500, 1),
    ("BAJAJHLDNG",  "BAJAJHLDNG.NS",  "Bajaj Holdings",           "Diversified",     "NIFTY100,NIFTY500", 9800.0,   75, 0),
    ("SBICARD",     "SBICARD.NS",     "SBI Cards & Payment",      "NBFC",            "NIFTY100,NIFTY500",  584.95, 800,  1),
    ("ASTRAL",      "ASTRAL.NS",      "Astral Limited",           "Consumer",        "NIFTY100,NIFTY500", 1860.0,  250, 0),
    ("DLF",         "DLF.NS",         "DLF Limited",              "Real Estate",     "NIFTY100,NIFTY500",  575.15, 825,  1),
    ("TRENT",       "TRENT.NS",       "Trent Limited",            "Retail",          "NIFTY100,NIFTY500", 2771.3,  125, 1),
    ("LTIM",        "LTIM.NS",        "LTIMindtree",              "IT",              "NIFTY100,NIFTY500", 5200.0,  150, 1),
    ("PERSISTENT",  "PERSISTENT.NS",  "Persistent Systems",       "IT",              "NIFTY100,NIFTY500", 5680.0,  125, 1),
    ("MPHASIS",     "MPHASIS.NS",     "Mphasis",                  "IT",              "NIFTY100,NIFTY500", 2980.0,  250, 1),
    ("ZOMATO",      "ZOMATO.NS",      "Zomato",                   "Technology",      "NIFTY100,NIFTY500",  245.0, 4500, 1),
    ("PAYTM",       "PAYTM.NS",       "One 97 Communications",    "Technology",      "NIFTY100,NIFTY500",  850.0, 800,  1),
    ("NYKAA",       "NYKAA.NS",       "FSN E-Commerce (Nykaa)",   "Technology",      "NIFTY100,NIFTY500",  215.0, 5600, 1),
    ("POLICYBZR",   "POLICYBZR.NS",   "PB Fintech (PolicyBazaar)","Technology",      "NIFTY100,NIFTY500", 2050.0,  350, 1),
    ("INDIGO",      "INDIGO.NS",      "InterGlobe Aviation",      "Aviation",        "NIFTY100,NIFTY500", 4860.0,  150, 1),
    ("MANKIND",     "MANKIND.NS",     "Mankind Pharma",           "Pharma",          "NIFTY100,NIFTY500", 2550.0,  250, 0),
    ("MARICO",      "MARICO.NS",      "Marico",                   "FMCG",            "NIFTY100,NIFTY500",  710.0, 1100, 1),

    # ── Nifty Midcap 150 ──────────────────────────────────────────────────────
    ("ABCAPITAL",   "ABCAPITAL.NS",   "Aditya Birla Capital",     "NBFC",            "NIFTYMID,NIFTY500",  200.0, 3600, 1),
    ("ABFRL",       "ABFRL.NS",       "Aditya Birla Fashion",     "Retail",          "NIFTYMID,NIFTY500",  295.0, 2000, 1),
    ("AARTIIND",    "AARTIIND.NS",    "Aarti Industries",         "Chemicals",       "NIFTYMID,NIFTY500",  470.0, 1350, 1),
    ("APLAPOLLO",   "APLAPOLLO.NS",   "APL Apollo Tubes",         "Metals",          "NIFTYMID,NIFTY500", 1700.0,  375, 0),
    ("APLLTD",      "APLLTD.NS",      "Alembic Pharma",           "Pharma",          "NIFTYMID,NIFTY500",  995.0,  700, 0),
    ("ASHOKLEY",    "ASHOKLEY.NS",    "Ashok Leyland",            "Auto",            "NIFTYMID,NIFTY500",  220.0, 5000, 1),
    ("AUBANK",      "AUBANK.NS",      "AU Small Finance Bank",    "Banking",         "NIFTYMID,NIFTY500",  655.0, 1000, 1),
    ("BALKRISIND",  "BALKRISIND.NS",  "Balkrishna Industries",    "Auto Ancillaries","NIFTYMID,NIFTY500", 2680.0,  200, 1),
    ("BANDHANBNK",  "BANDHANBNK.NS",  "Bandhan Bank",             "Banking",         "NIFTYMID,NIFTY500",  175.0, 5600, 1),
    ("BHARATFORG",  "BHARATFORG.NS",  "Bharat Forge",             "Auto Ancillaries","NIFTYMID,NIFTY500", 1280.0,  375, 1),
    ("BHEL",        "BHEL.NS",        "Bharat Heavy Electricals", "Capital Goods",   "NIFTYMID,NIFTY500",  230.0, 4400, 1),
    ("CANBK",       "CANBK.NS",       "Canara Bank",              "Banking",         "NIFTYMID,NIFTY500",  105.0,12000, 1),
    ("CESC",        "CESC.NS",        "CESC Limited",             "Utilities",       "NIFTYMID,NIFTY500",  180.0, 4600, 0),
    ("CONCOR",      "CONCOR.NS",      "Container Corporation",    "Logistics",       "NIFTYMID,NIFTY500",  810.0,  750, 1),
    ("CUB",         "CUB.NS",         "City Union Bank",          "Banking",         "NIFTYMID,NIFTY500",  190.0, 4600, 0),
    ("CUMMINSIND",  "CUMMINSIND.NS",  "Cummins India",            "Engineering",     "NIFTYMID,NIFTY500", 3700.0,  150, 1),
    ("DALBHARAT",   "DALBHARAT.NS",   "Dalmia Bharat",            "Cement",          "NIFTYMID,NIFTY500", 1810.0,  250, 1),
    ("DEEPAKNTR",   "DEEPAKNTR.NS",   "Deepak Nitrite",           "Chemicals",       "NIFTYMID,NIFTY500", 2400.0,  250, 1),
    ("DIXON",       "DIXON.NS",       "Dixon Technologies",       "Electronics",     "NIFTYMID,NIFTY500",14200.0,   50, 1),
    ("ESCORTS",     "ESCORTS.NS",     "Escorts Kubota",           "Auto",            "NIFTYMID,NIFTY500", 3550.0,  150, 1),
    ("EXIDEIND",    "EXIDEIND.NS",    "Exide Industries",         "Auto Ancillaries","NIFTYMID,NIFTY500",  410.0, 1800, 1),
    ("FEDERALBNK",  "FEDERALBNK.NS",  "Federal Bank",             "Banking",         "NIFTYMID,NIFTY500",  195.0, 5000, 1),
    ("FORTIS",      "FORTIS.NS",      "Fortis Healthcare",        "Healthcare",      "NIFTYMID,NIFTY500",  655.0,  900, 1),
    ("GLENMARK",    "GLENMARK.NS",    "Glenmark Pharmaceuticals", "Pharma",          "NIFTYMID,NIFTY500", 1280.0,  450, 1),
    ("GMRINFRA",    "GMRINFRA.NS",    "GMR Airports Infrastructure","Infrastructure","NIFTYMID,NIFTY500",   92.0,10000, 1),
    ("GNFC",        "GNFC.NS",        "Gujarat Narmada Valley",   "Chemicals",       "NIFTYMID,NIFTY500",  570.0, 1000, 0),
    ("GODREJPROP",  "GODREJPROP.NS",  "Godrej Properties",        "Real Estate",     "NIFTYMID,NIFTY500", 2040.0,  300, 1),
    ("GRANULES",    "GRANULES.NS",    "Granules India",           "Pharma",          "NIFTYMID,NIFTY500",  625.0, 1000, 1),
    ("GSPL",        "GSPL.NS",        "Gujarat State Petronet",   "Energy",          "NIFTYMID,NIFTY500",  340.0, 1800, 0),
    ("HAL",         "HAL.NS",         "Hindustan Aeronautics",    "Defence",         "NIFTYMID,NIFTY500", 4263.8,  150, 1),
    ("HINDPETRO",   "HINDPETRO.NS",   "Hindustan Petroleum",      "Energy",          "NIFTYMID,NIFTY500",  400.0, 1600, 1),
    ("IDFCFIRSTB",  "IDFCFIRSTB.NS",  "IDFC First Bank",          "Banking",         "NIFTYMID,NIFTY500",   70.0,15000, 1),
    ("IEX",         "IEX.NS",         "Indian Energy Exchange",   "Technology",      "NIFTYMID,NIFTY500",  200.0, 3750, 1),
    ("INDHOTEL",    "INDHOTEL.NS",    "Indian Hotels (Taj)",      "Hotels",          "NIFTYMID,NIFTY500",  700.0,  900, 1),
    ("INDUSTOWER",  "INDUSTOWER.NS",  "Indus Towers",             "Telecom",         "NIFTYMID,NIFTY500",  335.0, 2000, 1),
    ("IRCTC",       "IRCTC.NS",       "Indian Railway Catering",  "Travel",          "NIFTYMID,NIFTY500",  517.85,  625, 1),
    ("JINDALSTEL",  "JINDALSTEL.NS",  "Jindal Steel & Power",     "Metals",          "NIFTYMID,NIFTY500",  940.0,  625, 1),
    ("JUBLFOOD",    "JUBLFOOD.NS",    "Jubilant Foodworks",       "QSR",             "NIFTYMID,NIFTY500",  730.0,  875, 1),
    ("KPITTECH",    "KPITTECH.NS",    "KPIT Technologies",        "IT",              "NIFTYMID,NIFTY500", 1650.0,  400, 1),
    ("LALPATHLAB",  "LALPATHLAB.NS",  "Dr Lal PathLabs",          "Healthcare",      "NIFTYMID,NIFTY500", 2730.0,  150, 1),
    ("LICHSGFIN",   "LICHSGFIN.NS",   "LIC Housing Finance",      "NBFC",            "NIFTYMID,NIFTY500",  620.0, 1000, 1),
    ("M&MFIN",      "M&MFIN.NS",      "Mahindra & Mahindra Fin",  "NBFC",            "NIFTYMID,NIFTY500",  330.0, 1800, 1),
    ("MANAPPURAM",  "MANAPPURAM.NS",  "Manappuram Finance",       "NBFC",            "NIFTYMID,NIFTY500",  205.0, 3000, 1),
    ("MAXHEALTH",   "MAXHEALTH.NS",   "Max Healthcare",           "Healthcare",      "NIFTYMID,NIFTY500",  880.0,  700, 1),
    ("MCX",         "MCX.NS",         "Multi Commodity Exchange",  "Exchange",        "NIFTYMID,NIFTY500", 6250.0,  100, 1),
    ("MGL",         "MGL.NS",         "Mahanagar Gas",            "Energy",          "NIFTYMID,NIFTY500", 1590.0,  400, 1),
    ("MOTILALOFS",  "MOTILALOFS.NS",  "Motilal Oswal Financial",  "NBFC",            "NIFTYMID,NIFTY500", 1020.0,  700, 1),
    ("MRF",         "MRF.NS",         "MRF Limited",              "Auto Ancillaries","NIFTYMID,NIFTY500",132000.0,  10, 0),
    ("MUTHOOTFIN",  "MUTHOOTFIN.NS",  "Muthoot Finance",          "NBFC",            "NIFTYMID,NIFTY500", 2991.1,  300, 1),
    ("NAM-INDIA",   "NAM-INDIA.NS",   "Nippon Life India AMC",    "Finance",         "NIFTYMID,NIFTY500",  590.0,  800, 0),
    ("NATIONALUM",  "NATIONALUM.NS",  "National Aluminium",       "Metals",          "NIFTYMID,NIFTY500",  215.0, 4000, 1),
    ("NAVINFLUOR",  "NAVINFLUOR.NS",  "Navin Fluorine",           "Chemicals",       "NIFTYMID,NIFTY500", 3650.0,  100, 1),
    ("NMDC",        "NMDC.NS",        "NMDC Limited",             "Mining",          "NIFTYMID,NIFTY500",  235.0, 4000, 1),
    ("NUVOCO",      "NUVOCO.NS",      "Nuvoco Vistas",            "Cement",          "NIFTYMID,NIFTY500",  370.0, 1500, 0),
    ("OBEROIRLTY",  "OBEROIRLTY.NS",  "Oberoi Realty",            "Real Estate",     "NIFTYMID,NIFTY500", 1780.0,  300, 1),
    ("OFSS",        "OFSS.NS",        "Oracle Financial Services", "IT",             "NIFTYMID,NIFTY500",10500.0,   50, 0),
    ("OIL",         "OIL.NS",         "Oil India",                "Energy",          "NIFTYMID,NIFTY500",  490.0, 1250, 1),
    ("PAGEIND",     "PAGEIND.NS",     "Page Industries (Jockey)", "Retail",          "NIFTYMID,NIFTY500",44500.0,   15, 0),
    ("PIIND",       "PIIND.NS",       "PI Industries",            "Agro-Chemicals",  "NIFTYMID,NIFTY500", 4200.0,  125, 1),
    ("POLYCAB",     "POLYCAB.NS",     "Polycab India",            "Capital Goods",   "NIFTYMID,NIFTY500", 7200.0,  100, 1),
    ("PRESTIGE",    "PRESTIGE.NS",    "Prestige Estates",         "Real Estate",     "NIFTYMID,NIFTY500", 1610.0,  350, 1),
    ("PVR",         "PVR.NS",         "PVR INOX",                 "Entertainment",   "NIFTYMID,NIFTY500", 1490.0,  350, 1),
    ("RAMCOCEM",    "RAMCOCEM.NS",    "Ramco Cements",            "Cement",          "NIFTYMID,NIFTY500",  965.0,  650, 1),
    ("SAIL",        "SAIL.NS",        "Steel Authority of India",  "Metals",         "NIFTYMID,NIFTY500",  130.0, 6000, 1),
    ("SOLARINDS",   "SOLARINDS.NS",   "Solar Industries India",   "Defence",         "NIFTYMID,NIFTY500", 9800.0,   75, 1),
    ("SRF",         "SRF.NS",         "SRF Limited",              "Chemicals",       "NIFTYMID,NIFTY500", 2410.0,  200, 1),
    ("STAR",        "STAR.NS",        "Star Health Insurance",    "Insurance",        "NIFTYMID,NIFTY500",  605.0,  750, 1),
    ("SUNDARMFIN",  "SUNDARMFIN.NS",  "Sundaram Finance",         "NBFC",            "NIFTYMID,NIFTY500", 5200.0,  100, 0),
    ("SUPREMEIND",  "SUPREMEIND.NS",  "Supreme Industries",       "Consumer",        "NIFTYMID,NIFTY500", 4850.0,  100, 0),
    ("TATACOMM",    "TATACOMM.NS",    "Tata Communications",      "Telecom",         "NIFTYMID,NIFTY500", 1850.0,  250, 1),
    ("TATACHEM",    "TATACHEM.NS",    "Tata Chemicals",           "Chemicals",       "NIFTYMID,NIFTY500", 1080.0,  550, 1),
    ("TATAELXSI",   "TATAELXSI.NS",   "Tata Elxsi",               "IT",              "NIFTYMID,NIFTY500", 4257.2,  125, 1),
    ("TATAINVEST",  "TATAINVEST.NS",  "Tata Investment Corp",     "Diversified",     "NIFTYMID,NIFTY500", 6800.0,  100, 0),
    ("THYROCARE",   "THYROCARE.NS",   "Thyrocare Technologies",   "Healthcare",      "NIFTYMID,NIFTY500",  710.0,  600, 0),
    ("TORNTPHARM",  "TORNTPHARM.NS",  "Torrent Pharmaceuticals",  "Pharma",          "NIFTYMID,NIFTY500", 3150.0,  150, 1),
    ("TORNTPOWER",  "TORNTPOWER.NS",  "Torrent Power",            "Utilities",       "NIFTYMID,NIFTY500", 1760.0,  250, 1),
    ("TTML",        "TTML.NS",        "Tata Teleservices Maharashtra","Telecom",      "NIFTYMID,NIFTY500",   90.0, 8600, 0),
    ("TVS",         "TVSMOTOR.NS",    "TVS Motor Company",        "Auto",            "NIFTYMID,NIFTY500", 2690.0,  375, 1),
    ("UBL",         "UBL.NS",         "United Breweries",         "FMCG",            "NIFTYMID,NIFTY500", 1910.0,  250, 1),
    ("UNIONBANK",   "UNIONBANK.NS",   "Union Bank of India",      "Banking",         "NIFTYMID,NIFTY500",  130.0, 5000, 1),
    ("VEDL",        "VEDL.NS",        "Vedanta Limited",          "Mining",          "NIFTYMID,NIFTY500",  480.0, 2000, 1),
    ("VOLTAS",      "VOLTAS.NS",      "Voltas Limited",           "Consumer",        "NIFTYMID,NIFTY500", 1750.0,  350, 1),
    ("WHIRLPOOL",   "WHIRLPOOL.NS",   "Whirlpool of India",       "Consumer",        "NIFTYMID,NIFTY500", 1650.0,  250, 0),
    ("ZEEL",        "ZEEL.NS",        "Zee Entertainment",        "Media",           "NIFTYMID,NIFTY500",  145.0, 3000, 1),
    ("ZYDUSLIFE",   "ZYDUSLIFE.NS",   "Zydus Lifesciences",       "Pharma",          "NIFTYMID,NIFTY500",  935.0,  700, 1),

    # ── Nifty Smallcap 250 / Additional ───────────────────────────────────────
    ("AEGISLOG",    "AEGISLOG.NS",    "Aegis Logistics",          "Logistics",       "NIFTY500",  475.0,  800, 0),
    ("ALKEM",       "ALKEM.NS",       "Alkem Laboratories",       "Pharma",          "NIFTY500", 5650.0,  100, 0),
    ("ANGELONE",    "ANGELONE.NS",    "Angel One",                "NBFC",            "NIFTY500", 2300.0,  250, 1),
    ("APTUS",       "APTUS.NS",       "Aptus Value Housing",      "NBFC",            "NIFTY500",  395.0, 1400, 0),
    ("AUROPHARMA",  "AUROPHARMA.NS",  "Aurobindo Pharma",         "Pharma",          "NIFTY500", 1300.0,  500, 1),
    ("AVANTIFEED",  "AVANTIFEED.NS",  "Avanti Feeds",             "Aquaculture",     "NIFTY500",  630.0,  800, 0),
    ("BAJAJCON",    "BAJAJCON.NS",    "Bajaj Consumer Care",      "FMCG",            "NIFTY500",  295.0, 1600, 0),
    ("BALRAMCHIN",  "BALRAMCHIN.NS",  "Balrampur Chini Mills",    "Sugar",           "NIFTY500",  610.0, 1000, 1),
    ("BATAINDIA",   "BATAINDIA.NS",   "Bata India",               "Retail",          "NIFTY500", 1560.0,  375, 1),
    ("BDL",         "BDL.NS",         "Bharat Dynamics",          "Defence",         "NIFTY500", 1280.0,  400, 1),
    ("BEML",        "BEML.NS",        "BEML Limited",             "Capital Goods",   "NIFTY500", 4100.0,  125, 1),
    ("BLUEDART",    "BLUEDART.NS",    "Blue Dart Express",        "Logistics",       "NIFTY500", 7200.0,   50, 0),
    ("CHAMBLFERT",  "CHAMBLFERT.NS",  "Chambal Fertilizers",      "Fertilizers",     "NIFTY500",  510.0, 1500, 1),
    ("CROMPTON",    "CROMPTON.NS",    "Crompton Greaves Consumer","Consumer",         "NIFTY500",  380.0, 2000, 1),
    ("CSBBANK",     "CSBBANK.NS",     "CSB Bank",                 "Banking",         "NIFTY500",  385.0, 1600, 0),
    ("DELHIVERY",   "DELHIVERY.NS",   "Delhivery",                "Logistics",       "NIFTY500",  400.0, 1800, 1),
    ("DELTACORP",   "DELTACORP.NS",   "Delta Corp",               "Gaming",          "NIFTY500",  175.0, 4000, 1),
    ("ELECON",      "ELECON.NS",      "Elecon Engineering",       "Capital Goods",   "NIFTY500",  680.0,  900, 0),
    ("EMAMILTD",    "EMAMILTD.NS",    "Emami Limited",            "FMCG",            "NIFTY500",  605.0, 1000, 1),
    ("ENGINERSIN",  "ENGINERSIN.NS",  "Engineers India",          "Capital Goods",   "NIFTY500",  265.0, 2400, 0),
    ("EPL",         "EPL.NS",         "EPL Limited",              "Packaging",       "NIFTY500",  240.0, 2600, 0),
    ("EQUITASBNK",  "EQUITASBNK.NS",  "Equitas Small Finance Bank","Banking",        "NIFTY500",  105.0, 5800, 1),
    ("ESTER",       "ESTER.NS",       "Ester Industries",         "Chemicals",       "NIFTY500",  350.0, 1800, 0),
    ("FINEORG",     "FINEORG.NS",     "Fine Organic Industries",  "Chemicals",       "NIFTY500", 5850.0,  100, 0),
    ("FIRSTSOURCE", "FSL.NS",         "First Source Solutions",   "Technology",      "NIFTY500",  260.0, 2000, 1),
    ("FLUOROCHEM",  "FLUOROCHEM.NS",  "Gujarat Fluorochemicals",  "Chemicals",       "NIFTY500", 3900.0,  150, 1),
    ("GAIL",        "GAIL.NS",        "GAIL India",               "Energy",          "NIFTY500",  215.0, 3850, 1),
    ("GARFIBRES",   "GARFIBRES.NS",   "Garware Technical Fibres", "Textiles",        "NIFTY500", 3800.0,  150, 0),
    ("GESHIP",      "GESHIP.NS",      "Great Eastern Shipping",   "Shipping",        "NIFTY500", 1150.0,  500, 0),
    ("GILLETTE",    "GILLETTE.NS",    "Gillette India",           "FMCG",            "NIFTY500", 9750.0,   50, 0),
    ("GLAXO",       "GLAXO.NS",       "GSK Pharma India",         "Pharma",          "NIFTY500", 2220.0,  225, 0),
    ("GPPL",        "GPPL.NS",        "Gujarat Pipavav Port",     "Infrastructure",  "NIFTY500",  195.0, 3400, 0),
    ("GRINDWELL",   "GRINDWELL.NS",   "Grindwell Norton",         "Capital Goods",   "NIFTY500", 2150.0,  225, 0),
    ("GSFC",        "GSFC.NS",        "Gujarat State Fertilizers","Fertilizers",     "NIFTY500",  285.0, 2200, 1),
    ("HEG",         "HEG.NS",         "HEG Limited",              "Metals",          "NIFTY500", 2600.0,  200, 1),
    ("HINDCOPPER",  "HINDCOPPER.NS",  "Hindustan Copper",         "Metals",          "NIFTY500",  295.0, 2200, 1),
    ("IBULHSGFIN",  "IBULHSGFIN.NS",  "Indiabulls Housing Fin",   "NBFC",            "NIFTY500",  190.0, 4000, 1),
    ("ICICIPRULI",  "ICICIPRULI.NS",  "ICICI Prudential Life",    "Insurance",       "NIFTY500",  660.0,  750, 1),
    ("ICICIGI",     "ICICIGI.NS",     "ICICI Lombard GIC",        "Insurance",       "NIFTY500", 1850.0,  375, 1),
    ("IFBIND",      "IFBIND.NS",      "IFB Industries",           "Consumer",        "NIFTY500",  500.0, 1200, 0),
    ("IGPL",        "IGPL.NS",        "IG Petrochemicals",        "Chemicals",       "NIFTY500",  920.0,  650, 0),
    ("IIFL",        "IIFL.NS",        "IIFL Finance",             "NBFC",            "NIFTY500",  430.0, 1500, 1),
    ("INDIGOPNTS",  "INDIGOPNTS.NS",  "Indigo Paints",            "Consumer",        "NIFTY500", 1450.0,  400, 0),
    ("IOC",         "IOC.NS",         "Indian Oil Corporation",   "Energy",          "NIFTY500",  155.0, 6500, 1),
    ("IPCALAB",     "IPCALAB.NS",     "IPCA Laboratories",        "Pharma",          "NIFTY500", 1560.0,  400, 1),
    ("IRB",         "IRB.NS",         "IRB Infrastructure",       "Infrastructure",  "NIFTY500",   54.0,18000, 1),
    ("IRFC",        "IRFC.NS",        "Indian Railway Finance",   "NBFC",            "NIFTY500",  205.0, 4000, 1),
    ("ISEC",        "ISEC.NS",        "ICICI Securities",         "NBFC",            "NIFTY500",  760.0,  800, 1),
    ("ITC",         "ITC.NS",         "ITC Limited",              "FMCG",            "NIFTY500",  280.0, 3200, 1),
    ("JBCHEPHARM",  "JBCHEPHARM.NS",  "JB Chemicals & Pharma",   "Pharma",          "NIFTY500", 1890.0,  275, 0),
    ("JK CEMENT",   "JKCEMENT.NS",    "JK Cement",                "Cement",          "NIFTY500", 4850.0,  100, 1),
    ("JMFINANCIL",  "JMFINANCIL.NS",  "JM Financial",             "NBFC",            "NIFTY500",  125.0, 5000, 0),
    ("JPPOWER",     "JPPOWER.NS",     "Jaiprakash Power",         "Utilities",       "NIFTY500",   14.5,40000, 1),
    ("KALYANKJIL",  "KALYANKJIL.NS",  "Kalyan Jewellers",         "Consumer",        "NIFTY500",  625.0, 1000, 1),
    ("KFINTECH",    "KFINTECH.NS",    "KFin Technologies",        "Technology",      "NIFTY500",  960.0,  600, 0),
    ("KNRCON",      "KNRCON.NS",      "KNR Constructions",        "Infrastructure",  "NIFTY500",  335.0, 1800, 0),
    ("KOLTEPATIL",  "KOLTEPATIL.NS",  "Kolte-Patil Developers",   "Real Estate",     "NIFTY500",  465.0, 1400, 0),
    ("KPRMILL",     "KPRMILL.NS",     "KPR Mill",                 "Textiles",        "NIFTY500",  810.0,  900, 0),
    ("KRBL",        "KRBL.NS",        "KRBL Limited (India Gate)", "Food",           "NIFTY500",  375.0, 1600, 0),
    ("KSB",         "KSB.NS",         "KSB Limited",              "Capital Goods",   "NIFTY500", 3750.0,  150, 0),
    ("LICI",        "LICI.NS",        "Life Insurance Corp of India","Insurance",     "NIFTY500", 403.9,  700, 1),
    ("LINDEINDIA",  "LINDEINDIA.NS",  "Linde India",              "Chemicals",       "NIFTY500", 7200.0,   75, 0),
    ("LTTS",        "LTTS.NS",        "LTI WorldWide (LTTS)",     "IT",              "NIFTY500", 4950.0,  125, 1),
    ("MASTEK",      "MASTEK.NS",      "Mastek",                   "IT",              "NIFTY500", 2580.0,  200, 0),
    ("METROPOLIS",  "METROPOLIS.NS",  "Metropolis Healthcare",    "Healthcare",      "NIFTY500", 2100.0,  225, 0),
    ("MFSL",        "MFSL.NS",        "Max Financial Services",   "Insurance",       "NIFTY500", 1200.0,  500, 1),
    ("MINDACORP",   "MINDACORP.NS",   "Minda Corporation",        "Auto Ancillaries","NIFTY500",  435.0, 1500, 0),
    ("MINDAIND",    "MINDAIND.NS",    "Minda Industries",         "Auto Ancillaries","NIFTY500", 1005.0,  600, 1),
    ("MIRZAINT",    "MIRZAINT.NS",    "Mirza International",      "Leather",         "NIFTY500",  360.0, 1800, 0),
    ("MOIL",        "MOIL.NS",        "MOIL Limited",             "Mining",          "NIFTY500",  490.0, 1350, 1),
    ("MOLDTKPAC",   "MOLDTKPAC.NS",   "Mold-Tek Packaging",       "Packaging",       "NIFTY500",  835.0,  600, 0),
    ("NATCOPHARM",  "NATCOPHARM.NS",  "Natco Pharma",             "Pharma",          "NIFTY500", 1490.0,  400, 1),
    ("NBCC",        "NBCC.NS",        "NBCC India",               "Real Estate",     "NIFTY500",  125.0, 5800, 1),
    ("NESTLEIND",   "NESTLEIND.NS",   "Nestlé India",             "FMCG",            "NIFTY500", 2410.0,  400, 1),
    ("NILKAMAL",    "NILKAMAL.NS",    "Nilkamal Limited",         "Consumer",        "NIFTY500", 2550.0,  200, 0),
    ("NOCIL",       "NOCIL.NS",       "NOCIL Limited",            "Chemicals",       "NIFTY500",  335.0, 1800, 0),
    ("NRBBEARING",  "NRBBEARING.NS",  "NRB Bearing",              "Auto Ancillaries","NIFTY500",  280.0, 2200, 0),
    ("OMAXE",       "OMAXE.NS",       "Omaxe",                    "Real Estate",     "NIFTY500",  175.0, 4000, 0),
    ("OPTIEMUS",    "OPTIEMUS.NS",    "Optiemus Infracom",        "Electronics",     "NIFTY500",  390.0, 1600, 0),
    ("ORIENTELEC",  "ORIENTELEC.NS",  "Orient Electric",          "Consumer",        "NIFTY500",  285.0, 2200, 0),
    ("PGHH",        "PGHH.NS",        "Procter & Gamble H&H",     "FMCG",            "NIFTY500",15500.0,   40, 0),
    ("PHOENIXLTD",  "PHOENIXLTD.NS",  "Phoenix Mills",            "Real Estate",     "NIFTY500", 1790.0,  250, 1),
    ("PRINCEPIPE",  "PRINCEPIPE.NS",  "Prince Pipes and Fittings","Consumer",        "NIFTY500",  490.0, 1250, 0),
    ("RADICO",      "RADICO.NS",      "Radico Khaitan",           "FMCG",            "NIFTY500", 2430.0,  250, 1),
    ("RAJESHEXPO",  "RAJESHEXPO.NS",  "Rajesh Exports",           "Jewellery",       "NIFTY500",  340.0, 1800, 1),
    ("RAYMOND",     "RAYMOND.NS",     "Raymond",                  "Textiles",        "NIFTY500", 2050.0,  300, 0),
    ("RELAXO",      "RELAXO.NS",      "Relaxo Footwears",         "Retail",          "NIFTY500",  895.0,  700, 0),
    ("RITES",       "RITES.NS",       "RITES Limited",            "Infrastructure",  "NIFTY500",  575.0,  900, 1),
    ("RPOWER",      "RPOWER.NS",      "Reliance Power",           "Utilities",       "NIFTY500",   44.0,20000, 1),
    ("SAFARI",      "SAFARI.NS",      "Safari Industries",        "Consumer",        "NIFTY500", 2600.0,  200, 0),
    ("SANOFI",      "SANOFI.NS",      "Sanofi India",             "Pharma",          "NIFTY500", 8750.0,   75, 0),
    ("SAPPHIRE",    "SAPPHIRE.NS",    "Sapphire Foods",           "QSR",             "NIFTY500", 1270.0,  400, 0),
    ("SCHAEFFLER",  "SCHAEFFLER.NS",  "Schaeffler India",         "Auto Ancillaries","NIFTY500", 4650.0,  125, 0),
    ("SCHNEIDER",   "SCHNEIDER.NS",   "Schneider Electric Infra", "Capital Goods",   "NIFTY500",  250.0, 2400, 0),
    ("SHOPERSTOP",  "SHOPERSTOP.NS",  "Shoppers Stop",            "Retail",          "NIFTY500",  740.0,  800, 0),
    ("SHRIRAMFIN",  "SHRIRAMFIN.NS",  "Shriram Finance",          "NBFC",            "NIFTY500", 911.7,  125, 1),
    ("SOBHA",       "SOBHA.NS",       "Sobha",                    "Real Estate",     "NIFTY500", 1870.0,  250, 0),
    ("SPARC",       "SPARC.NS",       "Sun Pharma Advanced Res",  "Pharma",          "NIFTY500",  250.0, 2600, 1),
    ("SPANDANA",    "SPANDANA.NS",    "Spandana Sphoorty Fin",    "NBFC",            "NIFTY500",  665.0,  900, 0),
    ("STARHEALTH",  "STARHEALTH.NS",  "Star Health Insurance",    "Insurance",       "NIFTY500",  605.0,  750, 1),
    ("STLTECH",     "STLTECH.NS",     "Sterlite Technologies",    "Telecom",         "NIFTY500",  210.0, 3600, 1),
    ("SUNTECK",     "SUNTECK.NS",     "Sunteck Realty",           "Real Estate",     "NIFTY500",  480.0, 1300, 0),
    ("SUNTV",       "SUNTV.NS",       "Sun TV Network",           "Media",           "NIFTY500",  790.0,  750, 1),
    ("SUPRAJIT",    "SUPRAJIT.NS",    "Suprajit Engineering",     "Auto Ancillaries","NIFTY500",  385.0, 1600, 0),
    ("SUVEN",       "SUVEN.NS",       "Suven Pharmaceuticals",    "Pharma",          "NIFTY500",  990.0,  700, 0),
    ("SWSOLAR",     "SWSOLAR.NS",     "Sterling Wilson Solar",    "Energy",          "NIFTY500",  485.0, 1300, 0),
    ("SYMPHONY",    "SYMPHONY.NS",    "Symphony Limited",         "Consumer",        "NIFTY500", 1290.0,  450, 0),
    ("TANLA",       "TANLA.NS",       "Tanla Platforms",          "Technology",      "NIFTY500",  890.0,  700, 1),
    ("TARSONS",     "TARSONS.NS",     "Tarsons Products",         "Healthcare",      "NIFTY500",  430.0, 1500, 0),
    ("TASTYBITE",   "TASTYBITE.NS",   "Tasty Bite Eatables",      "Food",            "NIFTY500",21500.0,   20, 0),
    ("TEAMLEASE",   "TEAMLEASE.NS",   "TeamLease Services",       "HR Services",     "NIFTY500", 3250.0,  150, 0),
    ("TEJASNET",    "TEJASNET.NS",    "Tejas Networks",           "Telecom",         "NIFTY500",  945.0,  700, 0),
    ("TIINDIA",     "TIINDIA.NS",     "Tube Investments of India","Auto Ancillaries","NIFTY500", 3800.0,  150, 1),
    ("TIMKEN",      "TIMKEN.NS",      "Timken India",             "Auto Ancillaries","NIFTY500", 3600.0,  150, 0),
    ("TINPLATE",    "TINPLATE.NS",    "Tinplate Company of India","Metals",          "NIFTY500",  455.0, 1350, 0),
    ("TTKPRESTIG",  "TTKPRESTIG.NS",  "TTK Prestige",             "Consumer",        "NIFTY500",  810.0,  750, 0),
    ("UJJIVANSFB",  "UJJIVANSFB.NS",  "Ujjivan Small Finance Bank","Banking",        "NIFTY500",   50.0,18000, 1),
    ("UCOBANK",     "UCOBANK.NS",     "UCO Bank",                 "Banking",         "NIFTY500",   60.0,16000, 1),
    ("UNITDSPR",    "UNITDSPR.NS",    "United Spirits (Diageo)",  "FMCG",            "NIFTY500", 1490.0,  400, 1),
    ("V-MART",      "VMART.NS",       "V-Mart Retail",            "Retail",          "NIFTY500", 3200.0,  150, 0),
    ("VBL",         "VBL.NS",         "Varun Beverages",          "Beverages",       "NIFTY500", 529.75,  375, 1),
    ("VGUARD",      "VGUARD.NS",      "V-Guard Industries",       "Consumer",        "NIFTY500",  420.0, 1800, 0),
    ("VINATIORGA",  "VINATIORGA.NS",  "Vinati Organics",          "Chemicals",       "NIFTY500", 2120.0,  250, 1),
    ("VSTIND",      "VSTIND.NS",      "VST Industries",           "FMCG",            "NIFTY500", 4850.0,  100, 0),
    ("WELCORP",     "WELCORP.NS",     "Welspun Corp",             "Metals",          "NIFTY500",  840.0,  750, 0),
    ("WELSPUNIND",  "WELSPUNIND.NS",  "Welspun India",            "Textiles",        "NIFTY500",  235.0, 2800, 1),
    ("WESTLIFE",    "WESTLIFE.NS",    "Westlife Foodworld",       "QSR",             "NIFTY500",  960.0,  625, 0),
    ("WIPRO",       "WIPRO.NS",       "Wipro",                    "IT",              "NIFTY500",  181.67, 1500, 1),
    ("WOCKPHARMA",  "WOCKPHARMA.NS",  "Wockhardt",                "Pharma",          "NIFTY500", 1090.0,  550, 1),
    ("ZENTEC",      "ZENTEC.NS",      "Zen Technologies",         "Defence",         "NIFTY500",  940.0,  800, 0),
]


# ─────────────────────────────────────────────────────────────────────────────
# 2. F&O UNDERLYING LIST
#    (symbol, lot_size, base_price, strike_step)
# ─────────────────────────────────────────────────────────────────────────────
FO_UNDERLYINGS = [
    # Indices
    ("NIFTY",       25,    23242.1, 100),
    ("BANKNIFTY",   15,    55194.5, 200),
    ("FINNIFTY",    40,    25152.45, 100),
    # Stocks (subset of F&O eligible)
    ("RELIANCE",   250,    1269.2,   50),
    ("TCS",        150,    2151.0,  100),
    ("HDFCBANK",   550,    738.35,   50),
    ("ICICIBANK",  700,    1275.0,   50),
    ("INFY",       600,    1180.3,   50),
    ("SBIN",      1500,     1002.7,   20),
    ("BHARTIARTL", 500,    1799.0,   50),
    ("KOTAKBANK",  400,    381.7,   50),
    ("ITC",       3200,     280.0,   10),
    ("LT",         150,    3900.6,  100),
    ("AXISBANK",   625,    1292.4,   50),
    ("MARUTI",     100,   13120.0,  500),
    ("BAJFINANCE",  125,   886.9,  200),
    ("TITAN",      175,    4104.9,  100),
    ("SUNPHARMA",  350,    1779.0,   50),
    ("WIPRO",     1500,     181.67,   10),
    ("TATAMOTORS",1350,     910,   20),
    ("ADANIPORTS", 625,    1826.4,   50),
    ("TECHM",      500,    1483.8,   50),
    ("HCLTECH",    350,    1146.3,   50),
    ("TATASTEEL", 5500,     203.18,    5),
    ("NTPC",      2700,     355.65,   10),
    ("HINDALCO",  1400,     1076.7,   20),
    ("BPCL",      1800,     289.1,   10),
    ("COALINDIA", 1600,     466.9,   10),
    ("CIPLA",      650,    1376.5,   50),
    ("DRREDDY",    125,    1268.5,  200),
    ("EICHERMOT",  175,    7203.0,  100),
    ("GRASIM",     175,    3095.5,  100),
    ("M&M",        175,    2990.1,  100),
    ("INDUSINDBK",1000,     922.8,   20),
    ("DLF",        825,     575.15,   20),
    ("TRENT",      125,    2771.3,  200),
    ("LTIM",       150,    5200,  200),
    ("ZOMATO",    4500,     245,    5),
    ("GODREJCP",   500,    1013.2,   50),
    ("SIEMENS",    100,    3619.8,  200),
    ("AMBUJACEM", 1000,     416.0,   20),
    ("DABUR",     1250,     426.15,   20),
    ("MUTHOOTFIN", 300,    2991.1,   50),
    ("NAUKRI",     100,    982.6,  200),
    ("BANKBARODA",5400,     273.75,    5),
    ("CHOLAFIN",   500,    1495.4,   50),
    ("SBICARD",    800,     584.95,   20),
    ("HAL",        150,    4263.8,  100),
    ("LICI",       700,    403.9,   20),
    ("SHRIRAMFIN", 125,    911.7,  100),
    ("IRCTC",      625,     517.85,   20),
    ("TATAELXSI",  125,    4257.2,  200),
    ("VBL",        375,    529.75,   50),
]


# ─────────────────────────────────────────────────────────────────────────────
# 3. EXPIRY DATE CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def get_next_n_thursdays(n: int = 3) -> list[str]:
    """Returns the next N upcoming Thursday expiry dates."""
    today = date.today()
    thursdays = []
    d = today
    while len(thursdays) < n:
        if d.weekday() == 3:   # Thursday
            thursdays.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return thursdays


def get_next_n_monthly_expiries(n: int = 2) -> list[str]:
    """Returns the last Thursday of the next N months (monthly expiry)."""
    today = date.today()
    expiries = []
    year, month = today.year, today.month

    while len(expiries) < n:
        last_day = calendar.monthrange(year, month)[1]
        # Find last Thursday of the month
        for day in range(last_day, last_day - 7, -1):
            if date(year, month, day).weekday() == 3:
                d_str = date(year, month, day).strftime("%Y-%m-%d")
                if date(year, month, day) >= today:
                    expiries.append(d_str)
                break
        month += 1
        if month > 12:
            month = 1
            year += 1

    return expiries[:n]


# ─────────────────────────────────────────────────────────────────────────────
# 4. MAIN INIT FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def init_all():
    logger.info("=== Initializing Asset Universe Database ===")
    init_schema()

    # ── Stocks ────────────────────────────────────────────────────────────────
    logger.info(f"Inserting {len(NIFTY_STOCKS)} stocks...")
    # Deduplicate by symbol
    seen = set()
    unique_stocks = []
    for row in NIFTY_STOCKS:
        sym = row[0]
        if sym not in seen:
            seen.add(sym)
            unique_stocks.append(row)
    bulk_upsert_stocks(unique_stocks)
    logger.info(f"✅ Stocks inserted: {get_stock_count()}")

    # ── F&O Options & Futures ─────────────────────────────────────────────────
    weekly_expiries  = get_next_n_thursdays(3)
    monthly_expiries = get_next_n_monthly_expiries(2)
    all_expiries     = list(dict.fromkeys(weekly_expiries + monthly_expiries))  # dedupe, preserve order

    logger.info(f"Using expiries: {all_expiries}")

    opt_rows = []
    fut_rows = []

    for (underlying, lot_size, base_price, strike_step) in FO_UNDERLYINGS:
        # Options — 11 strikes around ATM (ATM ± 5 steps)
        for expiry in all_expiries:
            atm_strike = round(base_price / strike_step) * strike_step
            for offset in range(-5, 6):   # -5 to +5 = 11 strikes
                strike = atm_strike + offset * strike_step

                exp_label = date.fromisoformat(expiry).strftime("%d%b").upper()  # e.g. 29MAY

                for opt_type in ("CE", "PE"):
                    label = f"{underlying} {int(strike)} {opt_type} {exp_label}"
                    opt_rows.append((underlying, opt_type, float(strike), expiry, lot_size, label))

        # Futures — near-month and next-month
        for i, expiry in enumerate(monthly_expiries[:2], start=1):
            exp_label = date.fromisoformat(expiry).strftime("%d%b").upper()
            label = f"{underlying} FUT {exp_label}"
            fut_rows.append((underlying, expiry, i, lot_size, label))

    logger.info(f"Inserting {len(opt_rows)} option contracts...")
    bulk_insert_fo_options(opt_rows)

    logger.info(f"Inserting {len(fut_rows)} futures contracts...")
    bulk_insert_fo_futures(fut_rows)

    counts = get_fo_counts()
    logger.info(f"✅ F&O Options inserted: {counts['options']}")
    logger.info(f"✅ F&O Futures inserted: {counts['futures']}")
    logger.info("=== Asset Universe Initialization Complete ===")


def init_if_empty():
    """Called from server startup — only runs if DB is empty."""
    init_schema()
    if get_stock_count() == 0:
        logger.info("[StockDB] Database is empty, running full initialization...")
        init_all()
    else:
        logger.info(f"[StockDB] Database already populated ({get_stock_count()} stocks). Skipping init.")


if __name__ == "__main__":
    init_all()
