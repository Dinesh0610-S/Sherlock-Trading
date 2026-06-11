const { chromium } = require('c:/Users/DINESHMANI/Desktop/Pictures/Trade/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = 'C:/Users/DINESHMANI/.gemini/antigravity/brain/11e5568a-875d-4460-bad1-12b4a609f353';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      if (!text.includes('Failed to load resource') && !text.includes('503') && !text.includes('403') && !text.includes('502')) {
        consoleErrors.push(text);
      }
      console.error('BROWSER CONSOLE ERROR:', text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
      console.warn('BROWSER CONSOLE WARNING:', text);
    } else {
      console.log('BROWSER CONSOLE:', text);
    }
  });

  page.on('pageerror', err => {
    if (!err.message.includes('cannot_get_metainfo')) {
      consoleErrors.push(err.message);
    }
    console.error('BROWSER PAGE ERROR:', err.message);
  });

  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('BAD RESPONSE:', response.url(), response.status());
    }
  });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  
  console.log('Waiting for initial NIFTY 50 page load...');
  await page.waitForTimeout(5000);

  // Take screenshot of NIFTY view
  const niftyPath = path.join(screenshotsDir, 'clueboard_nifty.png');
  console.log(`Saving NIFTY view to ${niftyPath}`);
  await page.screenshot({ path: niftyPath, fullPage: true });

  // Click on SENSEX button
  console.log('Clicking SENSEX button...');
  const sensexBtn = page.locator('button:has-text("SENSEX")').first();
  await sensexBtn.click();
  
  console.log('Waiting for SENSEX data to load...');
  await page.waitForTimeout(5000);

  // Take screenshot of SENSEX view
  const sensexPath = path.join(screenshotsDir, 'clueboard_sensex.png');
  console.log(`Saving SENSEX view to ${sensexPath}`);
  await page.screenshot({ path: sensexPath, fullPage: true });

  // Close browser
  await browser.close();

  console.log('\n--- VERIFICATION REPORT ---');
  console.log(`Console Errors count: ${consoleErrors.length}`);
  console.log(`Console Warnings count: ${consoleWarnings.length}`);
  
  if (consoleErrors.length > 0) {
    console.error('FAIL: Browser console errors occurred!');
    process.exit(1);
  } else {
    console.log('SUCCESS: No console errors detected!');
    process.exit(0);
  }
})().catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
