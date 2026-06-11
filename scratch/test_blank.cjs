const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
    if (err.stack) console.log(err.stack);
  });

  try {
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const screenshotPath = path.join(__dirname, 'blank_debug.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
  } catch (e) {
    console.error('Navigation error:', e.message);
  } finally {
    await browser.close();
  }
})();
