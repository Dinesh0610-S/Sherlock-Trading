const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(3000);

  // 1. Screenshot: Clue Board default (NIFTY 50) — shows quick select bar
  await page.screenshot({
    path: 'C:/Users/DINESHMANI/.gemini/antigravity/brain/641787a0-6251-4052-9205-d0e8b3ff2c8b/clue_board_quickselect.png',
    clip: { x: 0, y: 95, width: 1440, height: 130 }
  });

  // 2. Click SENSEX button
  const sensexBtn = page.locator('button:has-text("SENSEX")').first();
  if (await sensexBtn.isVisible()) {
    await sensexBtn.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({
    path: 'C:/Users/DINESHMANI/.gemini/antigravity/brain/641787a0-6251-4052-9205-d0e8b3ff2c8b/clue_board_sensex.png',
    clip: { x: 0, y: 95, width: 1440, height: 400 }
  });

  // 3. Click back to NIFTY, then type in search to test dropdown
  const niftyBtn = page.locator('button:has-text("NIFTY 50")').first();
  if (await niftyBtn.isVisible()) await niftyBtn.click();
  await page.waitForTimeout(1000);

  // Click the asset chip to open search
  const chip = page.locator('.asset-search-chip').first();
  if (await chip.isVisible()) {
    await chip.click();
    await page.waitForTimeout(500);
  }
  const input = page.locator('.asset-search-input').first();
  if (await input.isVisible()) {
    await input.fill('RELIANCE');
    await page.waitForTimeout(1200);
  }
  await page.screenshot({
    path: 'C:/Users/DINESHMANI/.gemini/antigravity/brain/641787a0-6251-4052-9205-d0e8b3ff2c8b/clue_board_dropdown.png',
    clip: { x: 0, y: 95, width: 1440, height: 600 }
  });

  await browser.close();
  console.log('All screenshots saved.');
})().catch(e => { console.error(e.message); process.exit(1); });
