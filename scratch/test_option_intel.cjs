const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.toString()}`);
  });

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    console.log("Clicking 'Option Intelligence' tab...");
    const tab = page.locator('.nav-tab', { hasText: 'Option Intelligence' });
    await tab.click();
    await page.waitForTimeout(10000); // wait for everything to fetch

    // Take screenshot of Option Intelligence page
    const shotPath = path.join(__dirname, 'option_intel_screenshot.png');
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Screenshot saved → ${shotPath}`);

  } catch (err) {
    console.error('Error: ' + err.message);
  } finally {
    await browser.close();
  }
})();
