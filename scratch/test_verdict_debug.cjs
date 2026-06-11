const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR]: ${err.message}`);
  });

  // Capture requests
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log(`[REQUEST] ${req.method()} ${req.url()}`);
    }
  });

  // Capture responses
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`[RESPONSE] ${res.status()} ${res.url()}`);
    }
  });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(2000);

  const allTabs = page.locator('.nav-tab');
  const count = await allTabs.count();
  console.log(`Total tabs found: ${count}`);

  console.log('Clicking Tab 1: Sherlock Verdict...');
  await allTabs.nth(1).click();

  console.log('Waiting 25 seconds for data and verdict...');
  await page.waitForTimeout(25000);

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0/verdict_debug2.png' });

  await browser.close();
  console.log('Done.');
})();
