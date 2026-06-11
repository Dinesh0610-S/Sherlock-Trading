const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1600 }); // Large height to capture both charts and table

  console.log('Navigating to local site...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(4000); // Wait for dashboard to mount

  console.log('Clicking FII/DII Flow Tab...');
  const fiiDiiTab = page.locator('#fii-dii-tab');
  if (await fiiDiiTab.isVisible()) {
    await fiiDiiTab.click();
    await page.waitForTimeout(1000);
  }

  console.log('Clicking 30-day trend Sub-tab...');
  const trendSubTab = page.locator('button:has-text("30-day trend")');
  if (await trendSubTab.isVisible()) {
    await trendSubTab.click();
    await page.waitForTimeout(2000); // Wait for charts to render
  }

  console.log('Capturing FII/DII Trend sub-tab...');
  await page.screenshot({
    path: 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0/fii_dii_flow_live.png',
    fullPage: false
  });

  await browser.close();
  console.log('FII/DII capture completed successfully.');
})().catch(e => {
  console.error('Error during capture:', e);
  process.exit(1);
});
