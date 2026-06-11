const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.toString()}`));

  try {
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // First click on 15m to reset to a known state and wait for data
    const chartCardSelector = '.cb-card:has-text("Quantitative Footprint Chart")';
    await page.locator(`${chartCardSelector} button`, { hasText: /^15$/ }).click();
    await page.waitForTimeout(5000);

    const timeframes = [
      { label: '1minute', filename: 'verify_1m.png' },
      { label: '5', filename: 'verify_5m.png' },
      { label: '10', filename: 'verify_10m.png' },
      { label: '15', filename: 'verify_15m.png' },
      { label: '30', filename: 'verify_30m.png' },
      { label: '1hr', filename: 'verify_1hr.png' },
      { label: '1day', filename: 'verify_1day.png' },
    ];

    for (const tf of timeframes) {
      console.log(`\n--- Clicking timeframe: ${tf.label} ---`);
      const button = page.locator(`${chartCardSelector} button`, { hasText: new RegExp(`^${tf.label}$`) });
      await button.click();

      // Wait longer for candles to load — candle API calls may take a few seconds
      console.log('  Waiting 6 seconds for candles to load...');
      await page.waitForTimeout(6000);

      const chartCard = page.locator(chartCardSelector);
      const outPath = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', tf.filename);
      await chartCard.screenshot({ path: outPath });
      console.log(`  Screenshot saved: ${outPath}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    console.log('\nDone. Browser closed.');
  }
})();
