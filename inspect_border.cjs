const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(3000);

  const dir = 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0';

  // Click Holmes AI tab
  const allTabs = page.locator('.nav-tab');
  const count = await allTabs.count();
  console.log('Total tabs:', count);
  for (let i = 0; i < count; i++) {
    const t = await allTabs.nth(i).textContent();
    console.log(`Tab ${i}: ${t}`);
  }

  // Click Holmes AI tab (last tab)
  await allTabs.last().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(dir, 'inspect_holmes_full.png'), fullPage: false });
  console.log('Saved Holmes AI full');

  // Zoom in on left edge to see the border issue
  await page.screenshot({ path: path.join(dir, 'inspect_holmes_left.png'), clip: { x: 0, y: 150, width: 200, height: 700 }, fullPage: false });
  console.log('Saved Holmes AI left clip');

  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
