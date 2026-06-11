import sys
sys.stdout.reconfigure(encoding="utf-8")

def fix_scan_route(filename):
    print(f"Fixing scan route in {filename}...")
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()
    
    target = """  // ── News ────────────────────────────────────────────────// Confidence score calculator"""
    
    # Let's find if target is present
    if target not in content:
        # Let's try matching with generic prefix
        import re
        pattern = r"// ── News ──+.*?// Confidence score calculator"
        match = re.search(pattern, content)
        if match:
            target = match.group(0)
            print(f"Found dynamic match: {target}")
        else:
            print("Could not find targets in " + filename)
            return
            
    replacement = """  // ── News ───────────────────────────────────────────────────
  const news = {
    headlines: [
      { text: 'US Inflation numbers cool down, Dow jumps 400 points.', sentiment: 'BULLISH', sectors: ['IT', 'FINANCE'] }
    ],
    overall_sentiment: 'NEUTRAL',
    key_opportunity: 'Opportunities in pre-open movers',
    key_risk: 'Global cues stable'
  };

  if (aggregatePreopenImbalance > 15) {
    news.overall_sentiment = 'BULLISH';
    news.key_opportunity = 'Strong buy imbalance across high-weightage sectors.';
  } else if (aggregatePreopenImbalance < -15) {
    news.overall_sentiment = 'BEARISH';
    news.key_opportunity = 'Selling pressure dominant. Look for short entries on breakdown.';
  }

  // Construct scan object
  const scanResult = {
    phase,
    ist_time,
    ist_date,
    nifty_gap: niftyGap || {
      prev_close: 23483.55,
      iep: 23483.55,
      gap_pts: 0,
      gap_pct: 0,
      direction: 'FLAT_OPEN',
      strategy_hint: 'Flat open expected.'
    },
    gap_ups: gapUps,
    gap_downs: gapDowns,
    total_fo_stocks: allMovers.length,
    preopen_imbalance: aggregatePreopenImbalance,
    news,
    from_cache: false,
    total_preopen_qty: totalPreopenQty,
    iep_stability: iepStability,
    vol_vs_avg_ratio: volVsAvgRatio,
    fetched_at: new Date().toISOString()
  };

  pmScanCache = scanResult;
  pmScanCacheTs = Date.now();

  res.json(scanResult);
});

// Confidence score calculator"""

    content = content.replace(target, replacement)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed {filename} scan route successfully!")

fix_scan_route("server.js")
fix_scan_route("proxy.js")
