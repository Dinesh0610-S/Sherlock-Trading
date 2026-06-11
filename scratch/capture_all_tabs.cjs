const { chromium } = require('playwright');

const tabs = [
  { name: '1_clueBoard', selector: 'button:has-text("Clue Board")' },
  { name: '2_sherlockAnalysis', selector: 'button:has-text("Sherlock Verdict")' },
  { name: '3_rrCalculator', selector: '#rr-calculator-tab' },
  { name: '4_optionChain', selector: 'button:has-text("Option Intelligence")' },
  { name: '5_journal', selector: '#journal-tab' },
  { name: '6_fiiDii', selector: '#fii-dii-tab' },
  { name: '7_morningBrief', selector: '#morning-brief-tab' },
  { name: '8_preMarket', selector: '#pre-market-tab' },
  { name: '9_backtester', selector: '#backtester-tab' },
  { name: '10_sherlockBot', selector: '#sherlock-bot-tab' }
];

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 960 });

  console.log('Navigating to http://localhost:8501...');
  await page.goto('http://localhost:8501');
  await page.waitForTimeout(5000); // Allow initial loading

  for (const tab of tabs) {
    console.log(`Navigating to tab: ${tab.name}...`);
    const btn = page.locator(tab.selector);
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(3000); // Wait for tab calculations and rendering
      
      const screenshotPath = `C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0/tab_${tab.name}_captured.png`;
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved to: ${screenshotPath}`);
    } else {
      console.log(`Warning: Tab ${tab.name} button not found with selector: ${tab.selector}`);
    }
  }

  await browser.close();
  console.log('All tab captures completed successfully.');
})().catch(err => {
  console.error('Error capturing tabs:', err);
  process.exit(1);
});
