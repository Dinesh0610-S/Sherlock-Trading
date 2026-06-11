const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE UNHANDLED ERROR:', err.stack || err.message));
  page.on('requestfailed', req => console.warn('REQ FAILED:', req.url(), req.failure()?.errorText || ''));

  try {
    console.log('Navigating to http://localhost:8501 ...');
    await page.goto('http://localhost:8501', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const tabs = [
      { name: 'clueBoard', text: 'Clue Board' },
      { name: 'sherlockAnalysis', text: 'Sherlock Verdict' },
      { name: 'rrCalculator', text: 'RR Calculator' },
      { name: 'optionChain', text: 'Option Intelligence' },
      { name: 'journal', text: 'Trade Journal' },
      { name: 'fiiDii', text: 'FII/DII Flow' },
      { name: 'morningBrief', text: 'Morning Brief' },
      { name: 'preMarket', text: 'Pre-Market Intel' },
      { name: 'backtester', text: 'Backtester' },
      { name: 'sherlockBot', text: 'Holmes AI' }
    ];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      console.log(`\n--- Switching to Tab [${i + 1}/${tabs.length}]: ${tab.text} ---`);
      
      // Find the tab button by matching text contents
      const button = page.locator('.nav-tab', { hasText: tab.text });
      if (await button.count() > 0) {
        await button.click();
        console.log(`Clicked tab button for ${tab.text}. Waiting 3s...`);
        await page.waitForTimeout(3000);
        
        const screenshotPath = path.resolve(`c:/Users/DINESHMANI/Desktop/Pictures/Trade/scratch/tab_${i + 1}_${tab.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Saved screenshot to ${screenshotPath}`);
      } else {
        console.error(`Could not find tab button for ${tab.text}`);
      }
    }

    console.log('\nFinished testing all tabs successfully.');
  } catch (err) {
    console.error('Error during tab testing run:', err.stack || err.message);
  } finally {
    await browser.close();
  }
})();
