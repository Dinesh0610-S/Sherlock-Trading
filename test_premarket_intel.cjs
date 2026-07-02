const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501/?mockPhase=ORDER_ENTRY...');
    await page.goto('http://localhost:8501/?mockPhase=ORDER_ENTRY', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(3000);

    // ── Click Pre-Market Intel Tab ──
    console.log('Clicking the Pre-Market Intel tab...');
    const preMarketTab = page.locator('#pre-market-tab');
    await preMarketTab.waitFor({ state: 'visible', timeout: 10000 });
    await preMarketTab.click();
    await page.waitForTimeout(2000);

    // ── Check if Pre-Market header is visible ──
    const header = page.locator('h2:has-text("Pre-Market Intel")');
    await header.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Pre-Market Intelligence Engine header is visible!');

    // ── Verify no 404 panel is visible ──
    const errorPanel = page.locator('.pm-error-panel');
    const isErrorVisible = await errorPanel.isVisible();
    if (isErrorVisible) {
      const errorText = await errorPanel.innerText();
      throw new Error(`Error panel is visible: ${errorText}`);
    }
    console.log('✅ No error panel is visible!');

    // ── Verify CE/PE recommendation is shown ──
    const recSection = page.locator('h3:has-text("21-Factor Confidence Breakdown")');
    await recSection.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Recommendation loaded successfully!');

    // ── Take and Save Decision Panel Screenshot ──
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/pre_market_intel_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Full page screenshot saved to ${screenshotPath}`);

    // ── Click Key OI Levels Tab ──
    console.log('Clicking the Key OI Levels panel tab...');
    const oiLevelsTab = page.locator('#pmi-panel-oiStrikeLevels');
    await oiLevelsTab.waitFor({ state: 'visible', timeout: 5000 });
    await oiLevelsTab.click();
    await page.waitForTimeout(2000);

    // ── Take and Save Key OI Levels Screenshot ──
    const oiScreenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/pre_market_intel_oi_levels_screenshot.png';
    await page.screenshot({ path: oiScreenshotPath, fullPage: true });
    console.log(`✅ Key OI Levels screenshot saved to ${oiScreenshotPath}`);

    // ── Click AI Trading Plan Tab ──
    console.log('Clicking the AI Trading Plan tab...');
    const entryTab = page.locator('#pmi-panel-entry');
    await entryTab.waitFor({ state: 'visible', timeout: 5000 });
    await entryTab.click();
    await page.waitForTimeout(2000);

    // ── Take and Save AI Trading Plan Screenshot ──
    const tradingPlanScreenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/pre_market_intel_trading_plan_screenshot.png';
    await page.screenshot({ path: tradingPlanScreenshotPath, fullPage: true });
    console.log(`✅ AI Trading Plan screenshot saved to ${tradingPlanScreenshotPath}`);



    // ── Click Global Cues Tab ──
    console.log('Clicking the Global Cues panel tab...');
    const globalCuesTab = page.locator('#pmi-panel-gap');
    await globalCuesTab.waitFor({ state: 'visible', timeout: 5000 });
    await globalCuesTab.click();
    await page.waitForTimeout(2000);

    // ── Take and Save Global Cues Screenshot ──
    const gapScreenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/pre_market_intel_gap_screenshot.png';
    await page.screenshot({ path: gapScreenshotPath, fullPage: true });
    console.log(`✅ Global Cues screenshot saved to ${gapScreenshotPath}`);

    console.log('✅ Pre-Market Intel E2E verification PASSED successfully!');

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
