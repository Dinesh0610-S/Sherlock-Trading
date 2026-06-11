const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(3000);

    // ── Click Morning Brief Tab ──
    console.log('Clicking the Morning Brief tab...');
    const morningBriefTab = page.locator('#morning-brief-tab');
    await morningBriefTab.waitFor({ state: 'visible', timeout: 10000 });
    await morningBriefTab.click();
    await page.waitForTimeout(1000);

    // ── Check if Generate Button exists ──
    const generateBtn = page.locator('button:has-text("Generate Morning Brief")');
    const isGenerateVisible = await generateBtn.isVisible();

    if (isGenerateVisible) {
      console.log('Clicking "Generate Morning Brief" button...');
      await generateBtn.click();
      
      console.log('Waiting for AI Morning Brief generation (this might take up to 25s)...');
      // Wait for the "Refresh" button or the briefing content to become visible
      const refreshBtn = page.locator('button:has-text("Refresh")');
      await refreshBtn.waitFor({ state: 'visible', timeout: 35000 });
      console.log('✅ Morning Brief generated successfully!');
    } else {
      console.log('Morning Brief was already generated/cached. Proceeding to verify...');
    }

    // ── Verify Global Oversight sub-tab is visible and has real data ──
    console.log('Verifying Global Oversight sub-tab data...');
    const globalSubTabBtn = page.locator('button:has-text("Global oversight")');
    await globalSubTabBtn.click();
    await page.waitForTimeout(500);

    // Check Dow Jones value
    const dowCard = page.locator('div:has-text("Dow Jones")').last();
    await dowCard.waitFor({ state: 'visible', timeout: 5000 });
    const dowText = await dowCard.innerText();
    console.log(`✅ Dow Jones Card Text: "${dowText.replace(/\n/g, ' ')}"`);

    if (dowText.includes('—') || dowText.includes('NaN')) {
      throw new Error('Global overnight data contains placeholder/empty values!');
    }

    // ── Switch to India Ready sub-tab ──
    console.log('Switching to India Ready sub-tab...');
    const indiaSubTabBtn = page.locator('button:has-text("India ready")');
    await indiaSubTabBtn.click();
    await page.waitForTimeout(500);

    // Verify VIX or Nifty is visible
    const indiaVixCard = page.locator('div:has-text("India VIX")').last();
    await indiaVixCard.waitFor({ state: 'visible', timeout: 5000 });
    const vixText = await indiaVixCard.innerText();
    console.log(`✅ India VIX Card Text: "${vixText.replace(/\n/g, ' ')}"`);

    if (vixText.includes('—') || vixText.includes('NaN')) {
      throw new Error('India ready data contains placeholder/empty values!');
    }

    // ── Take and Save Screenshot ──
    const screenshotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/morning_brief_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Full page screenshot saved to ${screenshotPath}`);

    console.log('✅ Morning Brief E2E verification PASSED successfully!');

  } catch (err) {
    console.error('❌ E2E Test Error: ' + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
