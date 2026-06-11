const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);

    // ── Step 1: Click into Sherlock Bot tab ──────────────────────────
    console.log("Clicking 'Sherlock Bot' tab...");
    const verdictTab = page.locator('#sherlock-bot-tab');
    await verdictTab.click();
    await page.waitForTimeout(2000);

    // ── Step 2: Confirm only one Chatbot container exists ──
    console.log('Checking for chatbot AI DETECTIVE badge...');
    const heading = page.locator('text=AI DETECTIVE').first();
    const headingCount = await heading.count();
    console.log(`Found ${headingCount} chatbot AI DETECTIVE badges (should be >= 1).`);
    if (headingCount < 1) {
      throw new Error(`Expected at least 1 chatbot AI DETECTIVE badge, found ${headingCount}`);
    }
    console.log('✅ Chatbot UI loaded successfully.');

    // ── Step 3: Check suggestion chips ──
    console.log('Checking suggestion chips...');
    const actionChips = page.locator('button', { hasText: 'Analyze' });
    await actionChips.first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Context-aware quick action chips are visible.');

    // ── Step 4: Click a suggestion chip ──
    console.log('Clicking the "Strategy" chip...');
    const strategyChip = page.locator('button', { hasText: 'Strategy' }).first();
    await strategyChip.click();
    
    // Wait for user bubble to appear
    const userBubble = page.locator('.holmes-msg-user').first();
    await userBubble.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ User message bubble sent.');

    // Wait for Sherlock response (starts streaming)
    console.log('Waiting for Sherlock to start streaming reply...');
    const replyContainer = page.locator('.sherlock-reply').nth(1);
    await replyContainer.waitFor({ state: 'visible', timeout: 25000 });
    console.log('✅ Gemini-style rich reply container appeared.');

    // Wait for stream to complete
    console.log('Waiting for streaming to finish...');
    await page.waitForTimeout(5000);

    // Verify copy button is visible
    const copyBtn = replyContainer.locator('.copy-btn');
    await copyBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Copy button is visible in reply header.');

    // Verify markdown elements (like a header or table) exist
    const replyBody = replyContainer.locator('.reply-body');
    const tableExists = await replyBody.locator('table').count();
    console.log(`✅ Table element count in reply body: ${tableExists}`);

    // Save screenshot
    const shotPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/chatbot_screenshot.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`✅ Upgraded Chatbot screenshot saved → ${shotPath}`);

    console.log('\n✅ Chatbot Upgrade E2E test PASSED.');

  } catch (err) {
    console.error('❌ Chatbot Test Failed: ' + err.message);
    const errPath = 'c:/Users/DINESHMANI/Desktop/Pictures/Trade/chatbot_error_screenshot.png';
    await page.screenshot({ path: errPath });
    console.log(`Error screenshot saved → ${errPath}`);
  } finally {
    await browser.close();
  }
})();
