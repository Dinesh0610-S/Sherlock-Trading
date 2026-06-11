const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click Backtester tab ────────────────────────────────────────
    console.log("Clicking Backtester tab...");
    const backtesterTab = page.locator('#backtester-tab');
    await backtesterTab.waitFor({ state: 'visible', timeout: 15000 });
    await backtesterTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Confirm heading/config panel is visible ──────────────────────
    const configHeader = page.locator('text=Backtest Configuration Panel').first();
    await configHeader.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Backtest Configuration Panel is visible.');

    // ── Step 3: Run Backtest ────────────────────────────────────────────────
    console.log("Running simulation backtest...");
    const runBtn = page.locator('button:has-text("Run Backtest")').first();
    await runBtn.click();

    // Wait for the results title "Backtest Output" to become visible
    console.log("Waiting for backtest results...");
    const resultsTitle = page.locator('text=Backtest Output:').first();
    await resultsTitle.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Backtest Output is visible.');

    // ── Step 4: Verify summary statistics ────────────────────────────────────
    const totalTrades = await page.locator('.metric-card:has-text("Total Trades") .metric-value').innerText();
    const winRate = await page.locator('.metric-card:has-text("Win Rate") .metric-value').innerText();
    const profitFactor = await page.locator('.metric-card:has-text("Profit Factor") .metric-value').innerText();
    const totalPnl = await page.locator('.metric-card:has-text("Total P&L") .metric-value').innerText();

    console.log(`✅ Summary Metrics:`);
    console.log(`   - Total Trades: ${totalTrades}`);
    console.log(`   - Win Rate: ${winRate}`);
    console.log(`   - Profit Factor: ${profitFactor}`);
    console.log(`   - Total P&L: ${totalPnl}`);

    // ── Step 5: Click Equity Curve tab and verify ───────────────────────────
    console.log("Clicking Equity Curve sub-tab...");
    const equityTabBtn = page.locator('button:has-text("Equity Curve")').first();
    await equityTabBtn.click();
    await page.waitForTimeout(1500);

    const canvasCount = await page.locator('canvas').count();
    console.log(`✅ Equity Curve: found ${canvasCount} canvas charts.`);

    // ── Step 6: Click Trade Log tab, download CSV ────────────────────────────
    console.log("Clicking Trade Log sub-tab...");
    const logTabBtn = page.locator('button:has-text("Trade Log")').first();
    await logTabBtn.click();
    await page.waitForTimeout(1500);

    console.log("Downloading CSV log...");
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Download CSV Log")').first().click(),
    ]);
    const downloadPath = await download.path();
    console.log(`✅ CSV downloaded to temporary path: ${downloadPath}`);

    // ── Step 7: Click AI Verdict tab, run analysis ───────────────────────────
    console.log("Clicking AI Verdict sub-tab...");
    const aiTabBtn = page.locator('button:has-text("AI Verdict")').first();
    await aiTabBtn.click();
    await page.waitForTimeout(1500);

    console.log("Running Sherlock AI Strategy analysis...");
    const runAiBtn = page.locator('button:has-text("Run AI Analysis")').first();
    await runAiBtn.click();

    console.log("Waiting for AI Strategy analysis to finish...");
    const verdictHeader = page.locator('text=Deductive Strategy Verdict').first();
    await verdictHeader.waitFor({ state: 'visible', timeout: 30000 });

    const verdictVal = await page.locator('h2:has-text("verdict")').or(page.locator('div:has-text("Deductive Strategy Verdict") + h2')).first().innerText();
    const edgeStrength = await page.locator('.metric-card:has-text("Edge Strength") .metric-value').first().innerText();
    console.log(`✅ AI Analysis complete!`);
    console.log(`   - Verdict: ${verdictVal}`);
    console.log(`   - Edge Strength: ${edgeStrength}`);

    // ── Step 8: Save Screenshot ──────────────────────────────────────────────
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/backtest_engine_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`✅ Full-page screenshot saved → ${shotPath}`);

    console.log('\n✅ Sherlock Holmes Backtesting Engine E2E test PASSED.');

  } catch (err) {
    console.error('❌ Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/backtest_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot saved → ${errPath}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
