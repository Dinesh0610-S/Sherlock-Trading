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

    console.log("Clicking 'Sherlock Verdict' tab...");
    const verdictTab = page.locator('.nav-tab', { hasText: 'Sherlock Verdict' });
    await verdictTab.click();
    await page.waitForTimeout(10000); // wait longer for everything to fetch

    // Take screenshot of Sherlock Verdict page
    const shotPath = path.join(__dirname, 'verdict_page_screenshot2.png');
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Screenshot saved → ${shotPath}`);

    // Print page text content around the status banner
    const banner = page.locator('.status-banner');
    if (await banner.count() > 0) {
      const bannerText = await banner.first().innerText();
      console.log('Banner text:\n', bannerText);
    } else {
      console.log('No status banner found');
    }

  } catch (err) {
    console.error('Error: ' + err.message);
  } finally {
    await browser.close();
  }
})();
