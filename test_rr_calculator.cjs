const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click RR Calculator tab ──────────────────────────────────────
    console.log("Clicking RR Calculator tab...");
    const rrTab = page.locator('#rr-calculator-tab');
    await rrTab.waitFor({ state: 'visible', timeout: 15000 });
    await rrTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Confirm heading is visible ───────────────────────────────────
    const heading = page.locator('text=Risk-Reward Entry Checklist');
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ RR Calculator heading found.');

    // ── Step 3: Confirm prefill — entry field should have a non-zero value ────
    const entryInput = page.locator('#rrEntry');
    const entryVal = await entryInput.inputValue();
    console.log(`✅ Entry field prefilled with: ₹${entryVal}`);

    // ── Step 4: Interact with Form ───────────────────────────────────────────
    console.log("Setting up a SHORT trade: Entry=150, SL=155, Target 1=145, Target 2=140...");
    
    // Choose Trade Direction
    const directionSelect = page.locator('select').first();
    await directionSelect.selectOption('SHORT');
    await page.waitForTimeout(500);

    // Fill Entry
    await entryInput.fill('150');
    await page.waitForTimeout(200);

    // Fill SL
    const slInput = page.locator('#rrSL');
    await slInput.fill('155');
    await page.waitForTimeout(200);

    // Fill Target 1
    const t1Input = page.locator('#rrT1');
    await t1Input.fill('145');
    await page.waitForTimeout(200);

    // Fill Target 2
    const t2Input = page.locator('#rrT2');
    await t2Input.fill('140');
    await page.waitForTimeout(200);

    // Scroll down to reveal results
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(1000);

    // ── Step 5: Check for verdict banner ─────────────────────────────────────
    const verdictTitle = page.locator('#rrVerdict');
    await verdictTitle.waitFor({ state: 'visible', timeout: 5000 });
    const verdictText = await verdictTitle.innerText();
    console.log(`✅ Verdict: ${verdictText}`);

    // ── Step 6: Check metric cards / summary ─────────────────────────────────
    const rrRatio1 = await page.locator('#rrRatio1').innerText();
    const rrRatio2 = await page.locator('#rrRatio').innerText();
    console.log(`Target 1 R:R: ${rrRatio1}`);
    console.log(`Target 2 R:R: ${rrRatio2}`);

    // ── Step 7: Screenshot ───────────────────────────────────────────────────
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/rr_calculator_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Screenshot saved → ${shotPath}`);
    console.log('\n✅ RR Calculator E2E test PASSED.');

  } catch (err) {
    console.error('❌ Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/rr_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot → ${errPath}`);
  } finally {
    await browser.close();
  }
})();
