const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  // Capture console messages including our debug output
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG]') || text.includes('[LiveChart]') || text.includes('CANDLES_LOADED') || text.includes('timeframe')) {
      console.log(`[BROWSER ${msg.type()}] ${text}`);
    }
  });

  await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(4000);

  // Inject debugging into the page
  await page.evaluate(() => {
    const origLog = console.log;
    window.__debugLogs = [];
    console.log = (...args) => {
      origLog(...args);
      window.__debugLogs.push(args.join(' '));
    };
  });

  const card = '.cb-card:has-text("Quantitative Footprint Chart")';

  // Go to 15m
  await page.locator(`${card} button`, { hasText: /^15$/ }).click();
  await page.waitForTimeout(4000);

  // Go to 1day
  console.log('\n=== Clicking 1day ===');
  await page.locator(`${card} button`, { hasText: /^1day$/ }).click();
  await page.waitForTimeout(6000);

  // Read the canvas x-axis labels by capturing text from the canvas
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas found';
    return {
      width: canvas.width,
      height: canvas.height,
      style: { width: canvas.style.width, height: canvas.style.height }
    };
  });
  console.log('Canvas info:', JSON.stringify(canvasInfo));

  // Take screenshot
  const imgPath = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', 'debug2_1day.png');
  await page.locator(card).screenshot({ path: imgPath });
  console.log('1day screenshot saved to:', imgPath);

  // Switch back to 1hr for comparison
  console.log('\n=== Switching back to 1hr ===');
  await page.locator(`${card} button`, { hasText: /^1hr$/ }).click();
  await page.waitForTimeout(6000);
  const imgPath2 = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', 'debug2_1hr.png');
  await page.locator(card).screenshot({ path: imgPath2 });
  console.log('1hr screenshot saved');

  await browser.close();
})();
