const { chromium } = require('playwright');

const OUT = 'C:/Users/DINESHMANI/.gemini/antigravity/brain/1599aab6-1df6-45fd-878f-ac86e47ffad0';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Opening app...');
  await page.goto('http://localhost:8501', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // --- Screenshot 1: Scroll down to find Pattern Engine on Clue Board ---
  // Scroll down on the page to see pattern engine + timeline sections
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/scroll1_below_fold.png` });
  console.log('Scroll1 saved');

  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/scroll2_deeper.png` });
  console.log('Scroll2 saved');

  // --- Try clicking the Strategy Engine tab (if it exists in nav) ---
  // Look for any nav tab related to Strategy
  const allButtons = await page.locator('button, [role="tab"]').allTextContents();
  console.log('All nav buttons found:', allButtons.slice(0, 20).join(' | '));

  // Navigate to the page that shows timeline windows
  // Try clicking each nav tab and take screenshot
  const tabs = page.locator('nav button, header button, [role="tab"]');
  const count = await tabs.count();
  console.log(`Found ${count} tab buttons`);

  for (let i = 0; i < Math.min(count, 10); i++) {
    const text = await tabs.nth(i).textContent();
    console.log(`Tab ${i}: "${text}"`);
    if (/strategy|signal|engine|timeline/i.test(text)) {
      await tabs.nth(i).click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/strategy_tab_clicked.png` });
      console.log(`Clicked tab: ${text}`);
      break;
    }
  }

  // --- Scroll within the page to show the 15-min timeline ---
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  
  // Take full-page screenshot to capture everything
  await page.screenshot({ path: `${OUT}/full_clue_board.png`, fullPage: true });
  console.log('Full page clue board saved');

  await browser.close();
  console.log('Done.');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
