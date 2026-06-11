const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('Console Error Detected:', msg.text());
      }
    });

    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(5000);

    // ── Verify on Clue Board Tab ──
    console.log('Verifying Institutional Pattern Engine on Clue Board Tab...');
    const clueboardPanelHeader = page.locator('h3:has-text("INSTITUTIONAL PATTERN & SIGNAL ENGINE")').first();
    await clueboardPanelHeader.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Success: Institutional Pattern Engine Panel is visible on Clue Board!');

    // Capture screenshot of Clue Board
    const screenshotClueboard = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/clueboard_pattern_engine.png';
    await page.screenshot({ path: screenshotClueboard, fullPage: true });
    console.log(`✅ Clueboard screenshot saved to ${screenshotClueboard}`);

    // ── Navigate to Pre-Market Intel ──
    console.log('Clicking the Pre-Market Intel tab...');
    const preMarketTab = page.locator('#pre-market-tab');
    await preMarketTab.click();
    await page.waitForTimeout(2000);

    // Click Strategy Engine sub-tab
    console.log('Clicking the 30-Min Strategy Engine sub-tab...');
    const strategyTabBtn = page.locator('#pmi-panel-strategyEngine');
    await strategyTabBtn.click();
    await page.waitForTimeout(4000);

    // Verify Institutional Pattern Engine on Strategy Engine tab
    console.log('Verifying Institutional Pattern Engine on Pre-Market Intel Strategy Engine panel...');
    const pmiPanelHeader = page.locator('h3:has-text("INSTITUTIONAL PATTERN & SIGNAL ENGINE")').last();
    await pmiPanelHeader.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Success: Institutional Pattern Engine Panel is visible on Pre-Market Intel!');

    // Capture screenshot of Pre-Market Intel
    const screenshotPmi = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/premarket_pattern_engine.png';
    await page.screenshot({ path: screenshotPmi, fullPage: true });
    console.log(`✅ Pre-Market Intel Strategy Engine screenshot saved to ${screenshotPmi}`);

    // Check console errors
    if (consoleErrors.length > 0) {
      console.error(`❌ FAILED: Detected ${consoleErrors.length} console errors during execution.`);
      process.exit(1);
    } else {
      console.log('✅ E2E verification PASSED successfully with zero console errors!');
      process.exit(0);
    }

  } catch (err) {
    console.error('❌ E2E Verification Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
