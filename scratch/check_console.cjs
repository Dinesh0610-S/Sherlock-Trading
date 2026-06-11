const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.toString()}`));

  try {
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    console.log('Page loaded. Waiting 5s...');
    await page.waitForTimeout(5000);
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:/Users/DINESHMANI/Desktop/Pictures/Trade/scratch_console_test.png' });
    console.log('Screenshot saved.');
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
