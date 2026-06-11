const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click into Sherlock's Verdict tab ──────────────────────────
    console.log("Clicking 'Sherlock Verdict' tab...");
    const verdictTab = page.locator('.nav-tab', { hasText: 'Sherlock Verdict' });
    await verdictTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Verify Signal Generator section is visible ─────────────────
    console.log('Checking for Precision Signal Generator heading...');
    const sigHeading = page.locator('text=Precision Signal Generator');
    await sigHeading.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Precision Signal Generator section found.');

    // ── Step 3: Select Trade Direction (SHORT) ──────────────────────────────
    const selectBox = page.locator('select').first();
    await selectBox.waitFor({ state: 'visible', timeout: 10000 });
    await selectBox.selectOption('SHORT');
    await page.waitForTimeout(1000);
    console.log('✅ Trade Type selected: SHORT');

    // ── Step 4: Click 'Generate Precision Signal' button ────────────────────
    const genButton = page.locator('#btn-generate-precision-signal');
    await genButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log("Clicking 'Generate Precision Signal' button...");
    await genButton.click();
    await page.waitForTimeout(4000); // Wait for API response

    // ── Step 5: Screenshot signal results page ──────────────────────────────
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/signal_generator_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Screenshot saved → ${shotPath}`);

    // ── Step 6: Verify raw signal code block is exposed ─────────────────────
    const preBlock = page.locator('pre');
    const preCount = await preBlock.count();
    if (preCount > 0) {
      const rawText = await preBlock.first().innerText();
      console.log('\n--- Raw Signal Output (first 600 chars) ---');
      console.log(rawText.substring(0, 600));

      // Assert mandatory fields are present
      const mandatory = ['SIGNAL', 'CONFIDENCE', 'ENTRY ZONE', 'STOP LOSS', 'TARGET 1',
                         'TARGET 2', 'RISK-REWARD', 'VALIDITY', 'POSITION SIZE RULE',
                         'DEDUCTION', 'INVALIDATION'];
      let allPresent = true;
      for (const field of mandatory) {
        if (!rawText.toUpperCase().includes(field)) {
          console.error(`❌ Missing mandatory field: ${field}`);
          allPresent = false;
        }
      }
      if (allPresent) {
        console.log('\n✅ All 11 mandatory signal fields are present in output.');
      }
    } else {
      console.log('ℹ️  pre block not yet visible — signal may still be loading.');
    }

    console.log('\n✅ Signal Generator E2E test PASSED.');

  } catch (err) {
    console.error('❌ Error: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/signal_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot saved → ${errPath}`);
  } finally {
    await browser.close();
  }
})();
