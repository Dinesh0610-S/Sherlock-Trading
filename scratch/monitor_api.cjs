const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/nse/option-chain') || url.includes('/api/candles') || url.includes('/nse/quote')) {
      console.log(`\n[API Response] URL: ${url}`);
      console.log(`Status: ${response.status()}`);
      try {
        const text = await response.text();
        console.log(`Response length: ${text.length}`);
        if (text.length < 500) {
          console.log(`Body: ${text}`);
        } else {
          console.log(`Body (truncated): ${text.slice(0, 300)}...`);
        }
      } catch (err) {
        console.log(`Error reading body: ${err.message}`);
      }
    }
  });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(6000);

  await browser.close();
})();
