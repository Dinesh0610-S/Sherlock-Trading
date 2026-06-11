import logging
import requests
import json
import re
from datetime import datetime, timedelta
from backend.ai_client import call_llm

logger = logging.getLogger(__name__)

def fetch_fii_dii_data():
    """
    Fetch FII/DII data from the local Node.js proxy server.
    """
    records = []
    today_rec = None

    # 1. Fetch Today's Flow
    try:
        resp = requests.get("http://localhost:3001/api/fiidii/today", timeout=5)
        if resp.status_code == 200:
            today_data = resp.json()
            if today_data and "error" not in today_data:
                fii_data = today_data.get("fii", {})
                dii_data = today_data.get("dii", {})
                today_rec = {
                    "date": today_data.get("date", ""),
                    "fii_buy": float(fii_data.get("buy", 0.0)),
                    "fii_sell": float(fii_data.get("sell", 0.0)),
                    "fii_net": float(fii_data.get("net", 0.0)),
                    "dii_buy": float(dii_data.get("buy", 0.0)),
                    "dii_sell": float(dii_data.get("sell", 0.0)),
                    "dii_net": float(dii_data.get("net", 0.0)),
                }
                records.append(today_rec)
    except Exception as e:
        logger.warning(f"Failed to fetch today FII/DII from proxy: {e}")

    # 2. Fetch History
    try:
        resp = requests.get("http://localhost:3001/api/fiidii/history", timeout=5)
        if resp.status_code == 200:
            history_data = resp.json()
            if isinstance(history_data, list):
                grouped = {}
                for item in history_data:
                    date = item.get("date") or item.get("tradeDate") or item.get("dateVal") or ""
                    if not date:
                        continue
                    
                    category = item.get("category", "")
                    if date not in grouped:
                        grouped[date] = {
                            "date": date,
                            "fii_buy": 0.0, "fii_sell": 0.0, "fii_net": 0.0,
                            "dii_buy": 0.0, "dii_sell": 0.0, "dii_net": 0.0
                        }
                    
                    if "FII" in category or "FPI" in category:
                        grouped[date]["fii_buy"] = float(item.get("buyValue") or item.get("fiiBuy") or item.get("fii_buy") or 0.0)
                        grouped[date]["fii_sell"] = float(item.get("sellValue") or item.get("fiiSell") or item.get("fii_sell") or 0.0)
                        grouped[date]["fii_net"] = float(item.get("netValue") or item.get("fiiNet") or item.get("fii_net") or 0.0)
                    elif "DII" in category:
                        grouped[date]["dii_buy"] = float(item.get("buyValue") or item.get("diiBuy") or item.get("dii_buy") or 0.0)
                        grouped[date]["dii_sell"] = float(item.get("sellValue") or item.get("diiSell") or item.get("dii_sell") or 0.0)
                        grouped[date]["dii_net"] = float(item.get("netValue") or item.get("diiNet") or item.get("dii_net") or 0.0)
                    else:
                        # Combined format (fiiBuy, diiBuy, etc.)
                        grouped[date]["fii_buy"] = float(item.get("fiiBuy") or item.get("fii_buy") or grouped[date]["fii_buy"])
                        grouped[date]["fii_sell"] = float(item.get("fiiSell") or item.get("fii_sell") or grouped[date]["fii_sell"])
                        grouped[date]["fii_net"] = float(item.get("fiiNet") or item.get("fii_net") or grouped[date]["fii_net"])
                        grouped[date]["dii_buy"] = float(item.get("diiBuy") or item.get("dii_buy") or grouped[date]["dii_buy"])
                        grouped[date]["dii_sell"] = float(item.get("diiSell") or item.get("dii_sell") or grouped[date]["dii_sell"])
                        grouped[date]["dii_net"] = float(item.get("diiNet") or item.get("dii_net") or grouped[date]["dii_net"])

                # Add history records sorted (filtering out today if already present)
                for date, rec in grouped.items():
                    if today_rec and date == today_rec["date"]:
                        continue
                    records.append(rec)
    except Exception as e:
        logger.warning(f"Failed to fetch historical FII/DII from proxy: {e}")

    return records

