const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.toString()}`));
  
  page.on('request', request => {
    if (request.url().includes('live-stream') || request.url().includes('nse')) {
      console.log(`[REQ] ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('live-stream') || response.url().includes('nse')) {
      console.log(`[RESP] ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    console.log('Page loaded. Waiting 10s for SSE...');
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
