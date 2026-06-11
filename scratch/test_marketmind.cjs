const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 950 });
    console.log('Navigating to MarketMind dashboard at http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);

    // ── Click Pre-Market Intel Tab to active MarketMind ──
    console.log('Clicking the "Pre-Market Intel" tab button...');
    const preMarketTab = page.locator('#pre-market-tab');
    await preMarketTab.waitFor({ state: 'visible', timeout: 10000 });
    await preMarketTab.click();
    await page.waitForTimeout(4000);

    // ── Check if MarketMind header is visible ──
    const header = page.locator('h2:has-text("MarketMind")');
    await header.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ MarketMind pre-market dashboard header is visible!');

    // ── Take Screenshot of GLOBAL CUE$ Tab ──
    console.log('Taking screenshot of GLOBAL CUE$ Tab...');
    let screenshotPath = path.join(__dirname, '..', 'scratch', 'marketmind_global_cues.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Global Cues screenshot saved to ${screenshotPath}`);

    // ── Click India Pulse Tab ──
    console.log('Clicking "India Pulse" sub-tab...');
    const indiaPulseTab = page.locator('button:has-text("India Pulse")');
    await indiaPulseTab.click();
    await page.waitForTimeout(2000);
    screenshotPath = path.join(__dirname, '..', 'scratch', 'marketmind_india_pulse.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ India Pulse screenshot saved to ${screenshotPath}`);

    // ── Click AI Verdict Tab ──
    console.log('Clicking "AI Verdict" sub-tab...');
    const verdictTab = page.locator('button:has-text("AI Verdict")');
    await verdictTab.click();
    await page.waitForTimeout(2000);
    screenshotPath = path.join(__dirname, '..', 'scratch', 'marketmind_verdict.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Verdict screenshot saved to ${screenshotPath}`);

    // ── Click AI Trading Plan Tab ──
    console.log('Clicking "AI Trading Plan" sub-tab...');
    const planTab = page.locator('button:has-text("AI Trading Plan")');
    await planTab.click();
    await page.waitForTimeout(2000);
    screenshotPath = path.join(__dirname, '..', 'scratch', 'marketmind_trading_plan.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Trading Plan screenshot saved to ${screenshotPath}`);

    // ── Click Refresh Data Button ──
    console.log('Clicking the "Refresh Data" button...');
    const refreshBtn = page.locator('button:has-text("Refresh Data")');
    await refreshBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Refresh Data button clicked successfully!');

    console.log('🏁 MarketMind E2E dashboard verification completed successfully!');

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
