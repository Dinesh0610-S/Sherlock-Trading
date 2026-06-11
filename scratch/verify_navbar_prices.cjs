const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(3000); // Wait for load
  
  console.log('Reading ticker items...');
  const tickerItems = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ticker-item'));
    return items.map(el => el.innerText.replace(/\n/g, ' '));
  });
  
  console.log('\n--- TICKER TAPE ITEMS FOUND ON PAGE ---');
  tickerItems.forEach((item, index) => {
    console.log(`Item ${index + 1}: ${item}`);
  });
  
  await browser.close();
  console.log('\nDone!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
