const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click Trade Journal tab ──────────────────────────────────────
    console.log("Clicking Trade Journal tab...");
    const journalTab = page.locator('#journal-tab');
    await journalTab.waitFor({ state: 'visible', timeout: 15000 });
    await journalTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Clear any existing trades to start fresh ─────────────────────
    console.log("Clearing existing trades...");
    const clearBtn = page.locator('text=Clear Trades Journal');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 3: Fill and Save New Open Trade ─────────────────────────────────
    console.log("Filing new open trade case: TCS, LONG, VWAP Rejection, Qty 20, Entry 3500...");
    await page.locator('#tradeFormTicker').fill('TCS');
    await page.locator('#tradeFormType').selectOption('LONG');
    await page.locator('#tradeFormConviction').selectOption('High');
    await page.locator('#tradeFormSetup').fill('VWAP Rejection');
    await page.locator('#tradeFormQty').fill('20');
    await page.locator('#tradeFormEntry').fill('3500');
    
    await page.locator('#btn-save-open-trade').click();
    await page.waitForTimeout(1500);

    // ── Step 4: Verify trade is listed in Active Open Trades ─────────────────
    console.log("Verifying active open trade is listed...");
    const openTableText = await page.locator('.card:has-text("Active Open Trades") table').innerText();
    if (openTableText.includes('TCS') && openTableText.includes('LONG') && openTableText.includes('20')) {
      console.log("✅ TCS active open trade found in table.");
    } else {
      throw new Error("Active trade not listed!");
    }

    // ── Step 5: Close Trade inline ───────────────────────────────────────────
    console.log("Closing active trade: Exit Price = 3600...");
    const closeBtn = page.locator('.btn-close-trade').first();
    await closeBtn.click();
    await page.waitForTimeout(500);

    // Fill Exit price in the newly visible input
    const exitInput = page.locator('.exit-price-input').first();
    await exitInput.fill('3600');
    await page.waitForTimeout(200);

    // Confirm close
    const confirmBtn = page.locator('.btn-confirm-close-trade').first();
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // ── Step 6: Verify trade is closed and exists in Closed Cases ────────────
    console.log("Verifying trade is in Closed Trade Journal table...");
    const closedTableText = await page.locator('.card:has-text("Closed Trade Journal Case Files") table').innerText();
    if (closedTableText.includes('TCS') && closedTableText.includes('2000')) {
      console.log("✅ TCS trade closed successfully with expected realized PnL.");
    } else {
      throw new Error("Closed trade case or expected realized P&L not found in history table!");
    }

    // ── Step 7: Verify KPI calculations ──────────────────────────────────────
    console.log("Checking metrics dashboard KPIs...");
    const cumPnl = await page.locator('#metric-cumulative-pnl').innerText();
    const winRate = await page.locator('#metric-win-rate').innerText();
    const totalTrades = await page.locator('#metric-total-trades').innerText();
    const streak = await page.locator('#metric-current-streak').innerText();

    console.log(`KPI - Cumulative P&L: ${cumPnl}`);
    console.log(`KPI - Win Rate: ${winRate}`);
    console.log(`KPI - Executed Trades: ${totalTrades}`);
    console.log(`KPI - Current Streak: ${streak}`);

    if (cumPnl.includes('2000.00') && winRate.includes('100') && totalTrades.includes('1')) {
      console.log("✅ KPI metric values computed and displayed correctly.");
    } else {
      throw new Error(`KPI verification failed. Got PnL: ${cumPnl}, Win Rate: ${winRate}, Total: ${totalTrades}`);
    }

    // ── Step 8: Save Screenshot ──────────────────────────────────────────────
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/trade_journal_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Screenshot saved → ${shotPath}`);
    console.log('\n✅ Trade Journal and Performance Analytics E2E test PASSED.');

  } catch (err) {
    console.error('❌ Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/journal_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot → ${errPath}`);
  } finally {
    await browser.close();
  }
})();
