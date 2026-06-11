const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Check Market Status Badge ──
    console.log('Checking for Market Status Badge...');
    const statusBadge = page.locator('#header-market-status');
    await statusBadge.waitFor({ state: 'visible', timeout: 10000 });
    
    const statusText = await statusBadge.innerText();
    console.log(`✅ Badge text found: "${statusText}"`);

    // Verify classes
    const classList = await statusBadge.evaluate(el => Array.from(el.classList));
    console.log(`✅ Badge classes: [${classList.join(', ')}]`);

    // Get background color
    const styles = await statusBadge.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        border: style.border
      };
    });
    console.log(`✅ Computed styles:`, styles);

    // Save screenshot of the header area
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/market_status_header.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✅ Header screenshot saved to ${screenshotPath}`);

    if (statusText.toUpperCase().includes('MARKET: OPEN') || statusText.toUpperCase().includes('MARKET: CLOSED')) {
      console.log('✅ Market Status Hook E2E verification PASSED.');
    } else {
      throw new Error(`Invalid status text: ${statusText}`);
    }

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
