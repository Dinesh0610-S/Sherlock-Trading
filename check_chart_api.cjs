const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(3000);

  const methods = await page.evaluate(() => {
    // Locate the container or see if there is any global or we can create a temporary chart
    // Let's create a temporary chart in the page context
    try {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      // We can access the chart methods through standard imports or window if we expose it,
      // but wait, since lightweight-charts is bundled, let's check the error or see what is on the window object.
      // Wait, is there any global lightweight-charts or we can check window?
      return Object.keys(window);
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Window keys:', methods);
  await browser.close();
})().catch(console.error);
