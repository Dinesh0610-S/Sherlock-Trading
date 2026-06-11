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
    await page.waitForTimeout(3000);

    const button = page.locator('.nav-tab', { hasText: 'Pre-Market Intel' });
    if (await button.count() > 0) {
      await button.click();
      console.log('Clicked Pre-Market Intel. Waiting 20s for scan to complete...');
      await page.waitForTimeout(20000);
      
      const screenshotPath = path.resolve(__dirname, 'pre_market_intel_screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot to ${screenshotPath}`);
    } else {
      console.error('Could not find Pre-Market Intel tab');
    }
  } catch (err) {
    console.error('Error:', err.stack || err.message);
  } finally {
    await browser.close();
  }
})();
