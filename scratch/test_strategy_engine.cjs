const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(4000);

    // ── Click Pre-Market Intel Tab ──
    console.log('Clicking the Pre-Market Intel tab...');
    const preMarketTab = page.locator('#pre-market-tab');
    await preMarketTab.waitFor({ state: 'visible', timeout: 10000 });
    await preMarketTab.click();
    await page.waitForTimeout(2000);

    // ── Click Strategy Engine Sub-tab ──
    console.log('Clicking the 30-Min Strategy Engine sub-tab...');
    const strategyTabBtn = page.locator('#pmi-panel-strategyEngine');
    await strategyTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await strategyTabBtn.click();
    await page.waitForTimeout(3000);

    // ── Verify news sentiment cards loaded ──
    console.log('Verifying news sentiment cues are visible...');
    const newsHeader = page.locator('strong:has-text("GLOBAL CUES & NEWS SENTIMENT")');
    await newsHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Global news sentiment card is visible!');

    // ── Verify tracker metrics are visible ──
    console.log('Verifying tracker bar is loaded...');
    const trackerText = page.locator('text=LIVE P&L').first();
    await trackerText.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Intraday P&L Tracker header is visible!');

    // ── Verify history timeline is loaded ──
    console.log('Verifying timeline strip is visible...');
    const timelineText = page.locator('text=TIMELINE').first();
    await timelineText.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ 30-Min Strategy Window Timeline strip is visible!');

    // ── Click Log Trade if signal is not AVOID ──
    const logBtn = page.locator('button:has-text("Log This Trade")');
    const isLogBtnVisible = await logBtn.isVisible();
    if (isLogBtnVisible) {
      console.log('Clicking Log This Trade button...');
      await logBtn.click();
      await page.waitForTimeout(1000);
      
      console.log('Confirming trade...');
      const confirmBtn = page.locator('button:has-text("Confirm")');
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(1500);
      
      console.log('Checking if trade was logged in Active Trades Log...');
      const activeTradesHeader = page.locator('strong:has-text("TRADES LOGGED TODAY (1)")');
      await activeTradesHeader.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Active trade logged and tracked successfully!');
    } else {
      console.log('⚠️ Active window has AVOID strategy, skipping trade logging test.');
    }

    // ── Take Strategy Engine Screenshot ──
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/strategy_engine_dashboard_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Strategy Engine Dashboard screenshot saved to ${screenshotPath}`);

  } catch (err) {
    console.error('❌ E2E Strategy Engine Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
