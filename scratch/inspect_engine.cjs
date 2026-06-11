const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(6000);

  console.log('\n--- ENGINE CACHE DUMP ---');
  const cacheData = await page.evaluate(() => {
    if (!window.engine) return 'window.engine is not defined!';
    const dump = {};
    for (const [k, v] of window.engine.cache.entries()) {
      dump[k] = v;
    }
    return dump;
  });
  console.log(JSON.stringify(cacheData, null, 2));

  console.log('\n--- ENGINE TIMESTAMPS DUMP ---');
  const timestampsData = await page.evaluate(() => {
    if (!window.engine) return 'window.engine is not defined!';
    const dump = {};
    for (const [k, v] of window.engine.lastUpdate.entries()) {
      dump[k] = v;
    }
    return dump;
  });
  console.log(JSON.stringify(timestampsData, null, 2));

  await browser.close();
})();
