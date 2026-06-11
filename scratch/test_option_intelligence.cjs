const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set viewport size
  await page.setViewportSize({ width: 1400, height: 900 });
  
  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  console.log('Clicking on OPTION INTELLIGENCE tab...');
  const tab = page.locator('button:has-text("Option Intelligence")');
  await tab.click();
  
  console.log('Waiting for option chain data to load...');
  await page.waitForTimeout(5000);
  
  console.log('Taking screenshot...');
  const screenshotPath = 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0/option_intelligence_resolved.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  console.log(`Screenshot saved successfully to ${screenshotPath}`);
  await browser.close();
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
