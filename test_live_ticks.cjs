const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Check Spot Price on Clue Board ──
    console.log('--- Checking Clue Board Spot Price ---');
    const spotLocator = page.locator('.metric-card:has-text("Spot Price") .metric-value');
    await spotLocator.waitFor({ state: 'visible', timeout: 10000 });
    const price1Str = await spotLocator.innerText();
    const price1 = parseFloat(price1Str.replace(/[^\d.]/g, ''));
    console.log(`Initial Spot Price: ${price1}`);

    // Wait for a tick and get updated price
    console.log('Waiting 2 seconds for live tick...');
    await page.waitForTimeout(2000);
    const price2Str = await spotLocator.innerText();
    const price2 = parseFloat(price2Str.replace(/[^\d.]/g, ''));
    console.log(`Updated Spot Price: ${price2}`);

    if (price1 !== price2) {
      console.log(`✅ Live Ticking Spot Price Verified: ${price1} -> ${price2}`);
    } else {
      console.warn(`⚠️ Spot Price did not tick. It might tick on next interval.`);
    }

    // Save screenshot of Clue Board
    const clueBoardShot = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/clueboard_live.png';
    await page.screenshot({ path: clueBoardShot });
    console.log(`Screenshot of Clue Board saved to ${clueBoardShot}`);

    // ── Navigate to Option Intelligence tab ──
    console.log('--- Navigating to Option Intelligence ---');
    const optionTab = page.locator('text=Option Intelligence');
    await optionTab.click();
    await page.waitForTimeout(2000);

    // Verify option chain elements
    const tableRow = page.locator('.data-table tbody tr').first();
    await tableRow.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Option chain table loaded.');

    const callLtpLoc = tableRow.locator('td').nth(1);
    const putLtpLoc = tableRow.locator('td').nth(5);
    
    const callLtp1 = parseFloat(await callLtpLoc.innerText());
    const putLtp1 = parseFloat(await putLtpLoc.innerText());
    console.log(`Initial Row 1 Call LTP: ${callLtp1}, Put LTP: ${putLtp1}`);

    // Wait for a tick
    console.log('Waiting 2 seconds for options premium tick...');
    await page.waitForTimeout(2000);
    const callLtp2 = parseFloat(await callLtpLoc.innerText());
    const putLtp2 = parseFloat(await putLtpLoc.innerText());
    console.log(`Updated Row 1 Call LTP: ${callLtp2}, Put LTP: ${putLtp2}`);

    if (callLtp1 !== callLtp2 || putLtp1 !== putLtp2) {
      console.log(`✅ Live Ticking Option Premiums Verified.`);
    } else {
      console.warn(`⚠️ Option premiums did not tick.`);
    }

    // Save screenshot of Option Intelligence
    const optionsShot = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/optionchain_live.png';
    await page.screenshot({ path: optionsShot });
    console.log(`Screenshot of Option Chain saved to ${optionsShot}`);

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
  } finally {
    await browser.close();
  }
})();
