// Using native fetch

(async () => {
  const marketData = {
    symbol: 'NIFTY',
    spot: 23664.35,
    rsi: 52.4,
    ema9: 23650.1,
    ema21: 23620.5,
    emaSignal: 'BULLISH',
    vwap: 23630.0,
    vwapValid: true,
    vwapPosition: 'ABOVE',
    pcr: 1.15,
    maxPain: 23500,
    atr: 120,
    fiiNet: 450,
    mtf: {
      '15m': { trend: 'BULLISH' },
      '1h': { trend: 'BULLISH' },
      '1d': { trend: 'BULLISH' },
      aligned: true
    }
  };

  console.log('Sending request to http://localhost:3001/api/verdict/generate...');
  try {
    const res = await fetch('http://localhost:3001/api/verdict/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketData })
    });

    console.log('Response status:', res.status);
    const json = await res.json();
    console.log('Response payload:', JSON.stringify(json, null, 2).slice(0, 1000));
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
