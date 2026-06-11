const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE UNHANDLED ERROR:', err.stack || err.message));

  try {
    console.log('Navigating to http://localhost:8501 ...');
    await page.goto('http://localhost:8501', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Take screenshot of Clue Board (which contains the Institutional Pattern & Signal Engine)
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/clueboard_pattern_engine.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot to ${screenshotPath}`);
  } catch (err) {
    console.error('Error:', err.stack || err.message);
  } finally {
    await browser.close();
  }
})();
