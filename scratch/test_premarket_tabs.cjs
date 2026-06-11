const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE UNHANDLED ERROR:', err.stack || err.message));

  try {
    console.log('Navigating to http://localhost:8501 ...');
    await page.goto('http://localhost:8501', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const mainButton = page.locator('.nav-tab', { hasText: 'Pre-Market Intel' });
    await mainButton.click();
    console.log('Clicked Pre-Market Intel. Waiting 10s for initial load...');
    await page.waitForTimeout(10000);

    const subtabs = [
      { id: 'globalCues', text: 'Global Cue$' },
      { id: 'indiaPulse', text: 'India Pulse' },
      { id: 'verdict', text: 'AI Verdict' },
      { id: 'tradingPlan', text: 'AI Trading Plan' }
    ];

    for (let i = 0; i < subtabs.length; i++) {
      const subtab = subtabs[i];
      console.log(`\n--- Switching to Subtab [${i + 1}/${subtabs.length}]: ${subtab.text} ---`);
      
      const button = page.locator('button', { hasText: subtab.text });
      if (await button.count() > 0) {
        await button.click();
        console.log(`Clicked subtab button for ${subtab.text}. Waiting 2s...`);
        await page.waitForTimeout(2000);
        
        const screenshotPath = path.resolve(`c:/Users/DINESHMANI/Desktop/Pictures/Trade/scratch/marketmind_${subtab.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Saved screenshot to ${screenshotPath}`);
      } else {
        console.error(`Could not find subtab button for ${subtab.text}`);
      }
    }

    console.log('\nFinished testing all Pre-Market Intel subtabs.');
  } catch (err) {
    console.error('Error:', err.stack || err.message);
  } finally {
    await browser.close();
  }
})();
