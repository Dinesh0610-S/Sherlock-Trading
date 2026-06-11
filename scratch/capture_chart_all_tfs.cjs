const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport to a nice size to see everything
  await page.setViewportSize({ width: 1280, height: 960 });

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.toString()}`));

  try {
    console.log('Navigating to http://localhost:8501...');
    await page.goto('http://localhost:8501', { waitUntil: 'load', timeout: 20000 });
    
    // Wait for the Clue Board page to load and options live stream to connect
    await page.waitForTimeout(4000);

    const timeframes = [
      { label: '1minute', filename: 'chart_tf_1minute.png' },
      { label: '5', filename: 'chart_tf_5.png' },
      { label: '10', filename: 'chart_tf_10.png' },
      { label: '15', filename: 'chart_tf_15.png' },
      { label: '30', filename: 'chart_tf_30.png' },
      { label: '1hr', filename: 'chart_tf_1hr.png' },
      { label: '1day', filename: 'chart_tf_1day.png' }
    ];

    for (const tf of timeframes) {
      console.log(`Clicking timeframe button: ${tf.label}...`);
      // Find the button inside the Quantitative Footprint Chart card that matches the text
      const button = page.locator(`.cb-card:has-text("Quantitative Footprint Chart") button`, { hasText: new RegExp(`^${tf.label}$`) });
      await button.click();
      
      // Wait for candles to fetch and render
      await page.waitForTimeout(3000);
      
      // Capture the footprint chart card specifically
      const chartCard = page.locator('.cb-card:has-text("Quantitative Footprint Chart")');
      const artifactPath = path.join('C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0', tf.filename);
      await chartCard.screenshot({ path: artifactPath });
      console.log(`Screenshot saved to ${artifactPath}`);
    }
    
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
