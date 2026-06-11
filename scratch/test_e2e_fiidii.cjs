const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(3000);

    // ── Click FII/DII Tab ──
    console.log('Clicking the FII/DII tab...');
    const fiiDiiTab = page.locator('#fii-dii-tab');
    await fiiDiiTab.waitFor({ state: 'visible', timeout: 10000 });
    await fiiDiiTab.click();
    await page.waitForTimeout(2000);

    // ── Click Verdict Sub-tab ──
    console.log('Clicking the AI verdict sub-tab...');
    const subTabBtn = page.locator('button').filter({ hasText: /^AI verdict$/i });
    await subTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await subTabBtn.click();
    await page.waitForTimeout(2000);

    // ── Check if "Run Sherlock AI flow analysis" button is visible ──
    const analyzeBtn = page.locator('button:has-text("Sherlock AI flow analysis")');
    await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Run Sherlock AI flow analysis button is visible!');

    // ── Click the button ──
    console.log('Triggering FII/DII Analysis...');
    await analyzeBtn.click();
    
    // ── Wait for analysis to start and stream ──
    console.log('Waiting for narrative streaming to complete...');
    const completedBtn = page.locator('button:has-text("Run Sherlock AI flow analysis")');
    await completedBtn.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Analysis complete! Streaming finished.');

    // ── Take Screenshot ──
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/fii_dii_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Full page screenshot saved to ${screenshotPath}`);

    console.log('✅ E2E verification PASSED successfully!');

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