def generate_rule_based_fii_dii_analysis(fii_buy, fii_sell, dii_buy, dii_sell, history):
    """
    Rule-based analysis engine acting as Sherlock Holmes to perform dynamic mathematical
    FII/DII flow evaluation.
    """
    fii_net = fii_buy - fii_sell
    dii_net = dii_buy - dii_sell

    # 1. FII DESK SIGNAL & INTERPRETATION:
    if fii_net < 0:
        fii_signal = "STRONG SELL"
        fii_interpret = f"Watson, FII is net selling by ₹{abs(fii_net):,.2f} cr today, representing significant pressure and institutional profit booking on indices."
    else:
        fii_signal = "STRONG BUY"
        fii_interpret = f"Watson, FII is net buying by ₹{fii_net:,.2f} cr today, indicating steady institutional accumulation and conviction."

    # 2. DII DESK SIGNAL & INTERPRETATION:
    dii_signal = "STRONG BUY" if dii_net >= 0 else "STRONG SELL"
    dii_interpret = f"The DII flows are defensive, absorbing the selling pressure with a net buy of ₹{dii_net:,.2f} cr today."

    # 3. Combined Bias Logic Engine:
    # Check if FII and DII values heavily oppose each other within a 15% delta threshold
    is_opposing_neutral = False
    if fii_net * dii_net < 0:
        abs_fii = abs(fii_net)
        abs_dii = abs(dii_net)
        max_abs = max(abs_fii, abs_dii, 1.0)
        delta_pct = abs(abs_fii - abs_dii) / max_abs
        if delta_pct <= 0.15:
            is_opposing_neutral = True

    # Volume Velocity calculation for confidence score:
    hist_flows = []
    for h in history[:5]:
        h_fii = float(h.get("fii_net") or float(h.get("fii_buy", 0.0)) - float(h.get("fii_sell", 0.0)))
        h_dii = float(h.get("dii_net") or float(h.get("dii_buy", 0.0)) - float(h.get("dii_sell", 0.0)))
        hist_flows.append(abs(h_fii) + abs(h_dii))
    
    if hist_flows:
        avg_flow_5d = sum(hist_flows) / len(hist_flows)
    else:
        avg_flow_5d = 1.0
    
    today_flow = abs(fii_net) + abs(dii_net)
    velocity_ratio = today_flow / max(avg_flow_5d, 1.0)
    
    # Calculate algorithmic confidence based on velocity_ratio
    confidence = min(95, max(50, int(70 + (velocity_ratio - 1.0) * 15)))

    if is_opposing_neutral:
        verdict = "NEUTRAL"
        confidence = 85
    elif fii_net > 0 and dii_net > 0:
        verdict = "BULLISH CONFLUENCE"
    elif fii_net < 0 and dii_net < 0:
        verdict = "BEARISH PANIC"
    else:
        verdict = "BULLISH" if (fii_net + dii_net) > 0 else "BEARISH"

    # RECOMMENDED ACTION
    combined_net = fii_net + dii_net
    if combined_net < -1500:
        recommended_action = "AGGRESSIVE SHORT"
    elif combined_net > 1500:
        recommended_action = "BUY ON DIPS"
    else:
        recommended_action = "HOLD"

    # RISK WARNINGS & FLOW MOMENTUM
    # Track 5-day moving average of FII direction
    fii_hist_nets = []
    for h in history[:4]:
        h_fBuy = float(h.get("fii_buy", 0.0))
        h_fSell = float(h.get("fii_sell", 0.0))
        h_fNet = float(h.get("fii_net") or (h_fBuy - h_fSell))
        fii_hist_nets.append(h_fNet)
    all_fii_nets = [fii_net] + fii_hist_nets
    fii_ma5 = sum(all_fii_nets) / len(all_fii_nets) if all_fii_nets else 0.0

    # Rolling 48-hour window FII flow shift from positive to negative:
    fii_yesterday = 0.0
    if len(history) > 0:
        y_fBuy = float(history[0].get("fii_buy", 0.0))
        y_fSell = float(history[0].get("fii_sell", 0.0))
        fii_yesterday = float(history[0].get("fii_net") or (y_fBuy - y_fSell))

    fii_day_before = 0.0
    if len(history) > 1:
        db_fBuy = float(history[1].get("fii_buy", 0.0))
        db_fSell = float(history[1].get("fii_sell", 0.0))
        fii_day_before = float(history[1].get("fii_net") or (db_fBuy - db_fSell))

    shift_to_negative = False
    if fii_net < 0 and (fii_yesterday > 0 or fii_day_before > 0):
        shift_to_negative = True

    if shift_to_negative:
        momentum = "REVERSING"
        risk_flags = ["Persistent FII selling is the primary risk to watch"]
    else:
        if fii_net > 0 and fii_yesterday > 0 and fii_net > fii_yesterday:
            momentum = "ACCELERATING"
        elif fii_net < 0 and fii_yesterday < 0 and fii_net < fii_yesterday:
            momentum = "FADING"
        else:
            momentum = "STEADY"
        risk_flags = []

    red_flag = risk_flags[0] if risk_flags else "None"

    # Set up market implication text
    if verdict == "NEUTRAL":
        market_implication = "Watson, the FII and DII desks are in direct opposition within a narrow range. Near-term price action will remain consolidative. Volatility will be high, and range boundaries should be respected."
    elif verdict == "BULLISH CONFLUENCE":
        market_implication = "Watson, both foreign and domestic desks are accumulating in unison with high velocity. This strong confluence represents structural conviction. Expect tomorrow's index to sustain upward momentum."
    elif verdict == "BEARISH PANIC":
        market_implication = "Watson, panic liquidations are observed across both foreign and domestic desks. This simultaneous exit leaves the index extremely vulnerable. Protect capital, avoid long exposure, and expect further downward continuation."
    elif "BULLISH" in verdict:
        market_implication = f"FII inflows of ₹{fii_net:,.2f} cr dominate the session, overriding DII's protective stance. Watson, expect a bullish bias with selective stock breakouts."
    else:
        market_implication = f"FII selling of ₹{abs(fii_net):,.2f} cr dominates the flows. Despite domestic support, overall posture remains vulnerable to intraday selloffs."

    return {
        "verdict": verdict,
        "confidence": confidence,
        "fii_signal": fii_signal,
        "dii_signal": dii_signal,
        "recommended_action": recommended_action,
        "fii_interpretation": fii_interpret,
        "dii_interpretation": dii_interpret,
        "market_implication": market_implication,
        "intraday_bias": "BULLISH" if combined_net > 500 else ("BEARISH" if combined_net < -500 else "NEUTRAL"),
        "swing_bias": "BULLISH" if fii_ma5 > 500 else ("BEARISH" if fii_ma5 < -500 else "NEUTRAL"),
        "momentum": momentum,
        "risk_flags": risk_flags,
        "red_flag": red_flag
    }

def get_fii_dii_ai_verdict(fii_buy, fii_sell, dii_buy, dii_sell, history_list):
    """
    Calls the calculation engine to retrieve the analyzed FII/DII flow object.
    Bypasses slow/unstable LLM calls to guarantee exact mathematical rule execution.
    """
    return generate_rule_based_fii_dii_analysis(fii_buy, fii_sell, dii_buy, dii_sell, history_list)
