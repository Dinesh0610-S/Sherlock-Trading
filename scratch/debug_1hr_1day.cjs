const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  // Capture all network requests to /api/candles
  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('/api/candles')) {
      apiCalls.push({ url: req.url(), time: new Date().toISOString() });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/candles')) {
      const url = res.url();
      try {
        const json = await res.json();
        const c = json?.candles;
        console.log(`[API] ${url.split('?')[1]} -> ${c?.length} candles, diff=${c?.length > 1 ? c[1].time - c[0].time : 'n/a'}s`);
      } catch {}
    }
  });

  await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(5000);

  const card = '.cb-card:has-text("Quantitative Footprint Chart")';

  // Start at 15m
  await page.locator(`${card} button`, { hasText: /^15$/ }).click();
  await page.waitForTimeout(6000);

  // Switch to 1hr
  console.log('\n=== Clicking 1hr ===');
  await page.locator(`${card} button`, { hasText: /^1hr$/ }).click();
  await page.waitForTimeout(6000);
  const img1hr = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', 'debug_1hr.png');
  await page.locator(card).screenshot({ path: img1hr });
  console.log('1hr screenshot saved');

  // Switch to 1day
  console.log('\n=== Clicking 1day ===');
  await page.locator(`${card} button`, { hasText: /^1day$/ }).click();
  await page.waitForTimeout(8000);
  const img1d = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', 'debug_1day.png');
  await page.locator(card).screenshot({ path: img1d });
  console.log('1day screenshot saved');

  await browser.close();
  console.log('\nAll API calls made:', apiCalls.map(a => a.url.split('?')[1]).join(', '));
})();
