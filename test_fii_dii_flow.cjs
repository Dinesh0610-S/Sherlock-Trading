const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click FII/DII Flow tab ───────────────────────────────────────
    console.log("Clicking FII/DII Flow tab...");
    const fiiDiiTab = page.locator('#fii-dii-tab');
    await fiiDiiTab.waitFor({ state: 'visible', timeout: 15000 });
    await fiiDiiTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Confirm heading is visible ────────────────────────────────────
    const heading = page.locator('text=FII/DII Daily Flow Panel').first();
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ FII/DII Daily Flow Panel heading found.');

    // ── Step 3: Check Today\'s metrics cards prefills ──────────────────────────
    const fiiNetVal = await page.locator('.metric-card:has-text("FII NET") .metric-value').innerText();
    const diiNetVal = await page.locator('.metric-card:has-text("DII NET") .metric-value').innerText();
    console.log(`✅ FII Net Card reads: ${fiiNetVal}`);
    console.log(`✅ DII Net Card reads: ${diiNetVal}`);

    // ── Step 4: Click 30-day Trend subtab ────────────────────────────────────
    console.log("Clicking 30-day Trend sub-tab...");
    const trendBtn = page.locator('button:has-text("30-day trend")');
    await trendBtn.click();
    await page.waitForTimeout(1000);

    // Verify historical ledger table is loaded
    const tableHeader = page.locator('table.data-table th').first();
    await tableHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ 30-day trend historical ledger table is rendered.');

    // ── Step 5: Click AI Verdict subtab ──────────────────────────────────────
    console.log("Clicking AI Verdict sub-tab...");
    const verdictBtn = page.locator('button:has-text("AI verdict")');
    await verdictBtn.click();
    await page.waitForTimeout(1000);

    // Click Sherlock Analysis button
    console.log("Running Sherlock AI flow analysis...");
    const runAnalysisBtn = page.locator('button:has-text("Run Sherlock AI flow")');
    await runAnalysisBtn.click();
    await page.waitForTimeout(4000); // Wait for response/fallback

    // Verify verdict display
    const verdictHeader = page.locator('text=Combined Bias Verdict');
    await verdictHeader.waitFor({ state: 'visible', timeout: 10000 });
    const verdictValue = await page.locator('.card:has-text("Combined Bias Verdict") h2').innerText();
    console.log(`✅ AI Verdict: ${verdictValue}`);

    // ── Step 6: Save Screenshot ──────────────────────────────────────────────
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/fii_dii_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Screenshot saved → ${shotPath}`);
    console.log('\n✅ FII/DII daily flow E2E test PASSED.');

  } catch (err) {
    console.error('❌ Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/fii_dii_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot saved → ${errPath}`);
  } finally {
    await browser.close();
  }
})();
