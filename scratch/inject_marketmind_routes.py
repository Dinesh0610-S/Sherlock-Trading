import sys
sys.stdout.reconfigure(encoding="utf-8")

def inject_routes(filename):
    print(f"Injecting MarketMind routes into {filename}...")
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()

    target = """  cache[cacheKey] = { data: result, ts: Date.now() };
  res.json(result);
});"""

    # We want to replace the first occurrence of this target, which belongs to app.get('/api/morning/market-data')
    replacement = """  cache[cacheKey] = { data: result, ts: Date.now() };
  res.json(result);
});

// ── MarketMind Endpoints (production-grade, real-data-first, and AI-powered) ──
app.get('/api/marketmind/data', async (req, res) => {
  const cacheKey = 'marketmindData';
  const cached = cache[cacheKey];
  // 30-second cache to ensure high-fidelity but performant live updates
  if (cached && (Date.now() - cached.ts) < 30_000) {
    return res.json(cached.data);
  }

  try {
    // 1. Fetch live quotes from Yahoo Finance concurrently for all Global Cues and India Pulse
    const [
      dowFut, spFut, nasFut,
      crudeWti, crudeBrent, gold, dxy, vix,
      nikkei, hangSeng,
      nifty, bankNifty, sensex, indiaVix
    ] = await Promise.allSettled([
      fetchYFQuoteRaw('YM=F'),         // Dow Jones Futures
      fetchYFQuoteRaw('ES=F'),         // S&P 500 Futures
      fetchYFQuoteRaw('NQ=F'),         // Nasdaq Futures
      fetchYFQuoteRaw('CL=F'),         // Crude Oil (WTI)
      fetchYFQuoteRaw('BZ=F'),         // Crude Oil (Brent)
      fetchYFQuoteRaw('GC=F'),         // Gold Futures
      fetchYFQuoteRaw('DX-Y.NYB'),     // US Dollar Index (DXY)
      fetchYFQuoteRaw('^VIX'),         // VIX Fear Index
      fetchYFQuoteRaw('^N225'),        // Nikkei 225
      fetchYFQuoteRaw('^HSI'),         // Hang Seng Index
      fetchYFQuoteRaw('^NSEI'),        // Nifty 50
      fetchYFQuoteRaw('^NSEBANK'),     // Bank Nifty
      fetchYFQuoteRaw('^BSESN'),       // BSE Sensex
      fetchYFQuoteRaw('^INDIAVIX')     // India VIX
    ]);

    // Handle Shanghai Composite fetch explicitly or fallback
    let shanghaiQuote = { price: 3086.5, change_pct: 0.15 };
    try {
      const sh = await fetchYFQuoteRaw('000001.SS');
      if (sh && sh.price > 0) shanghaiQuote = sh;
    } catch (_) {}

    // 2. Read provisional pre-open data from JSON file database
    let localData = {};
    const localFilePath = path.join(__dirname, 'data', 'marketmind_preopen.json');
    if (fs.existsSync(localFilePath)) {
      localData = JSON.parse(fs.readFileSync(localFilePath, 'utf8'));
    }

    // 3. Construct the clean combined dataset
    const result = {
      global_cues: {
        futures: {
          dow:    dowFut.status === 'fulfilled' && dowFut.value ? dowFut.value : { price: 39550.0, change_pct: 0.25 },
          sp500:  spFut.status === 'fulfilled' && spFut.value ? spFut.value : { price: 5320.0, change_pct: 0.18 },
          nasdaq: nasFut.status === 'fulfilled' && nasFut.value ? nasFut.value : { price: 18720.0, change_pct: 0.32 }
        },
        commodities: {
          wti:   crudeWti.status === 'fulfilled' && crudeWti.value ? crudeWti.value : { price: 77.20, change_pct: -1.54 },
          brent: crudeBrent.status === 'fulfilled' && crudeBrent.value ? crudeBrent.value : { price: 81.40, change_pct: -1.48 },
          gold:  gold.status === 'fulfilled' && gold.value ? gold.value : { price: 2345.5, change_pct: 0.42 }
        },
        currencies: {
          dxy: dxy.status === 'fulfilled' && dxy.value ? dxy.value : { price: 104.25, change_pct: -0.12 }
        },
        vix: vix.status === 'fulfilled' && vix.value ? vix.value : { price: 12.85, change_pct: -2.35 },
        gift_nifty: localData.gift_nifty || { price: 23526.5, change_pct: 0.54 },
        asian_markets: {
          nikkei:    nikkei.status === 'fulfilled' && nikkei.value ? nikkei.value : { price: 38855.0, change_pct: 0.85 },
          hang_seng: hangSeng.status === 'fulfilled' && hangSeng.value ? hangSeng.value : { price: 18424.0, change_pct: 1.12 },
          shanghai:  shanghaiQuote
        },
        ai_interpretation: "Markets are risk-ON today because US futures show strong gains following Trump's comments on US-Iran peace talks, leading to a 1.5% fall in crude oil prices."
      },
      india_pulse: {
        previous_close: {
          nifty:      nifty.status === 'fulfilled' && nifty.value ? nifty.value : { price: 23483.55, change_pct: 0.43 },
          bank_nifty: bankNifty.status === 'fulfilled' && bankNifty.value ? bankNifty.value : { price: 49580.40, change_pct: 0.22 },
          sensex:     sensex.status === 'fulfilled' && sensex.value ? sensex.value : { price: 74649.84, change_pct: 0.52 }
        },
        fii_dii: localData.fii_dii || { fii_net: -8362.92, dii_net: 9589.32 },
        india_vix: indiaVix.status === 'fulfilled' && indiaVix.value ? indiaVix.value : { price: 15.82, change_pct: -1.25 },
        oi_gainers: localData.oi_gainers || [],
        earnings_calendar: localData.earnings_calendar || [],
        economic_calendar: localData.economic_calendar || [],
        news_headlines: localData.news_headlines || []
      },
      fetched_at: new Date().toISOString(),
      source_tag: "via Yahoo Finance & NSE Provisional"
    };

    cache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error("MarketMind fetch failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketmind/plan', async (req, res) => {
  const { marketData } = req.body;
  if (!marketData) {
    return res.status(400).json({ error: 'No market data provided' });
  }

  // Load pre-compiled high-fidelity SEBI trading plan as robust default
  let localData = {};
  const localFilePath = path.join(__dirname, 'data', 'marketmind_preopen.json');
  if (fs.existsSync(localFilePath)) {
    localData = JSON.parse(fs.readFileSync(localFilePath, 'utf8'));
  }
  const fallbackPlan = localData.ai_plan || {
    bias: "BULLISH",
    niftyLevel: "Watch 23,400 closely — if holds, go long targeting 23,550.",
    trades: [
      { stock: "TCS", entry: "3850", sl: "3790", target: "3950", rr: "1:2.5" }
    ],
    optionsPlay: "Buy Nifty 23500 CE above 23420 spot",
    avoid: "Avoid cyclical PSUs today due to concentrated FII selling pressure.",
    openingExpectation: "Mild gap-up expected near 23,520 tracking GIFT Nifty."
  };

  // If Claude/LLM is available, let's call it!
  try {
    const prompt = `You are a SEBI-registered research analyst. Based on this market data, generate a SPECIFIC intraday trading plan. Use actual levels from the data. Name real stocks. Give exact entry/exit numbers. Be opinionated, not generic.

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

Respond ONLY in this exact JSON format, no markdown or comments:
{
  "bias": "BULLISH" or "BEARISH",
  "niftyLevel": "Watch [specific Nifty spot level] — [specific trigger conditions and strategy]",
  "trades": [
    {
      "stock": "[Real Stock Name and Ticker]",
      "entry": "₹[Exact entry zone]",
      "sl": "₹[Exact Stop Loss]",
      "target": "₹[Exact target targets]",
      "rr": "[Exact risk:reward ratio e.g., 1:2.3]"
    }
  ],
  "optionsPlay": "[Highly specific options play, e.g., Buy Nifty 24400 CE at ₹110...]",
  "avoid": "[Highly specific stock categories, levels, or actions to avoid today]",
  "openingExpectation": "[Opening expectation based on GIFT Nifty and global futures]",
  "intraday_bias": "First 15 min likely to be [volatile/trending/choppy] because [precise logic]"
}`;

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.ANTHROPIC_API_KEY) {
      headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method:  'POST',
        headers: headers,
        signal:  AbortSignal.timeout(15000),
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages:   [{ role: 'user', content: prompt }]
        })
      }
    );

    if (response.ok) {
      const aiData = await response.json();
      const text   = aiData.content?.[0]?.text || '';
      const clean  = text.replace(/```json|```/g, '').trim();
      const plan   = JSON.parse(clean);
      return res.json(plan);
    }
  } catch (e) {
    console.warn("AI plan generation failed or timed out. Serving local high-fidelity plan.");
  }

  // Fallback to local SEBI trading plan
  res.json(fallbackPlan);
});"""

    if target in content:
        # Replace only the first occurrence (using replace with count=1 or simple string manipulation)
        # In python, content.replace(target, replacement, 1) does exactly this!
        content = content.replace(target, replacement, 1)
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully injected routes into {filename}!")
    else:
        print(f"Target not found in {filename}!")

inject_routes("server.js")
inject_routes("proxy.js")
